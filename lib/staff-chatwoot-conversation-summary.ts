import type { RawChatwootHistoryMessage } from "@/lib/staff-chatwoot-history";
import {
  getChatwootConversationLastActivityAt,
  normalizeChatwootTimestamp,
  parseChatwootTimestamp,
  type ChatwootConversationFreshness,
  type ChatwootConversationTimestampInput,
} from "@/lib/staff-chatwoot-conversation-freshness";

export type ChatwootConversationSummaryInput = ChatwootConversationTimestampInput & {
  id?: number;
  last_non_activity_message?: Pick<
    RawChatwootHistoryMessage,
    "id" | "created_at" | "message_type" | "private"
  > | null;
};

function isIncomingMessageType(value: RawChatwootHistoryMessage["message_type"]): boolean {
  return value === 0 || value === "incoming";
}

function isVisibleMessageType(value: RawChatwootHistoryMessage["message_type"]): boolean {
  return isIncomingMessageType(value) || value === 1 || value === "outgoing";
}

function getVisibleSummaryMessage(conversation: ChatwootConversationSummaryInput) {
  const message = conversation.last_non_activity_message;
  if (!message || message.private === true || !isVisibleMessageType(message.message_type)) {
    return null;
  }

  return message;
}

export function getChatwootConversationSummaryFreshness(
  conversation: ChatwootConversationSummaryInput,
): ChatwootConversationFreshness {
  const lastActivityAt = getChatwootConversationLastActivityAt(conversation);
  const summaryMessage = getVisibleSummaryMessage(conversation);
  const latestVisibleMessageAt = normalizeChatwootTimestamp(summaryMessage?.created_at);
  const latestIncomingMessageAt = isIncomingMessageType(summaryMessage?.message_type)
    ? latestVisibleMessageAt
    : null;
  const lastActivityTimestamp = parseChatwootTimestamp(lastActivityAt);
  const latestVisibleTimestamp = parseChatwootTimestamp(latestVisibleMessageAt);

  return {
    lastActivityAt,
    latestVisibleMessageAt,
    latestIncomingMessageAt,
    activityOnlySinceLastVisible:
      lastActivityTimestamp !== null &&
      (latestVisibleTimestamp === null || lastActivityTimestamp > latestVisibleTimestamp),
  };
}

export function compareChatwootConversationSummaries(
  a: ChatwootConversationSummaryInput,
  b: ChatwootConversationSummaryInput,
): number {
  const bMessageTime = parseChatwootTimestamp(getVisibleSummaryMessage(b)?.created_at) ?? -Infinity;
  const aMessageTime = parseChatwootTimestamp(getVisibleSummaryMessage(a)?.created_at) ?? -Infinity;
  if (aMessageTime !== bMessageTime) return bMessageTime - aMessageTime;

  const bActivityTime = parseChatwootTimestamp(getChatwootConversationLastActivityAt(b)) ?? -Infinity;
  const aActivityTime = parseChatwootTimestamp(getChatwootConversationLastActivityAt(a)) ?? -Infinity;
  if (aActivityTime !== bActivityTime) return bActivityTime - aActivityTime;
  return (b.id || 0) - (a.id || 0);
}
