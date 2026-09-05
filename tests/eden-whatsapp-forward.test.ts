import assert from "node:assert/strict";
import test from "node:test";
import {
  getWhatsappForwardDoctors,
  forwardDeliveryLabel,
} from "@/lib/eden-whatsapp-forward";
import {
  previewWhatsappForward,
  sendWhatsappForward,
  downloadForwardAttachment,
  type ForwardLedger,
} from "@/lib/eden-whatsapp-forward-server";
import type { ConversationContext } from "@/lib/eden-conversations-server";
import type {
  RawEdenConversation,
  RawEdenMessage,
} from "@/lib/eden-conversations";

const ctx: ConversationContext = {
  actor: { id: "staff-test", name: "姑娘", role: "assistant", agentId: null },
  accountId: 2,
  baseUrl: "https://chatwoot.invalid",
  token: "test",
  agents: [],
  inboxes: [{ id: 2, name: "Clinic", channel_type: "Channel::Whatsapp" }],
};
const phone = "+85200000001";
const requestId = "10000000-0000-4000-8000-000000000001";
function memoryLedger() {
  const records = new Map<string, any>();
  const ledger: ForwardLedger = {
    async find(id) {
      return records.get(id) || null;
    },
    async claim(record) {
      if (records.has(record.request_id)) return false;
      records.set(record.request_id, { ...record });
      return true;
    },
    async saveMessage(id, messageIds) {
      records.get(id).message_id = messageIds.at(-1);
      records.get(id).message_ids = [...messageIds];
    },
  };
  return { ledger, records };
}
async function fixture(
  run: (f: {
    source: RawEdenConversation;
    target: RawEdenConversation;
    sourceMessages: RawEdenMessage[];
    sent: any[];
    writes: string[];
    ledger: ForwardLedger;
    records: Map<string, any>;
    setLostResponse: () => void;
    setFailed: () => void;
  }) => Promise<void>,
) {
  const originalFetch = global.fetch,
    old = process.env.DOCTOR_FORWARD_WHATSAPP_CHAN;
  process.env.DOCTOR_FORWARD_WHATSAPP_CHAN = phone;
  const source: RawEdenConversation = {
    id: 42,
    account_id: 2,
    inbox_id: 2,
    status: "open",
    meta: { sender: { id: 4, name: "測試病人", phone_number: "+85200000000" } },
  };
  const target: RawEdenConversation = {
    id: 70,
    account_id: 2,
    inbox_id: 2,
    status: "resolved",
    can_reply: true,
    meta: { sender: { id: 7, phone_number: phone } },
  };
  const sourceMessages: RawEdenMessage[] = [
    { id: 100, content: "第一行\n第二行", private: false, message_type: 0 },
  ];
  const sent: any[] = [],
    writes: string[] = [];
  let lost = false,
    failed = false;
  const { ledger, records } = memoryLedger();
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1/accounts/2", "");
    const method = init?.method || "GET";
    if (method !== "GET") writes.push(path);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      });
    if (path === "/conversations/42") return json(source);
    if (path === "/conversations/70") return json(target);
    if (path === "/conversations/42/messages")
      return json({ payload: sourceMessages });
    if (path === "/contacts/search")
      return json({
        payload: [
          { id: 77, phone_number: "+852000000019" },
          { id: 7, phone_number: phone },
        ],
      });
    if (path === "/contacts/7/conversations")
      return json({ payload: [target] });
    if (path === "/inboxes/2")
      return json({
        message_templates: [
          {
            name: "staff_patient_follow_up",
            language: "zh_HK",
            status: "APPROVED",
            components: [
              {
                type: "BODY",
                text: "你好，以下是診所給你的跟進訊息：\n\n{{1}}\n\n如有問題，請直接回覆此 WhatsApp。",
              },
            ],
          },
        ],
      });
    if (path === "/conversations/70/messages") {
      if (method === "POST") {
        let body: any;
        if (init?.body instanceof FormData)
          body = {
            content: init.body.get("content"),
            content_attributes: JSON.parse(
              String(init.body.get("content_attributes")),
            ),
            private: init.body.get("private") === "true",
            fileCount: init.body.getAll("attachments[]").length,
          };
        else body = JSON.parse(String(init?.body));
        sent.push({
          ...body,
          id: 200 + sent.length,
          status: failed ? "failed" : "sent",
        });
        if (lost) throw new Error("Response lost after write");
        return json(sent.at(-1));
      }
      return json({ payload: sent });
    }
    if (
      path === "/conversations/70/custom_attributes" ||
      path === "/conversations/70/toggle_status"
    )
      return json({});
    if (url.pathname === "/rails/active_storage/blobs/test/image.png")
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      });
    throw new Error(`Unexpected fixture request ${method} ${path}`);
  };
  try {
    await run({
      source,
      target,
      sourceMessages,
      sent,
      writes,
      ledger,
      records,
      setLostResponse: () => {
        lost = true;
      },
      setFailed: () => {
        failed = true;
      },
    });
  } finally {
    global.fetch = originalFetch;
    if (old === undefined) delete process.env.DOCTOR_FORWARD_WHATSAPP_CHAN;
    else process.env.DOCTOR_FORWARD_WHATSAPP_CHAN = old;
  }
}
const input = { messageId: 100, doctorId: "chan" };

