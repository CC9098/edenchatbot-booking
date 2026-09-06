import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeEdenConversation,
  normalizeEdenMessages,
  mergeEdenMessages,
  matchesConversationView,
  validateConversationAttachment,
  type RawEdenConversation,
  type RawEdenMessage,
} from "@/lib/eden-conversations";
import {
  getConversation,
  listConversations,
  sendConversationMessage,
  updateConversation,
  type ConversationContext,
} from "@/lib/eden-conversations-server";

const actor = {
  id: "staff-a",
  name: "測試姑娘",
  role: "assistant",
  agentId: 7,
};
const ctx: ConversationContext = {
  actor,
  accountId: 2,
  baseUrl: "https://chatwoot.invalid",
  token: "synthetic-test-token",
  agents: [
    { id: 7, name: actor.name },
    { id: 8, name: "測試醫師", role: "administrator" },
  ],
  inboxes: [{ id: 2, name: "測試診所", channel_type: "Channel::Whatsapp" }],
};
const incoming: RawEdenMessage = {
  id: 100,
  message_type: 0,
  content: "想改期",
  created_at: 1788516000,
  private: false,
};
function conversation(): RawEdenConversation {
  return {
    id: 42,
    account_id: 2,
    inbox_id: 2,
    status: "open",
    can_reply: true,
    unread_count: 1,
    messages: [incoming],
    meta: { sender: { id: 4, name: "測試病人", phone_number: "+85200000000" } },
    custom_attributes: {
      eden_flow_state: "human",
      eden_last_incoming_message_id: 100,
    },
  };
}

test("unread is per staff member and remains separate from workflow completion", () => {
  const raw = conversation();
  raw.custom_attributes!.eden_read_staffb = 100;
  assert.equal(normalizeEdenConversation(raw, actor).unread, true);
  raw.custom_attributes!.eden_read_staffa = 100;
  const read = normalizeEdenConversation(raw, actor);
  assert.equal(read.unread, false);
  assert.equal(read.stage, "reply");
});
test("first Eden visit inherits existing read history and then keeps a personal cursor", () => {
  const raw = conversation();
  raw.status = "resolved";
  raw.unread_count = 0;
  assert.equal(normalizeEdenConversation(raw, actor).unread, false);
  raw.unread_count = 1;
  assert.equal(normalizeEdenConversation(raw, actor).unread, true);
  raw.unread_count = 0;
  raw.custom_attributes!.eden_read_staffa = 99;
  assert.equal(normalizeEdenConversation(raw, actor).unread, true);
});
test("new patient message reopens waiting-for-patient state but keeps doctor handoff visible", () => {
  const raw = conversation();
  raw.custom_attributes!.eden_workspace = {
    stage: "patient",
    lastIncomingId: 99,
  };
  assert.equal(normalizeEdenConversation(raw, actor).stage, "reply");
  raw.custom_attributes!.eden_workspace.stage = "doctor";
  assert.equal(normalizeEdenConversation(raw, actor).stage, "doctor");
  raw.status = "resolved";
  assert.equal(normalizeEdenConversation(raw, actor).stage, "done");
});
test("private notes stay private and sent-message actor comes from Eden metadata", () => {
  const messages = normalizeEdenMessages([
    incoming,
    {
      id: 101,
      private: true,
      message_type: 1,
      content: "請追醫師",
      sender: { name: "Service" },
      content_attributes: {
        eden_workspace: { actor: "阿欣", actorId: "staff-a" },
      },
    },
  ]);
  assert.equal(messages[0].private, false);
  assert.equal(messages[1].private, true);
  assert.equal(messages[1].senderName, "阿欣");
  assert.equal(
    normalizeEdenMessages([{ id: 3, message_type: 2, content: "activity" }])
      .length,
    0,
  );
});
test("delivery changes update an existing message without duplicating loaded history", () => {
  const a = normalizeEdenMessages([{ ...incoming, id: 101, status: "sent" }]);
  const b = normalizeEdenMessages([{ ...incoming, id: 101, status: "read" }]);
  assert.deepEqual(
    mergeEdenMessages(a, b).map((m) => [m.id, m.status]),
    [[101, "read"]],
  );
});
test("mine and doctor queues use the real staff and assigned agent identities", () => {
  const raw = conversation();
  raw.custom_attributes!.eden_workspace = {
    ownerId: "staff-a",
    stage: "doctor",
    doctorId: 8,
  };
  const c = normalizeEdenConversation(raw, actor);
  assert.equal(matchesConversationView(c, "mine", actor), true);
  assert.equal(
    matchesConversationView(c, "mine", {
      ...actor,
      id: "staff-b",
      agentId: null,
    }),
    false,
  );
  assert.equal(matchesConversationView(c, "doctor", actor), true);
});
test("WhatsApp attachment formats and size limits are checked before a send", () => {
  assert.equal(
    validateConversationAttachment({
      type: "image/jpeg",
      size: 4 * 1024 * 1024,
    }),
    null,
  );
  assert.ok(
    validateConversationAttachment({
      type: "image/jpeg",
      size: 4 * 1024 * 1024 + 1,
    }),
  );
  assert.ok(validateConversationAttachment({ type: "image/heic", size: 100 }));
  assert.ok(validateConversationAttachment({ type: "audio/webm", size: 100 }));
  assert.equal(
    validateConversationAttachment({ type: "audio/mp4", size: 1000 }),
    null,
  );
});

