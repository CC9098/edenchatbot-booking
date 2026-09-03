import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CHATWOOT_FLOW_STATE_ATTRIBUTE,
  CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE,
  ChatwootClient,
  type ChatwootConversationDetails,
  type ChatwootMessage,
  ensureChatwootHumanHandoffVisibility,
} from '@/lib/chatwoot-agent-bot';

const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const DEFAULT_SETTLE_DELAYS_MS = [500, 1500] as const;
const DEFAULT_STALE_INCOMING_MS = 5 * 60 * 1000;
const MAX_CONVERSATION_PAGES = 100;

export interface ChatwootWatchdogIncomingEvent {
  accountId: number;
  inboxId: number;
  conversationId: number;
  messageId: number;
}

export type ChatwootWatchdogAction =
  | 'already_visible'
  | 'bot_processed'
  | 'ignored_status'
  | 'ignored_inbox'
  | 'recovered_human'
  | 'recovered_unprocessed';

export interface ChatwootWatchdogResult {
  action: ChatwootWatchdogAction;
  conversationId: number;
  messageId: number;
  attempts: number;
}

export interface ChatwootHandoffAuditSummary {
  scanned: number;
  candidates: number;
  recovered: number;
  wouldRecover: number;
  skippedAfterReadBack: number;
  failures: Array<{
    conversationId: number;
    error: string;
  }>;
}

