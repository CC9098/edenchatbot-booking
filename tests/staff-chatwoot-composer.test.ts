import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatwootComposerJsonBody,
  getChatwootComposerText,
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