async function withChatwoot(
  run: (
    raw: RawEdenConversation,
    messages: RawEdenMessage[],
    calls: { path: string; method: string; body: any }[],
  ) => Promise<void>,
) {
  const previousFetch = global.fetch;
  const raw = conversation();
  const messages = [structuredClone(incoming)];
  const calls: { path: string; method: string; body: any }[] = [];
  global.fetch = async (url, options) => {
    assert.match(
      String(url),
      /^https:\/\/chatwoot\.invalid\/api\/v1\/accounts\/2\//,
    );
    const path = new URL(String(url)).pathname.replace(
      "/api/v1/accounts/2",
      "",
    );
    const method = options?.method || "GET";
    const body =
      typeof options?.body === "string" ? JSON.parse(options.body) : undefined;
    calls.push({ path, method, body });
    let result: unknown;
    if (path === "/conversations/42" && method === "GET") result = raw;
    else if (path === "/conversations/42/custom_attributes") {
      raw.custom_attributes = {
        ...raw.custom_attributes,
        ...body.custom_attributes,
      };
      result = raw.custom_attributes;
    } else if (path === "/conversations/42/toggle_status") {
      raw.status = body.status;
      result = raw;
    } else if (path === "/conversations/42/assignments") {
      raw.meta!.assignee = { id: body.assignee_id, name: "Assigned" };
      result = {};
    } else if (path === "/conversations/42/messages" && method === "POST") {
      const message = {
        id: 100 + messages.length,
        message_type: 1,
        status: "sent",
        ...body,
      };
      messages.push(message);
      result = message;
    } else if (path === "/conversations/42/messages") {
      const before = Number(new URL(String(url)).searchParams.get("before"));
      result = {
        payload: messages.filter((m) => !before || (m.id || 0) < before),
      };
    } else if (path === "/inbox_members/2") result = { payload: [] };
    else if (path === "/conversations")
      result = { data: { payload: [raw, { ...raw, id: 43, inbox_id: 999 }] } };
    else throw new Error(`Unexpected request ${method} ${path}`);
    return Response.json(result);
  };
  try {
    await run(raw, messages, calls);
  } finally {
    global.fetch = previousFetch;
  }
}

test("conversation reads and lists cannot cross the configured WhatsApp inbox", async () =>
  withChatwoot(async (raw) => {
    assert.equal(
      (await listConversations(ctx, { view: "all", page: 1, query: "" }))
        .conversations.length,
      1,
    );
    raw.inbox_id = 999;
    await assert.rejects(getConversation(ctx, 42), /搵唔到/);
  }));
test("stale takeover refuses before assigning, notes or any other mutation", async () =>
  withChatwoot(async (raw, _messages, calls) => {
    raw.custom_attributes!.eden_workspace = {
      revision: "newer",
      ownerId: "staff-b",
    };
    await assert.rejects(
      updateConversation(ctx, raw, { type: "claim", revision: "older" }),
      /同事已更新/,
    );
    assert.equal(calls.length, 0);
  }));
test("takeover opens the human queue and preserves unrelated bot attributes", async () =>
  withChatwoot(async (raw) => {
    raw.status = "pending";
    raw.custom_attributes!.eden_flow_state = "menu";
    raw.custom_attributes!.booking_reference = "keep-me";
    const saved = await updateConversation(ctx, raw, {
      type: "claim",
      revision: "",
    });
    assert.equal(raw.status, "open");
    assert.equal(raw.custom_attributes!.eden_flow_state, "human");
    assert.equal(raw.custom_attributes!.booking_reference, "keep-me");
    assert.equal(saved.state.ownerId, actor.id);
    assert.equal(raw.meta!.assignee?.id, 7);
  }));
