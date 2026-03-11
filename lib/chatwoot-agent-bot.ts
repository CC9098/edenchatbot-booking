import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LegacyChatMessage } from '@/lib/legacy-chat-response';

export const CHATWOOT_MAIN_MENU_MESSAGE = `你好，呢度係醫天圓中醫診所。請問有咩可以幫到你？
1. 一般查詢
2. 預約
3. 想搵姑娘`;

export const CHATWOOT_GENERAL_INQUIRY_PROMPT =
  '可以呀，請直接講你想問嘅內容，我會盡快幫你。';

export const CHATWOOT_BOOKING_ACK =
  '收到，你想查預約。我先記低，你可以等姑娘跟進。';

export const CHATWOOT_HUMAN_ACK =
  '好，我幫你轉交姑娘跟進，請稍等。';

export const CHATWOOT_FLOW_STATE_ATTRIBUTE = 'eden_flow_state';
export const CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE = 'eden_last_incoming_message_id';

export type ChatwootFlowState = 'menu' | 'general_ai' | 'booking' | 'human';

export interface ChatwootIncomingEvent {
  accountId: number;
  conversationId: number;
  messageId: number;
  content: string;
}

interface ChatwootMessage {
  id?: number;
  content?: string | null;
  created_at?: number;
  private?: boolean;
  sender_type?: string | null;
}

interface ChatwootConversationDetails {
  id: number;
  custom_attributes?: Record<string, unknown> | null;
  messages?: ChatwootMessage[];
}

type MenuSelectionKind = 'general_ai' | 'booking' | 'human';

