import assert from "node:assert/strict";
import test from "node:test";

import { normalizeChatwootHistoryMessages } from "@/lib/staff-chatwoot-history";

test("normalizes visible incoming and outgoing Chatwoot messages", () => {
  assert.deepEqual(
    normalizeChatwootHistoryMessages([
      {
        id: 1,
        content: "你好",
        message_type: 0,
        created_at: 1_782_384_272,
        private: false,
      },
      {
        id: 2,
        content: "已收到",
        message_type: 1,
        created_at: 1_782_384_300,
        private: false,
        status: "read",
        source_id: "wamid.123",
      },
    ]),
    [
      {
        id: 1,
        direction: "incoming",
        content: "你好",
        createdAt: "2026-06-25T10:44:32.000Z",
        status: null,
        sourceId: null,
        replyToMessageId: null,
        replyToExternalId: null,
        attachments: [],
      },
      {
        id: 2,
        direction: "outgoing",
        content: "已收到",
        createdAt: "2026-06-25T10:45:00.000Z",
        status: "read",
        sourceId: "wamid.123",
        replyToMessageId: null,
        replyToExternalId: null,
        attachments: [],
      },
    ],
  );
});

test("hides private notes and system messages from WhatsApp-style history", () => {
  assert.deepEqual(
    normalizeChatwootHistoryMessages([
      {
        id: 3,
        content: "Assigned to Ethel by Automation System",
        message_type: 2,
        created_at: 1_782_384_301,
        private: false,
      },
      {
        id: 4,
        content: "內部備註",
        message_type: 1,
        created_at: 1_782_384_302,
        private: true,
      },
    ]),
    [],
  );
});

test("keeps attachment-only WhatsApp messages", () => {
  assert.deepEqual(
    normalizeChatwootHistoryMessages([
      {
        id: 5,
        content: null,
        message_type: 0,
        created_at: 1_782_384_303,
        private: false,
        attachments: [
          {
            id: 8,
            file_type: "file",
            data_url: "https://example.test/report.pdf",
            extension: "pdf",
          },
        ],
      },
    ]),
    [
      {
        id: 5,
        direction: "incoming",
        content: "",
        createdAt: "2026-06-25T10:45:03.000Z",
        status: null,
        sourceId: null,
        replyToMessageId: null,
        replyToExternalId: null,
        attachments: [
          {
            id: 8,
            fileType: "file",
            url: "https://example.test/report.pdf",
            label: "pdf",
          },
        ],
      },
    ],
  );
});

test("keeps failed outgoing status visible for WhatsApp delivery evidence", () => {
  assert.deepEqual(
    normalizeChatwootHistoryMessages([
      {
        id: 6,
        content: "HI",
        message_type: 1,
        created_at: 1_782_384_304,
        private: false,
        status: "failed",
        source_id: null,
      },
    ]),
    [
      {
        id: 6,
        direction: "outgoing",
        content: "HI",
        createdAt: "2026-06-25T10:45:04.000Z",
        status: "failed",
        sourceId: null,
        replyToMessageId: null,
        replyToExternalId: null,
        attachments: [],
      },
    ],
  );
});

test("normalizes valid quoted-reply references and rejects malformed values", () => {
  const [validReply, malformedReply] = normalizeChatwootHistoryMessages([
    {
      id: 7,
      content: "覆你",
      message_type: 0,
      created_at: 1_782_384_305,
      private: false,
      content_attributes: {
        in_reply_to: " 6 ",
        in_reply_to_external_id: " wamid.parent ",
      },
    },
    {
      id: 8,
      content: "另一句",
      message_type: 0,
      created_at: 1_782_384_306,
      private: false,
      content_attributes: {
        in_reply_to: "not-a-message-id",
        in_reply_to_external_id: "   ",
      },
    },
  ]);

  assert.equal(validReply?.replyToMessageId, 6);
  assert.equal(validReply?.replyToExternalId, "wamid.parent");
  assert.equal(malformedReply?.replyToMessageId, null);
  assert.equal(malformedReply?.replyToExternalId, null);
});