test("handover preserves context but releases the old assignee", async () =>
  withChatwoot(async (raw) => {
    const saved = await updateConversation(ctx, raw, {
      type: "handover",
      revision: "",
      summary: "已問醫師",
      nextStep: "下午追覆",
    });
    assert.equal(saved.state.handover?.nextStep, "下午追覆");
    assert.equal(saved.state.ownerId, null);
    assert.equal(raw.meta!.assignee?.id, null);
    assert.equal(saved.stage, "reply");
  }));
test("doctor handoff writes an internal Eden link and assigns the selected doctor", async () => {
  const previous = process.env.CHATWOOT_DOCTOR_AGENT_IDS;
  process.env.CHATWOOT_DOCTOR_AGENT_IDS = "8";
  try {
    await withChatwoot(async (raw, messages) => {
      const saved = await updateConversation(ctx, raw, {
        type: "doctor",
        revision: "",
        doctorId: 8,
      });
      assert.equal(saved.stage, "doctor");
      assert.equal(raw.meta!.assignee?.id, 8);
      assert.equal(messages.at(-1)?.private, true);
      assert.match(messages.at(-1)!.content!, /\/conversations\?id=42/);
    });
  } finally {
    if (previous === undefined) delete process.env.CHATWOOT_DOCTOR_AGENT_IDS;
    else process.env.CHATWOOT_DOCTOR_AGENT_IDS = previous;
  }
});
test("quoted send preserves lines and is read back; same request does not send twice", async () =>
  withChatwoot(async (raw, _messages, calls) => {
    const input = {
      content: "第一行\n第二行",
      private: false,
      replyTo: 100,
      requestId: "5b9c1943-980e-4b64-a515-dab67be6f01e",
    };
    const sent = await sendConversationMessage(
      ctx,
      structuredClone(raw),
      input,
    );
    assert.equal(sent.message.content, input.content);
    assert.equal(sent.message.replyToMessageId, 100);
    assert.equal(sent.message.senderName, actor.name);
    assert.equal(raw.custom_attributes!.eden_workspace!.stage, "patient");
    const again = await sendConversationMessage(ctx, raw, input);
    assert.equal(again.duplicate, true);
    assert.equal(
      calls.filter((c) => c.path.endsWith("/messages") && c.method === "POST")
        .length,
      1,
    );
  }));

test("sent plus provider error does not move work to waiting or cause a duplicate retry", async () =>
  withChatwoot(async (raw, messages, calls) => {
    const mockFetch = global.fetch;
    global.fetch = async (url, options) => {
      const response = await mockFetch(url, options);
      if (String(url).endsWith("/messages") && options?.method === "POST") {
        const message = messages.at(-1)!;
        message.content_attributes = {
          ...message.content_attributes,
          external_error: "131026: Message undeliverable",
        };
        return Response.json(message);
      }
      return response;
    };
    try {
      const input = { content: "測試發送異常", private: false, requestId: "error-readback-test" };
      const sent = await sendConversationMessage(ctx, structuredClone(raw), input);
      assert.equal(sent.message.status, "sent");
      assert.equal(sent.message.deliveryIssue?.code, "131026");
      assert.equal(raw.custom_attributes?.eden_workspace?.stage, undefined);
      assert.equal(calls.some(c => c.path.endsWith("/toggle_status") || c.path.endsWith("/custom_attributes")), false);
      const again = await sendConversationMessage(ctx, raw, input);
      assert.equal(again.duplicate, true);
      assert.equal(again.message.deliveryIssue?.code, "131026");
      assert.equal(calls.filter(c => c.path.endsWith("/messages") && c.method === "POST").length, 1);
    } finally {
      global.fetch = mockFetch;
    }
  }));
test("closed window blocks public text while still allowing internal notes", async () =>
  withChatwoot(async (raw, _messages, calls) => {
    raw.can_reply = false;
    await assert.rejects(
      sendConversationMessage(ctx, raw, {
        content: "hello",
        private: false,
        requestId: "a",
      }),
      /跟進訊息/,
    );
    assert.equal(
      calls.some((c) => c.method === "POST"),
      false,
    );
    const note = await sendConversationMessage(ctx, raw, {
      content: "internal",
      private: true,
      requestId: "b",
    });
    assert.equal(note.message.private, true);
  }));
test("quoting an unrelated message is rejected without a send", async () =>
  withChatwoot(async (raw, _messages, calls) => {
    await assert.rejects(
      sendConversationMessage(ctx, raw, {
        content: "reply",
        private: false,
        replyTo: 999,
        requestId: "c",
      }),
      /引用/,
    );
    assert.equal(
      calls.some((c) => c.method === "POST"),
      false,
    );
  }));
