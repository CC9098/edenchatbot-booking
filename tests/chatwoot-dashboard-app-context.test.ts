import assert from "node:assert/strict";
import test from "node:test";

import {
  parseChatwootDashboardAppEvent,
  selectLatestForwardableMessage,
} from "@/lib/chatwoot-dashboard-app-context";

test("parseChatwootDashboardAppEvent extracts contact and conversation context from Chatwoot JSON strings", () => {
  const context = parseChatwootDashboardAppEvent(JSON.stringify({
    event: "appContext",
    data: {
      conversation: {
        id: 838,
        inbox_id: 2,
        messages: [
          { id: 1, content: "系統訊息", message_type: 1, private: false, created_at: 100 },
          { id: 2, content: "病人想查藥", message_type: 0, private: false, created_at: 200 },
        ],
      },
      contact: {
        id: 326,
        name: "陳小明",
        phone_number: "+85291234567",
      },
      currentAgent: {
        id: 9,
        name: "姑娘",
        email: "nurse@example.com",
      },
    },
  }));

  assert.deepEqual(context, {
    conversationId: 838,
    inboxId: 2,
    contactId: 326,
    contactName: "陳小明",
    contactPhone: "+85291234567",
    currentAgentName: "姑娘",
    currentAgentEmail: "nurse@example.com",
    latestIncomingMessage: "病人想查藥",
  });
});

test("parseChatwootDashboardAppEvent accepts object payloads and falls back to conversation sender", () => {
  const context = parseChatwootDashboardAppEvent({
    event: "appContext",
    data: {
      conversation: {
        id: "901",
        meta: {
          sender: {
            id: "88",
            name: "王大文",
            phone_number: "92345678",
          },
        },
      },
    },
  });

  assert.equal(context?.conversationId, 901);
  assert.equal(context?.contactId, 88);
  assert.equal(context?.contactName, "王大文");
  assert.equal(context?.contactPhone, "92345678");
});

test("selectLatestForwardableMessage ignores private and outgoing messages", () => {
  const message = selectLatestForwardableMessage([
    { content: "內部 note", private: true, message_type: 0, created_at: 300 },
    { content: "姑娘回覆", private: false, message_type: 1, created_at: 400 },
    { content: "最新病人內容", private: false, message_type: "incoming", created_at: 500 },
  ]);

  assert.equal(message, "最新病人內容");
});
