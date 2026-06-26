import assert from "node:assert/strict";
import test from "node:test";

import {
  appendChatwootWorkbenchMessage,
  canReplyToChatwootWorkbenchConversation,
  getChatwootWorkbenchComposerMode,
  getChatwootWorkbenchConversationStatusLabel,
  getChatwootWorkbenchScrollKey,
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
