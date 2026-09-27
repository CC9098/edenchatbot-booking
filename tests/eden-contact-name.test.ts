import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/lib/auth-helpers";
import {
  normalizeEdenContactName,
  type RawEdenConversation,
} from "@/lib/eden-conversations";
import {
  getConversation,
  updateConversationContactName,
  type ConversationContext,
} from "@/lib/eden-conversations-server";

const ctx: ConversationContext = {
  actor: { id: "staff-test", name: "姑娘", role: "assistant", agentId: null },
  accountId: 2,
  baseUrl: "https://chatwoot.invalid",
  token: "synthetic",
  agents: [],
  inboxes: [{ id: 2, name: "測試診所", channel_type: "Channel::Whatsapp" }],
};
const original: RawEdenConversation = {
  id: 42,
  account_id: 2,
  inbox_id: 2,
  status: "resolved",
  meta: { sender: { id: 4, name: "舊名", phone_number: "+85200000000" } },
};
const input = { name: "  陳大文  ", expectedName: "舊名" };

async function fixture(
  run: (state: {
    raw: RawEdenConversation;
    writes: Array<{ path: string; body: unknown }>;
    loseResponse: () => void;
    rejectUpdate: () => void;
    ignoreUpdate: () => void;
  }) => Promise<void>,
) {
  const previous = global.fetch;
  const raw = structuredClone(original);
  const writes: Array<{ path: string; body: unknown }> = [];
  let lost = false,
    rejected = false,
    ignored = false;
  global.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    assert.equal(
      new Headers(init?.headers).get("api_access_token"),
      "synthetic",
    );
    if (init?.method === "GET") {
      assert.equal(path, "/api/v1/accounts/2/conversations/42");
      return Response.json(raw);
    }
    assert.equal(init?.method, "PUT");
    assert.equal(path, "/api/v1/accounts/2/contacts/4");
    const body = JSON.parse(String(init.body));
    writes.push({ path, body });
    if (rejected) return new Response("Unavailable", { status: 500 });
    if (!ignored) raw.meta!.sender!.name = body.name;
    if (lost) throw new Error("Lost update response");
    return new Response(null, { status: 204 });
  };
  try {
    await run({
      raw,
      writes,
      loseResponse: () => {
        lost = true;
      },
      rejectUpdate: () => {
        rejected = true;
      },
      ignoreUpdate: () => {
        ignored = true;
      },
    });
  } finally {
    global.fetch = previous;
  }
}

test("validates Chinese and English names, whitespace, controls and length", () => {
  assert.equal(
    normalizeEdenContactName("  陳大文 Chan Tai Man  "),
    "陳大文 Chan Tai Man",
  );
  assert.equal(normalizeEdenContactName("陳".repeat(128)), "陳".repeat(128));
  for (const name of [null, 1, "", "   ", "陳\n大文", "a".repeat(129)])
    assert.equal(normalizeEdenContactName(name), null);
});

test("updates only the verified conversation's contact name and reads it back", async () => {
  await fixture(async ({ raw, writes }) => {
    const saved = await updateConversationContactName(
      ctx,
      await getConversation(ctx, 42),
      input,
    );
    assert.equal(saved.name, "陳大文");
    assert.equal(saved.phone, original.meta!.sender!.phone_number);
    assert.equal(saved.contactId, 4);
    assert.equal(saved.stage, "done");
    assert.deepEqual(writes, [
      { path: "/api/v1/accounts/2/contacts/4", body: { name: "陳大文" } },
    ]);
    assert.equal(raw.status, "resolved");
    assert.equal(raw.custom_attributes, undefined);
  });
});

test("lost responses are verified and retries do not repeat the contact write", async () => {
  await fixture(async ({ loseResponse, writes }) => {
    loseResponse();
    const saved = await updateConversationContactName(
      ctx,
      await getConversation(ctx, 42),
      input,
    );
    assert.equal(saved.name, "陳大文");
    const retry = await updateConversationContactName(
      ctx,
      await getConversation(ctx, 42),
      input,
    );
    assert.equal(retry.name, "陳大文");
    assert.equal(writes.length, 1);
  });
});

test("another colleague's edit is not overwritten", async () => {
  await fixture(async ({ raw, writes }) => {
    raw.meta!.sender!.name = "同事修改";
    await assert.rejects(
      updateConversationContactName(ctx, await getConversation(ctx, 42), input),
      (error: unknown) => error instanceof AuthError && error.status === 409,
    );
    assert.equal(writes.length, 0);
    assert.equal(raw.meta!.sender!.name, "同事修改");
  });
});

test("invalid names and missing contact identity cannot write", async () => {
  await fixture(async ({ raw, writes }) => {
    for (const name of [" ", "a".repeat(129), "陳\n大文"])
      await assert.rejects(
        updateConversationContactName(ctx, raw, { ...input, name }),
        (error: unknown) => error instanceof AuthError && error.status === 400,
      );
    delete raw.meta!.sender!.id;
    await assert.rejects(
      updateConversationContactName(ctx, raw, input),
      (error: unknown) => error instanceof AuthError && error.status === 409,
    );
    assert.equal(writes.length, 0);
  });
});

test("other accounts and non-WhatsApp inboxes are denied before contact writes", async () => {
  await fixture(async ({ raw, writes }) => {
    raw.account_id = 99;
    await assert.rejects(
      getConversation(ctx, 42),
      (error: unknown) => error instanceof AuthError && error.status === 404,
    );
    raw.account_id = 2;
    raw.inbox_id = 99;
    await assert.rejects(
      getConversation(ctx, 42),
      (error: unknown) => error instanceof AuthError && error.status === 404,
    );
    assert.equal(writes.length, 0);
  });
});

test("upstream errors and unpersisted changes never report success", async () => {
  await fixture(async ({ rejectUpdate }) => {
    rejectUpdate();
    await assert.rejects(
      updateConversationContactName(ctx, original, input),
      (error: unknown) => error instanceof AuthError && error.status === 502,
    );
  });
  await fixture(async ({ ignoreUpdate }) => {
    ignoreUpdate();
    await assert.rejects(
      updateConversationContactName(ctx, original, input),
      (error: unknown) => error instanceof AuthError && error.status === 502,
    );
  });
});

test("a changed contact identity cannot be presented as a successful rename", async () => {
  await fixture(async ({ raw }) => {
    raw.meta!.sender!.id = 5;
    await assert.rejects(
      updateConversationContactName(ctx, original, input),
      (error: unknown) => error instanceof AuthError && error.status === 502,
    );
  });
});
