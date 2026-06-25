import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatwootComposerJsonBody,
  getChatwootConversationReplyError,
  getChatwootComposerText,
  isFailedChatwootDeliveryStatus,
  isAllowedChatwootComposerAttachment,
} from "@/lib/staff-chatwoot-composer";

test("Chatwoot composer trims message text and limits length", () => {
  assert.equal(getChatwootComposerText("  你好  "), "你好");
  assert.equal(getChatwootComposerText("x".repeat(2001)), null);
});

test("Chatwoot composer builds outgoing public JSON message", () => {
  assert.deepEqual(buildChatwootComposerJsonBody("你好"), {
    content: "你好",
    message_type: "outgoing",
    private: false,
  });
});

test("Chatwoot composer allows common image attachments only", () => {
  assert.equal(isAllowedChatwootComposerAttachment({ type: "image/png", size: 1024 }), true);
  assert.equal(isAllowedChatwootComposerAttachment({ type: "image/jpeg", size: 1024 }), true);
  assert.equal(isAllowedChatwootComposerAttachment({ type: "application/pdf", size: 1024 }), false);
  assert.equal(isAllowedChatwootComposerAttachment({ type: "image/png", size: 10 * 1024 * 1024 + 1 }), false);
});

test("Chatwoot composer blocks conversations where WhatsApp cannot receive free text", () => {
  assert.match(
    getChatwootConversationReplyError({ status: "resolved", can_reply: false }) || "",
    /24 小時|template/,
  );
  assert.equal(getChatwootConversationReplyError({ status: "open", can_reply: true }), null);
});

test("Chatwoot composer treats failed delivery status as not sent", () => {
  assert.equal(isFailedChatwootDeliveryStatus("failed"), true);
  assert.equal(isFailedChatwootDeliveryStatus("sent"), false);
  assert.equal(isFailedChatwootDeliveryStatus(null), false);
});
