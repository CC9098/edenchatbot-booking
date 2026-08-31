import type { RawChatwootHistoryMessage } from "@/lib/staff-chatwoot-history";

export const CHATWOOT_MESSAGE_PAGE_SIZE = 20;
export const CHATWOOT_MAX_MESSAGE_ID = 2_147_483_647;

export function buildChatwootContactConversationFilterBody(contactId: number, page: number) {
  return {
    page,
    payload: [
      {
        attribute_key: "contact_id",
        filter_operator: "equal_to",
        values: [contactId],
        query_operator: null,
      },
    ],
  };
}

export function parseChatwootBeforeCursor(value: string | null): {
  valid: boolean;
  value: number | null;
} {
  if (value === null) return { valid: true, value: null };

  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return { valid: false, value: null };

  const parsed = Number(trimmed);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    parsed > CHATWOOT_MAX_MESSAGE_ID
  ) {
    return { valid: false, value: null };
  }
  return { valid: true, value: parsed };
}

export function getChatwootMessagePageState(
  rawMessages: RawChatwootHistoryMessage[],
  before: number | null = null,
): {
  nextBefore: number | null;
  hasMore: boolean;
} {
  const validIds = rawMessages
    .map((message) => message.id)
    .filter((id): id is number => Boolean(id && Number.isSafeInteger(id) && id > 0));
  const nextBefore = validIds.length > 0 ? Math.min(...validIds) : null;

  return {
    nextBefore,
    hasMore:
      rawMessages.length >= CHATWOOT_MESSAGE_PAGE_SIZE &&
      nextBefore !== null &&
      (before === null || nextBefore < before),
  };
}
