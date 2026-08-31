import assert from "node:assert/strict";
import test from "node:test";

import {
  compareChatwootConversationSummaries,
  getChatwootConversationSummaryFreshness,
} from "@/lib/staff-chatwoot-conversation-summary";

test("does not expose or rank a private note as the latest visible message", () => {
  const privateNoteConversation = {
    id: 1,
    last_activity_at: "2026-08-31T12:00:00Z",
    last_non_activity_message: {
      id: 11,
      created_at: "2026-08-31T12:00:00Z",
      message_type: 1,
      private: true,
    },
  };
  const visiblePatientConversation = {
    id: 2,
    last_activity_at: "2026-08-31T11:00:00Z",
    last_non_activity_message: {
      id: 12,
      created_at: "2026-08-31T11:00:00Z",
      message_type: 0,
      private: false,
    },
  };

  assert.deepEqual(getChatwootConversationSummaryFreshness(privateNoteConversation), {
    lastActivityAt: "2026-08-31T12:00:00.000Z",
    latestVisibleMessageAt: null,
    latestIncomingMessageAt: null,
    activityOnlySinceLastVisible: true,
  });
  assert.deepEqual(
    [privateNoteConversation, visiblePatientConversation]
      .sort(compareChatwootConversationSummaries)
      .map((conversation) => conversation.id),
    [2, 1],
  );
});
