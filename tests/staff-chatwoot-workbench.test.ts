import assert from "node:assert/strict";
import test from "node:test";

import {
  appendChatwootWorkbenchMessage,
  canReplyToChatwootWorkbenchConversation,
  getChatwootWorkbenchComposerMode,
  getChatwootWorkbenchConversationStatusLabel,
  getChatwootWorkbenchScrollKey,
  resolveChatwootWorkbenchReplyParent,
  type StaffChatwootWorkbenchConversation,
} from "@/lib/staff-chatwoot-workbench";

const conversations: StaffChatwootWorkbenchConversation[] = [
  {
    id: 841,
    status: "open",
    messages: [
      {
        id: 10,
        direction: "incoming",
        content: "你好",
        createdAt: "2026-06-25T10:44:32.000Z",
        status: null,
        sourceId: null,
        attachments: [],
      },
    ],
  },
];

test("appends a sent Chatwoot message into the active workbench conversation", () => {
  const result = appendChatwootWorkbenchMessage(conversations, 841, {
    id: 11,
    direction: "outgoing",
    content: "已收到",
    createdAt: "2026-06-25T10:45:00.000Z",
    status: "sent",
    sourceId: "wamid.123",
    attachments: [],
  });

  assert.equal(result[0]?.messages.length, 2);
  assert.equal(result[0]?.messages.at(-1)?.content, "已收到");
});

test("does not duplicate a Chatwoot message that is already visible", () => {
  const result = appendChatwootWorkbenchMessage(conversations, 841, conversations[0]!.messages[0]!);

  assert.equal(result[0]?.messages.length, 1);
});

test("changes scroll key when the active conversation receives a new message", () => {
  const before = getChatwootWorkbenchScrollKey(conversations, 841);
  const after = getChatwootWorkbenchScrollKey(
    appendChatwootWorkbenchMessage(conversations, 841, {
      id: 12,
      direction: "outgoing",
      content: "一陣覆你",
      createdAt: "2026-06-25T10:46:00.000Z",
      status: "sent",
      sourceId: "wamid.124",
      attachments: [],
    }),
    841,
  );

  assert.notEqual(after, before);
  assert.equal(after, "841:2:12");
});

test("translates Chatwoot internal conversation status for staff", () => {
  assert.equal(getChatwootWorkbenchConversationStatusLabel({ status: "resolved", canReply: false }), "已關閉");
  assert.equal(getChatwootWorkbenchConversationStatusLabel({ status: "open", canReply: true }), "可回覆");
  assert.equal(canReplyToChatwootWorkbenchConversation({ status: "resolved", canReply: false }), false);
  assert.equal(canReplyToChatwootWorkbenchConversation({ status: "open", canReply: true }), true);
});

test("uses template composer mode when a WhatsApp conversation is closed", () => {
  assert.equal(getChatwootWorkbenchComposerMode({ status: "resolved", canReply: false }), "template");
  assert.equal(getChatwootWorkbenchComposerMode({ status: "open", canReply: true }), "direct");
});

test("resolves a quoted parent by internal id before source id fallback", () => {
  const parentByInternalId = {
    id: 20,
    direction: "incoming" as const,
    content: "第一句",
    createdAt: null,
    status: null,
    sourceId: "wamid.first",
    replyToMessageId: null,
    replyToExternalId: null,
    attachments: [],
  };
  const parentByExternalId = {
    ...parentByInternalId,
    id: 21,
    content: "第二句",
    sourceId: "wamid.second",
  };
  const reply = {
    ...parentByInternalId,
    id: 22,
    content: "覆你",
    sourceId: "wamid.reply",
    replyToMessageId: 20,
    replyToExternalId: "wamid.second",
  };

  assert.equal(
    resolveChatwootWorkbenchReplyParent(
      { messages: [parentByInternalId, parentByExternalId, reply] },
      reply,
    ),
    parentByInternalId,
  );

  const fallbackReply = { ...reply, id: 23, replyToMessageId: 999 };
  assert.equal(
    resolveChatwootWorkbenchReplyParent(
      { messages: [parentByInternalId, parentByExternalId, fallbackReply] },
      fallbackReply,
    ),
    parentByExternalId,
  );
});

test("does not resolve a missing parent outside the supplied conversation", () => {
  const reply = {
    id: 30,
    direction: "incoming" as const,
    content: "覆你",
    createdAt: null,
    status: null,
    sourceId: null,
    replyToMessageId: 999,
    replyToExternalId: "wamid.missing",
    attachments: [],
  };

  assert.equal(
    resolveChatwootWorkbenchReplyParent({ messages: [reply] }, reply),
    null,
  );
});

test("resolves an attachment-only quoted parent", () => {
  const attachmentParent = {
    id: 40,
    direction: "incoming" as const,
    content: "",
    createdAt: null,
    status: null,
    sourceId: "wamid.attachment",
    replyToMessageId: null,
    replyToExternalId: null,
    attachments: [
      {
        id: 41,
        fileType: "file",
        url: "https://example.test/photo.jpg",
        label: "jpg",
      },
    ],
  };
  const reply = {
    ...attachmentParent,
    id: 42,
    content: "呢張相",
    sourceId: null,
    replyToExternalId: "wamid.attachment",
    attachments: [],
  };

  const parent = resolveChatwootWorkbenchReplyParent(
    { messages: [attachmentParent, reply] },
    reply,
  );

  assert.equal(parent, attachmentParent);
  assert.equal(parent?.content, "");
  assert.equal(parent?.attachments[0]?.label, "jpg");
});
