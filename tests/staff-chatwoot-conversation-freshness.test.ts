import assert from "node:assert/strict";
import test from "node:test";

import {
  compareChatwootConversationFreshness,
  getChatwootConversationFreshness,
  getChatwootConversationLastActivityAt,
  normalizeChatwootTimestamp,
  parseChatwootTimestamp,
} from "@/lib/staff-chatwoot-conversation-freshness";

test("parses Chatwoot seconds, milliseconds, and ISO timestamps", () => {
  assert.equal(parseChatwootTimestamp(1_700_000_000), 1_700_000_000_000);
  assert.equal(parseChatwootTimestamp("1700000000000"), 1_700_000_000_000);
  assert.equal(parseChatwootTimestamp("2023-11-14T22:13:20.000Z"), 1_700_000_000_000);
  assert.equal(normalizeChatwootTimestamp(" 1700000000 "), "2023-11-14T22:13:20.000Z");
  assert.equal(parseChatwootTimestamp("not-a-timestamp"), null);
});

test("uses the first valid conversation activity fallback", () => {
  assert.equal(
    getChatwootConversationLastActivityAt({
      last_activity_at: "not-a-timestamp",
      updated_at: "1700000001000",
      created_at: "1700000000",
    }),
    "2023-11-14T22:13:21.000Z",
  );
});

test("summarises patient and visible message freshness", () => {
  assert.deepEqual(
    getChatwootConversationFreshness(
      { last_activity_at: "2026-08-30T12:00:00Z" },
      [
        { direction: "incoming", createdAt: "2026-08-30T11:58:00Z" },
        { direction: "outgoing", createdAt: "2026-08-30T11:59:00Z" },
        { direction: "incoming", createdAt: "2026-08-30T11:59:30Z" },
      ],
    ),
    {
      lastActivityAt: "2026-08-30T12:00:00.000Z",
      latestVisibleMessageAt: "2026-08-30T11:59:30.000Z",
      latestIncomingMessageAt: "2026-08-30T11:59:30.000Z",
      activityOnlySinceLastVisible: true,
    },
  );
});

test("does not let newer reopen activity outrank a newer patient message", () => {
  const reopenedOldConversation = {
    id: 10,
    lastActivityAt: "2026-08-30T12:00:00Z",
    latestVisibleMessageAt: "2026-08-30T11:00:00Z",
    latestIncomingMessageAt: "2026-08-30T11:00:00Z",
    activityOnlySinceLastVisible: true,
  };
  const newerPatientConversation = {
    id: 20,
    lastActivityAt: "2026-08-30T11:30:00Z",
    latestVisibleMessageAt: "2026-08-30T11:30:00Z",
    latestIncomingMessageAt: "2026-08-30T11:30:00Z",
    activityOnlySinceLastVisible: false,
  };

  assert.equal(
    [reopenedOldConversation, newerPatientConversation].sort(compareChatwootConversationFreshness)[0]?.id,
    newerPatientConversation.id,
  );
});

test("falls back to visible message time when no incoming message exists", () => {
  const conversations = [
    {
      id: 1,
      lastActivityAt: "2026-08-30T10:00:00Z",
      latestVisibleMessageAt: "2026-08-30T10:00:00Z",
      latestIncomingMessageAt: null,
      activityOnlySinceLastVisible: false,
    },
    {
      id: 2,
      lastActivityAt: "2026-08-30T09:00:00Z",
      latestVisibleMessageAt: "2026-08-30T09:00:00Z",
      latestIncomingMessageAt: null,
      activityOnlySinceLastVisible: false,
    },
  ];

  assert.deepEqual(
    conversations.sort(compareChatwootConversationFreshness).map((conversation) => conversation.id),
    [1, 2],
  );
});