test("only explicitly configured doctor recipients appear; legacy clinic notification phones are excluded", () => {
  const list = getWhatsappForwardDoctors({
    DOCTOR_FORWARD_WHATSAPP_CHAN: phone,
    DOCTOR_FORWARD_WHATSAPP_LEE: "+85200000002",
    DOCTOR_FORWARD_WHATSAPP_HON: "+85200000003",
    CLINIC_NOTIFICATION_WHATSAPP: "+85200000009",
    CHEUNG_DOCTOR_WHATSAPP: "+85200000008",
    DOCTOR_FORWARD_WHATSAPP_LEUNG: "bad",
  });
  assert.deepEqual(
    list.map((d) => d.id),
    ["chan", "lee", "hon"],
  );
  assert.equal(list[0].name, "陳家富醫師");
});
test("preview resolves the exact doctor phone without writes or a doctor staff account", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    assert.equal(p.doctor.phone, phone);
    assert.equal(p.destinationId, 70);
    assert.equal(p.mode, "text");
    assert.match(p.content, /第一行\n第二行/);
    assert.equal(f.writes.length, 0);
  }));
test("public selected message is sent to the doctor conversation, never the patient or an internal note", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    const result = await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(result.conversationId, 70);
    assert.equal(result.status, "sent");
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].private, false);
    assert.equal(f.sent[0].content, p.content);
    assert.equal(f.sent[0].template_params, undefined);
    assert.equal(
      f.writes.some((path) => path.startsWith("/conversations/42/")),
      false,
    );
  }));
test("private and unrelated messages cannot be forwarded", async () =>
  fixture(async (f) => {
    f.sourceMessages[0].private = true;
    await assert.rejects(previewWhatsappForward(ctx, 42, input), /內部備註/);
    f.sourceMessages[0].private = false;
    await assert.rejects(
      previewWhatsappForward(ctx, 42, { ...input, messageId: 999 }),
      /搵唔到/,
    );
    assert.equal(f.writes.length, 0);
  }));
test("expired recipient window previews and sends only the approved rendered notification", async () =>
  fixture(async (f) => {
    f.target.can_reply = false;
    const p = await previewWhatsappForward(ctx, 42, input);
    assert.equal(p.mode, "template");
    await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(f.sent[0].content, p.content);
    assert.equal(f.sent[0].template_params.name, "staff_patient_follow_up");
    assert.match(
      f.sent[0].template_params.processed_params.body["1"],
      /第一行 ｜ 第二行/,
    );
  }));
test("expired-window attachment is blocked instead of silently dropping the file", async () =>
  fixture(async (f) => {
    f.target.can_reply = false;
    f.sourceMessages[0].attachments = [
      {
        id: 1,
        file_type: "image",
        data_url: ctx.baseUrl + "/rails/active_storage/blobs/test/image.png",
      },
    ];
    const p = await previewWhatsappForward(ctx, 42, input);
    assert.equal(p.mode, "blocked");
    await assert.rejects(
      sendWhatsappForward(
        ctx,
        42,
        { ...input, token: p.token, requestId },
        f.ledger,
      ),
      /先回覆/,
    );
    assert.equal(f.writes.length, 0);
  }));
test("oversized template text is never truncated", async () =>
  fixture(async (f) => {
    f.target.can_reply = false;
    f.sourceMessages[0].content = "字".repeat(901);
    const p = await previewWhatsappForward(ctx, 42, input);
    assert.equal(p.mode, "blocked");
    assert.match(p.content, /字{901}/);
  }));
test("a changed recipient, source content, or reply window requires a new preview", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    f.target.can_reply = false;
    await assert.rejects(
      sendWhatsappForward(
        ctx,
        42,
        { ...input, token: p.token, requestId },
        f.ledger,
      ),
      /重新預覽/,
    );
    assert.equal(f.writes.length, 0);
  }));
test("retry after a lost response reads back the existing send; no duplicate even after window closes", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    f.setLostResponse();
    const args = { ...input, token: p.token, requestId };
    const first = await sendWhatsappForward(ctx, 42, args, f.ledger);
    f.target.can_reply = false;
    const retry = await sendWhatsappForward(ctx, 42, args, f.ledger);
    assert.equal(first.messageId, retry.messageId);
    assert.equal(f.sent.length, 1);
  }));
