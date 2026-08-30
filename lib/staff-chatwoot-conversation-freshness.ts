/**
 * Chatwoot usually returns Unix seconds, while a few endpoints and fixtures
 * return milliseconds or ISO strings. Normalize them before comparing rows.
 */
export type ChatwootTimestampValue = number | string | null | undefined;

export type ChatwootConversationTimestampInput = {
  last_activity_at?: ChatwootTimestampValue;
  updated_at?: ChatwootTimestampValue;
  created_at?: ChatwootTimestampValue;
};

export type ChatwootFreshnessMessage = {
  direction?: "incoming" | "outgoing" | string | null;
  createdAt?: ChatwootTimestampValue;
};

export type ChatwootConversationFreshness = {
  lastActivityAt: string | null;
  latestVisibleMessageAt: string | null;
  latestIncomingMessageAt: string | null;
  activityOnlySinceLastVisible: boolean;
};

const MAX_DATE_MS = 8.64e15;
const MILLISECONDS_TIMESTAMP_THRESHOLD = 100_000_000_000;

export function parseChatwootTimestamp(value: ChatwootTimestampValue): number | null {
  let timestampMs: number;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    timestampMs = toEpochMilliseconds(value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      timestampMs = toEpochMilliseconds(numericValue);
    } else {
      timestampMs = Date.parse(trimmed);
      if (!Number.isFinite(timestampMs)) return null;
    }
  } else {
    return null;
  }

  if (!Number.isFinite(timestampMs) || Math.abs(timestampMs) > MAX_DATE_MS) return null;
  return timestampMs;
}

export function normalizeChatwootTimestamp(value: ChatwootTimestampValue): string | null {
  const timestampMs = parseChatwootTimestamp(value);
  if (timestampMs === null) return null;

  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function getChatwootConversationLastActivityAt(
  conversation: ChatwootConversationTimestampInput,
): string | null {
  for (const value of [
    conversation.last_activity_at,
    conversation.updated_at,
    conversation.created_at,
  ]) {
    const normalized = normalizeChatwootTimestamp(value);
    if (normalized) return normalized;
  }

  return null;
}

function toEpochMilliseconds(value: number): number {
  return Math.abs(value) < MILLISECONDS_TIMESTAMP_THRESHOLD ? value * 1000 : value;
}

function latestMessageTimestamp(
  messages: ReadonlyArray<ChatwootFreshnessMessage>,
  predicate?: (message: ChatwootFreshnessMessage) => boolean,
): number | null {
  let latest: number | null = null;

  for (const message of messages) {
    if (predicate && !predicate(message)) continue;

    const timestamp = parseChatwootTimestamp(message.createdAt);
    if (timestamp === null || (latest !== null && timestamp <= latest)) continue;
    latest = timestamp;
  }

  return latest;
}

function toIsoOrNull(timestamp: number | null): string | null {
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function getChatwootConversationFreshness(
  conversation: ChatwootConversationTimestampInput,
  visibleMessages: ReadonlyArray<ChatwootFreshnessMessage>,
): ChatwootConversationFreshness {
  const lastActivityAt = getChatwootConversationLastActivityAt(conversation);
  const lastActivityTimestamp = parseChatwootTimestamp(lastActivityAt);
  const latestVisibleTimestamp = latestMessageTimestamp(visibleMessages);
  const latestIncomingTimestamp = latestMessageTimestamp(
    visibleMessages,
    (message) => message.direction === "incoming",
  );

  return {
    lastActivityAt,
    latestVisibleMessageAt: toIsoOrNull(latestVisibleTimestamp),
    latestIncomingMessageAt: toIsoOrNull(latestIncomingTimestamp),
    activityOnlySinceLastVisible:
      lastActivityTimestamp !== null &&
      (latestVisibleTimestamp === null || lastActivityTimestamp > latestVisibleTimestamp),
  };
}

type SortableConversation = ChatwootConversationFreshness & { id?: number };

function compareDescending(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/**
 * Prefer real patient activity. Reopening or assigning an old conversation
 * must not make it look newer than a conversation with a newer patient reply.
 */
export function compareChatwootConversationFreshness(
  a: SortableConversation,
  b: SortableConversation,
): number {
  const incomingComparison = compareDescending(
    parseChatwootTimestamp(a.latestIncomingMessageAt),
    parseChatwootTimestamp(b.latestIncomingMessageAt),
  );
  if (incomingComparison !== 0) return incomingComparison;

  const visibleComparison = compareDescending(
    parseChatwootTimestamp(a.latestVisibleMessageAt),
    parseChatwootTimestamp(b.latestVisibleMessageAt),
  );
  if (visibleComparison !== 0) return visibleComparison;

  const activityComparison = compareDescending(
    parseChatwootTimestamp(a.lastActivityAt),
    parseChatwootTimestamp(b.lastActivityAt),
  );
  if (activityComparison !== 0) return activityComparison;

  return (b.id || 0) - (a.id || 0);
}