function parseNumericId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nestedId(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  return parseNumericId((value as Record<string, unknown>).id);
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function isIncomingMessage(message: ChatwootMessage | null | undefined): boolean {
  return (
    message?.message_type === 0 ||
    message?.message_type === '0' ||
    message?.message_type === 'incoming'
  );
}

function isActivityMessage(message: ChatwootMessage): boolean {
  return message.message_type === 2 || message.message_type === '2' || message.message_type === 'activity';
}

function latestNonActivityMessage(conversation: ChatwootConversationDetails): ChatwootMessage | null {
  if (conversation.last_non_activity_message) {
    return conversation.last_non_activity_message;
  }

  const messages = (conversation.messages || [])
    .filter((message) => !message.private && !isActivityMessage(message))
    .sort((left, right) => {
      const timeDifference = Number(left.created_at || 0) - Number(right.created_at || 0);
      if (timeDifference !== 0) return timeDifference;
      return Number(left.id || 0) - Number(right.id || 0);
    });

  return messages.at(-1) || null;
}

function getFlowStateValue(conversation: ChatwootConversationDetails): string {
  const value = conversation.custom_attributes?.[CHATWOOT_FLOW_STATE_ATTRIBUTE];
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getLastProcessedIncomingId(conversation: ChatwootConversationDetails): number | null {
  return parseNumericId(
    conversation.custom_attributes?.[CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE],
  );
}

function wasIncomingMessageProcessed(
  conversation: ChatwootConversationDetails,
  messageId: number,
): boolean {
  const processedMessageId = getLastProcessedIncomingId(conversation);
  return processedMessageId !== null && processedMessageId >= messageId;
}

function sleepFor(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function verifyTimestampedChatwootSignature({
  rawBody,
  signature,
  timestamp,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
}: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): boolean {
  const normalizedSecret = secret.trim();
  const normalizedSignature = signature?.trim().replace(/^sha256=/i, '') || '';
  const timestampSeconds = Number(timestamp);

  if (
    !normalizedSecret ||
    !normalizedSignature ||
    !Number.isInteger(timestampSeconds) ||
    timestampSeconds <= 0 ||
    !/^[a-f0-9]{64}$/i.test(normalizedSignature)
  ) {
    return false;
  }

  if (Math.abs(nowMs - timestampSeconds * 1000) > toleranceSeconds * 1000) {
    return false;
  }

  const expected = createHmac('sha256', normalizedSecret)
    .update(`${timestampSeconds}.${rawBody}`)
    .digest();
  const provided = Buffer.from(normalizedSignature, 'hex');

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function extractChatwootWatchdogIncomingEvent(
  payload: unknown,
): ChatwootWatchdogIncomingEvent | null {
  if (!payload || typeof payload !== 'object') return null;

  const row = payload as Record<string, unknown>;
  const isIncoming = row.message_type === 0 || row.message_type === '0' || row.message_type === 'incoming';
  const accountId = nestedId(row.account);
  const inboxId = nestedId(row.inbox);
  const conversationId = nestedId(row.conversation);
  const messageId = parseNumericId(row.id);

  if (
    row.event !== 'message_created' ||
    !isIncoming ||
    row.private === true ||
    accountId === null ||
    inboxId === null ||
    conversationId === null ||
    messageId === null
  ) {
    return null;
  }

  return { accountId, inboxId, conversationId, messageId };
}

export async function runChatwootIncomingHandoffWatchdog({
  client,
  event,
  settleDelaysMs = DEFAULT_SETTLE_DELAYS_MS,
  sleep = sleepFor,
}: {
  client: ChatwootClient;
  event: ChatwootWatchdogIncomingEvent;
  settleDelaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
}): Promise<ChatwootWatchdogResult> {
  const delays = settleDelaysMs.length ? settleDelaysMs : [0];

  for (let index = 0; index < delays.length; index += 1) {
    const delayMs = Math.max(0, Number(delays[index]) || 0);
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const conversation = await client.getConversationDetails(event.accountId, event.conversationId);
    const status = normalizeStatus(conversation.status);

    if (conversation.inbox_id && conversation.inbox_id !== event.inboxId) {
      return { ...event, action: 'ignored_inbox', attempts: 0 };
    }

    if (status === 'open') {
      return { ...event, action: 'already_visible', attempts: 0 };
    }

    if (status !== 'pending') {
      return { ...event, action: 'ignored_status', attempts: 0 };
    }

    if (getFlowStateValue(conversation) === 'human') {
      const verification = await ensureChatwootHumanHandoffVisibility({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        currentStatus: conversation.status,
      });
      return {
        ...event,
        action: 'recovered_human',
        attempts: verification.attempts,
      };
    }

    if (wasIncomingMessageProcessed(conversation, event.messageId)) {
      return { ...event, action: 'bot_processed', attempts: 0 };
    }

    if (index === delays.length - 1) {
      const verification = await ensureChatwootHumanHandoffVisibility({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        currentStatus: conversation.status,
      });
      return {
        ...event,
        action: 'recovered_unprocessed',
        attempts: verification.attempts,
      };
    }
  }

  return { ...event, action: 'ignored_status', attempts: 0 };
}

function classifyAuditCandidate(
  conversation: ChatwootConversationDetails,
  nowMs: number,
  staleIncomingMs: number,
): 'human_state' | 'stale_incoming' | null {
  if (normalizeStatus(conversation.status) !== 'pending') return null;
  if (getFlowStateValue(conversation) === 'human') return 'human_state';

  const latestMessage = latestNonActivityMessage(conversation);
  const createdAt = Number(latestMessage?.created_at || 0);
  if (
    isIncomingMessage(latestMessage) &&
    createdAt > 0 &&
    createdAt * 1000 <= nowMs - staleIncomingMs
  ) {
    return 'stale_incoming';
  }

  return null;
}

async function listAllPendingConversations(
  client: ChatwootClient,
  accountId: number,
  inboxId: number,
): Promise<ChatwootConversationDetails[]> {
  const conversations: ChatwootConversationDetails[] = [];
  const seenConversationIds = new Set<number>();

  for (let page = 1; page <= MAX_CONVERSATION_PAGES; page += 1) {
    const response = await client.listConversations(accountId, {
      status: 'pending',
      inboxId,
      page,
    });
    const rows = response.data?.payload || [];

    for (const conversation of rows) {
      if (!seenConversationIds.has(conversation.id)) {
        seenConversationIds.add(conversation.id);
        conversations.push(conversation);
      }
    }

    const allCount = response.data?.meta?.all_count;
    if (!rows.length || (typeof allCount === 'number' && conversations.length >= allCount)) {
      break;
    }
  }

  return conversations;
}

export async function runChatwootHandoffAudit({
  client,
  accountId,
  inboxId,
  dryRun = false,
  now = new Date(),
  staleIncomingMs = DEFAULT_STALE_INCOMING_MS,
}: {
  client: ChatwootClient;
  accountId: number;
  inboxId: number;
  dryRun?: boolean;
  now?: Date;
  staleIncomingMs?: number;
}): Promise<ChatwootHandoffAuditSummary> {
  const pendingConversations = await listAllPendingConversations(client, accountId, inboxId);
  const summary: ChatwootHandoffAuditSummary = {
    scanned: pendingConversations.length,
    candidates: 0,
    recovered: 0,
    wouldRecover: 0,
    skippedAfterReadBack: 0,
    failures: [],
  };

  for (const snapshot of pendingConversations) {
    if (!classifyAuditCandidate(snapshot, now.getTime(), staleIncomingMs)) continue;
    summary.candidates += 1;

    try {
      const current = await client.getConversationDetails(accountId, snapshot.id);
      const reason = classifyAuditCandidate(current, now.getTime(), staleIncomingMs);
      if (!reason) {
        summary.skippedAfterReadBack += 1;
        continue;
      }

      if (dryRun) {
        summary.wouldRecover += 1;
        continue;
      }

      const verification = await ensureChatwootHumanHandoffVisibility({
        client,
        accountId,
        conversationId: snapshot.id,
        currentStatus: current.status,
      });
      summary.recovered += 1;

      console.warn('[chatwoot/handoff-audit] recovered hidden conversation', {
        accountId,
        inboxId,
        conversationId: snapshot.id,
        reason,
        attempts: verification.attempts,
      });
    } catch (error) {
      summary.failures.push({
        conversationId: snapshot.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

