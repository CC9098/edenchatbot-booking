import assert from "node:assert/strict";
import test from "node:test";

import type { RawChatwootHistoryMessage } from "@/lib/staff-chatwoot-history";
import {
  CHATWOOT_MAX_MESSAGE_ID,
  CHATWOOT_MESSAGE_PAGE_SIZE,
  buildChatwootContactConversationFilterBody,
  getChatwootMessagePageState,
  parseChatwootBeforeCursor,
} from "@/lib/staff-chatwoot-history-pagination";

function rawMessage(id: number): RawChatwootHistoryMessage {
  return {
    id,
    message_type: 0,
    created_at: 1_782_384_272,
  };
}

test("builds a contact-scoped Chatwoot conversation filter for each page", () => {
  assert.deepEqual(buildChatwootContactConversationFilterBody(321, 3), {
    page: 3,
    payload: [
      {
        attribute_key: "contact_id",
        filter_operator: "equal_to",
        values: [321],
        query_operator: null,
      },
    ],
  });
});

test("accepts only positive safe-integer before cursors", () => {
  assert.deepEqual(parseChatwootBeforeCursor(null), { valid: true, value: null });
  assert.deepEqual(parseChatwootBeforeCursor(" 123 "), { valid: true, value: 123 });
  assert.deepEqual(parseChatwootBeforeCursor(String(CHATWOOT_MAX_MESSAGE_ID)), {
    valid: true,
    value: CHATWOOT_MAX_MESSAGE_ID,
  });

  for (const value of ["", "0", "-1", "1.5", "abc", "2147483648", "9007199254740992"]) {
    assert.deepEqual(parseChatwootBeforeCursor(value), { valid: false, value: null }, value);
  }
});

test("uses the oldest raw message id as the next cursor and marks a full page as paginable", () => {
  const rawMessages = Array.from({ length: CHATWOOT_MESSAGE_PAGE_SIZE }, (_, index) => rawMessage(200 - index));

  assert.deepEqual(getChatwootMessagePageState(rawMessages), {
    nextBefore: 181,
    hasMore: true,
  });
});

test("does not claim more history for a short page or a non-progressing cursor", () => {
  assert.deepEqual(getChatwootMessagePageState([rawMessage(101)]), {
    nextBefore: 101,
    hasMore: false,
  });

  const fullPage = Array.from({ length: CHATWOOT_MESSAGE_PAGE_SIZE }, (_, index) => rawMessage(200 - index));
  assert.deepEqual(getChatwootMessagePageState(fullPage, 181), {
    nextBefore: 181,
    hasMore: false,
  });
});

test("keeps the raw cursor moving even when the oldest rows are hidden from staff history", () => {
  const rawMessages: RawChatwootHistoryMessage[] = [
    ...Array.from({ length: CHATWOOT_MESSAGE_PAGE_SIZE - 2 }, (_, index) => rawMessage(300 - index)),
    { id: 2, message_type: 2, created_at: 1_782_384_270 },
    { id: 1, message_type: 1, private: true, created_at: 1_782_384_269 },
  ];

  assert.deepEqual(getChatwootMessagePageState(rawMessages), {
    nextBefore: 1,
    hasMore: true,
  });
});

test("stops safely when a raw page has no usable message ids", () => {
  const rawMessages = Array.from({ length: CHATWOOT_MESSAGE_PAGE_SIZE }, () => ({
    message_type: 2,
    created_at: 1_782_384_272,
  }));

  assert.deepEqual(getChatwootMessagePageState(rawMessages), {
    nextBefore: null,
    hasMore: false,
  });
});