test("concurrent same-request sends share a durable claim", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    const args = { ...input, token: p.token, requestId };
    await Promise.allSettled([
      sendWhatsappForward(ctx, 42, args, f.ledger),
      sendWhatsappForward(ctx, 42, args, f.ledger),
    ]);
    assert.equal(f.sent.length, 1);
    assert.equal(
      (await sendWhatsappForward(ctx, 42, args, f.ledger)).messageId,
      200,
    );
  }));
test("an unknown pending send is not sent again", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    f.records.set(requestId, {
      request_id: requestId,
      actor_id: ctx.actor.id,
      account_id: 2,
      source_conversation_id: 42,
      source_message_id: 100,
      destination_conversation_id: 70,
      doctor_id: "chan",
      payload_hash: p.token,
      message_id: null,
    });
    await assert.rejects(
      sendWhatsappForward(
        ctx,
        42,
        { ...input, token: p.token, requestId },
        f.ledger,
      ),
      /正在確認/,
    );
    assert.equal(f.sent.length, 0);
  }));
test("request IDs cannot be reused by a different staff member", async () =>
  fixture(async (f) => {
    const p = await previewWhatsappForward(ctx, 42, input);
    const args = { ...input, token: p.token, requestId };
    await sendWhatsappForward(ctx, 42, args, f.ledger);
    await assert.rejects(
      sendWhatsappForward(
        { ...ctx, actor: { ...ctx.actor, id: "other" } },
        42,
        args,
        f.ledger,
      ),
      /重新預覽/,
    );
    assert.equal(f.sent.length, 1);
  }));
test("attachment bytes are copied to doctor WhatsApp instead of sharing a login link", async () =>
  fixture(async (f) => {
    f.sourceMessages[0].attachments = [
      {
        id: 1,
        file_type: "image",
        data_url: ctx.baseUrl + "/rails/active_storage/blobs/test/image.png",
      },
    ];
    const p = await previewWhatsappForward(ctx, 42, input);
    await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(f.sent.length, 2);
    assert.equal(f.sent[1].fileCount, 1);
    assert.match(f.sent[0].content, /轉寄病人訊息/);
    assert.equal(f.sent[0].private, false);
  }));
test("attachment downloads reject arbitrary hosts before any request", async () =>
  fixture(async (f) => {
    await assert.rejects(
      downloadForwardAttachment(ctx, {
        id: 1,
        data_url: "http://127.0.0.1/private",
      }),
      /未能直接轉寄/,
    );
    assert.equal(f.writes.length, 0);
  }));
test("wrong recipient identity or account cannot receive a forward", async () =>
  fixture(async (f) => {
    f.target.meta!.sender!.phone_number = "+85200000009";
    await assert.rejects(previewWhatsappForward(ctx, 42, input), /收件號碼/);
    f.target.meta!.sender!.phone_number = phone;
    f.target.account_id = 99;
    await assert.rejects(previewWhatsappForward(ctx, 42, input), /搵唔到/);
  }));
test("provider failure stays failed and sent is never labelled delivered", async () =>
  fixture(async (f) => {
    f.setFailed();
    const p = await previewWhatsappForward(ctx, 42, input);
    const result = await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(result.status, "failed");
    assert.match(forwardDeliveryLabel(result.status), /未能送出/);
    assert.match(forwardDeliveryLabel("sent"), /等候/);
  }));

test("multiple attachments use separate WhatsApp messages and preserve the text context", async () =>
  fixture(async (f) => {
    f.sourceMessages[0].attachments = [1, 2].map((id) => ({
      id,
      file_type: "image",
      data_url: ctx.baseUrl + "/rails/active_storage/blobs/test/image.png",
    }));
    const p = await previewWhatsappForward(ctx, 42, input);
    const r = await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(f.sent.length, 3);
    assert.equal(f.sent[1].fileCount, 1);
    assert.equal(f.sent[2].fileCount, 1);
    assert.equal(r.status, "sent");
    await sendWhatsappForward(
      ctx,
      42,
      { ...input, token: p.token, requestId },
      f.ledger,
    );
    assert.equal(f.sent.length, 3);
  }));
test("interrupted multi-part send reports partial and does not resend on retry", async () =>
  fixture(async (f) => {
    f.sourceMessages[0].attachments = [
      {
        id: 1,
        file_type: "image",
        data_url: ctx.baseUrl + "/rails/active_storage/blobs/test/image.png",
      },
    ];
    const p = await previewWhatsappForward(ctx, 42, input);
    f.setLostResponse();
    const args = { ...input, token: p.token, requestId };
    const r = await sendWhatsappForward(ctx, 42, args, f.ledger);
    assert.equal(r.status, "partial");
    assert.equal(f.sent.length, 1);
    assert.equal(
      (await sendWhatsappForward(ctx, 42, args, f.ledger)).status,
      "partial",
    );
    assert.equal(f.sent.length, 1);
  }));