export class ChatwootClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiAccessToken: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        api_access_token: this.apiAccessToken,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[Chatwoot] ${response.status} ${response.statusText}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  getConversationDetails(accountId: number, conversationId: number) {
    return this.request<ChatwootConversationDetails>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
      { method: 'GET' },
    );
  }

  createMessage(accountId: number, conversationId: number, content: string) {
    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          message_type: 'outgoing',
          private: false,
        }),
      },
    );
  }

  updateConversationCustomAttributes(
    accountId: number,
    conversationId: number,
    customAttributes: Record<string, unknown>,
  ) {
    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/custom_attributes`,
      {
        method: 'POST',
        body: JSON.stringify({
          custom_attributes: customAttributes,
        }),
      },
    );
  }
}

export function createChatwootClientFromEnv(): ChatwootClient {
  const baseUrl = (process.env.CHATWOOT_BASE_URL || '').trim().replace(/\/$/, '');
  const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();

  if (!baseUrl) {
    throw new Error('CHATWOOT_BASE_URL is not configured');
  }

  if (!apiAccessToken) {
    throw new Error('CHATWOOT_API_ACCESS_TOKEN is not configured');
  }

  return new ChatwootClient(baseUrl, apiAccessToken);
}

export function verifyChatwootSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.trim().replace(/^sha256=/i, '');

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function extractIncomingChatwootEvent(payload: unknown): ChatwootIncomingEvent | null {
  if (!payload || typeof payload !== 'object') return null;

  const row = payload as Record<string, unknown>;
  const event = typeof row.event === 'string' ? row.event : '';
  const messageType = row.message_type;
  const privateFlag = row.private;
  const content = typeof row.content === 'string' ? row.content.trim() : '';
  const sender = row.sender;
  const senderType = sender && typeof sender === 'object'
    ? ((sender as Record<string, unknown>).type ?? (sender as Record<string, unknown>).sender_type)
    : null;
  const conversation = row.conversation;
  const account = row.account;
  const messageId = typeof row.id === 'number' ? row.id : Number(row.id);
  const accountId = account && typeof account === 'object'
    ? Number((account as Record<string, unknown>).id)
    : NaN;
  const conversationId = conversation && typeof conversation === 'object'
    ? Number((conversation as Record<string, unknown>).id)
    : NaN;

  const isIncoming =
    messageType === 'incoming' ||
    messageType === 0 ||
    messageType === '0';

  const normalizedSenderType = typeof senderType === 'string' ? senderType.toLowerCase() : '';
  const senderIsSupportedContact = !normalizedSenderType || normalizedSenderType === 'contact';

  if (
    event !== 'message_created' ||
    !isIncoming ||
    privateFlag === true ||
    !content ||
    !senderIsSupportedContact ||
    !Number.isFinite(accountId) ||
    !Number.isFinite(conversationId) ||
    !Number.isFinite(messageId)
  ) {
    return null;
  }

  return {
    accountId,
    conversationId,
    messageId,
    content,
  };
}

export function getFlowState(customAttributes: Record<string, unknown> | null | undefined): ChatwootFlowState {
  const value = typeof customAttributes?.[CHATWOOT_FLOW_STATE_ATTRIBUTE] === 'string'
    ? customAttributes[CHATWOOT_FLOW_STATE_ATTRIBUTE]
    : '';

  if (value === 'general_ai' || value === 'booking' || value === 'human') {
    return value;
  }

  return 'menu';
}

export function isDuplicateIncomingMessage(
  customAttributes: Record<string, unknown> | null | undefined,
  messageId: number,
): boolean {
  return String(customAttributes?.[CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE] ?? '') === String(messageId);
}

export function mergeFlowAttributes(
  currentAttributes: Record<string, unknown> | null | undefined,
  nextState: ChatwootFlowState,
  messageId: number,
): Record<string, unknown> {
  return {
    ...(currentAttributes || {}),
    [CHATWOOT_FLOW_STATE_ATTRIBUTE]: nextState,
    [CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE]: String(messageId),
  };
}

export function resolveMenuSelection(content: string): { kind: MenuSelectionKind; remainder: string } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const patterns: Array<{ kind: MenuSelectionKind; pattern: RegExp }> = [
    { kind: 'general_ai', pattern: /^(?:1(?:[.)、\s-]|$)|一般查詢(?:[:：\s-]|$)|一般查询(?:[:：\s-]|$))/u },
    { kind: 'booking', pattern: /^(?:2(?:[.)、\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u },
    { kind: 'human', pattern: /^(?:3(?:[.)、\s-]|$)|想搵姑娘(?:[:：\s-]|$)|姑娘(?:[:：\s-]|$)|真人(?:[:：\s-]|$))/u },
  ];

  for (const { kind, pattern } of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    const remainder = trimmed.slice(match[0].length).trim();
    return { kind, remainder };
  }

  return null;
}

export function mapConversationMessagesToLegacyChat(
  messages: ChatwootMessage[] | undefined,
): LegacyChatMessage[] {
  return (messages || [])
    .filter((message) => {
      const content = message.content?.trim();
      if (!content || message.private) return false;
      if (content === CHATWOOT_GENERAL_INQUIRY_PROMPT) return false;
      if (content === CHATWOOT_BOOKING_ACK) return false;
      if (content === CHATWOOT_HUMAN_ACK) return false;
      if (content === CHATWOOT_MAIN_MENU_MESSAGE) return false;
      if (isPureGeneralInquirySelection(content)) return false;
      return true;
    })
    .sort((left, right) => (left.created_at || 0) - (right.created_at || 0))
    .slice(-12)
    .map((message) => ({
      role: message.sender_type === 'contact' ? 'user' : 'assistant',
      content: message.content!.trim(),
    }));
}

export function replaceLatestUserMessage(
  messages: LegacyChatMessage[],
  userMessage: string,
): LegacyChatMessage[] {
  const normalized = userMessage.trim();
  if (!normalized) return messages;

  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index]?.role !== 'user') continue;

    nextMessages[index] = {
      ...nextMessages[index],
      content: normalized,
    };
    return nextMessages;
  }

  nextMessages.push({ role: 'user', content: normalized });
  return nextMessages;
}

function isPureGeneralInquirySelection(content: string): boolean {
  const selection = resolveMenuSelection(content);
  return selection?.kind === 'general_ai' && !selection.remainder;
}
