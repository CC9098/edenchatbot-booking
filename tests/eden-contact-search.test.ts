import assert from "node:assert/strict";
import test from "node:test";
import {
  latestEdenConversationsPerContact,
  mergeEdenConversationPages,
  normalizeEdenConversation,
  type EdenConversation,
  type RawEdenConversation,
} from "@/lib/eden-conversations";
import {
  listConversations,
  type ConversationContext,
} from "@/lib/eden-conversations-server";

const actor = {
  id: "staff-test",
  name: "測試同事",
  role: "assistant",
  agentId: 7,
};
const ctx: ConversationContext = {
  actor,
  accountId: 2,
  baseUrl: "https://chatwoot.invalid",
  token: "synthetic",
  agents: [],
  inboxes: [{ id: 2, name: "測試診所", channel_type: "Channel::Whatsapp" }],
};
function raw(
  id: number,
  contactId = 4,
  status = "resolved",
  timestamp = id,
): RawEdenConversation {
  return {
    id,
    account_id: 2,
    inbox_id: 2,
    status,
    can_reply: status === "open",
    messages: [
      {
        id: id * 10,
        message_type: 0,
        content: `訊息 ${id}`,
        created_at: timestamp,
      },
    ],
    meta: {
      sender: {
        id: contactId,
        name: "同名聯絡人",
        phone_number: `+852${contactId}`,
      },
    },
  };
}
function row(id: number, contactId = 4, status = "resolved", timestamp = id) {
  return normalizeEdenConversation(
    raw(id, contactId, status, timestamp),
    actor,
  );
}
async function mockSearch(
  contacts: { id: number }[],
  history: RawEdenConversation[],
  run: (calls: URL[]) => Promise<void>,
  count = contacts.length,
) {
  const previous = global.fetch;
  const calls: URL[] = [];
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url);
    assert.equal(init?.method, "GET");
    assert.ok(url.pathname.startsWith("/api/v1/accounts/2/"));
    if (url.pathname.endsWith("/contacts/search"))
      return Response.json({ payload: contacts, meta: { count } });
    const match = url.pathname.match(/\/contacts\/(\d+)\/conversations$/);
    assert.ok(match, `Unexpected endpoint ${url.pathname}`);
    return Response.json({ payload: history });
  };
  try {
    await run(calls);
  } finally {
    global.fetch = previous;
  }
}

test("search returns one contact after 40 historical conversations and opens the latest message", async () => {
  const history = Array.from({ length: 40 }, (_, i) => raw(i + 1));
  // A lower ticket ID can have the latest activity; upstream order is not relied on.
  history[1] = raw(2, 4, "open", 100);
  await mockSearch([{ id: 4 }], history, async (calls) => {
    const result = await listConversations(ctx, {
      query: "同名",
      page: 1,
      view: "all",
    });
    assert.equal(result.conversations.length, 1);
    assert.equal(result.conversations[0].id, 2);
    assert.equal(result.conversations[0].preview, "訊息 2");
    assert.equal(result.nextPage, null);
    assert.ok(result.conversations[0].contactHistory?.some((c) => c.id === 1));
    assert.equal(calls.length, 2);
  });
});

test("search pages through contacts and keeps same-name contacts separate", async () => {
  await mockSearch(
    [{ id: 4 }, { id: 5 }],
    [raw(40, 4), raw(50, 5)],
    async (calls) => {
      const result = await listConversations(ctx, {
        query: "+852",
        page: 2,
        view: "all",
      });
      assert.equal(calls[0].searchParams.get("page"), "2");
      assert.equal(calls[0].searchParams.get("q"), "+852");
      assert.deepEqual(
        result.conversations.map((c) => c.contactId),
        [5, 4],
      );
      assert.equal(result.nextPage, 3);
    },
    31,
  );
});

test("classification chooses the latest matching conversation but keeps older history accessible", async () => {
  await mockSearch(
    [{ id: 4 }],
    [raw(1, 4, "open"), raw(2, 4, "resolved")],
    async () => {
      const reply = await listConversations(ctx, {
        query: "同名",
        page: 1,
        view: "reply",
      });
      assert.equal(reply.conversations[0].id, 1);
      assert.deepEqual(
        reply.conversations[0].contactHistory?.map((c) => c.id),
        [2, 1],
      );
      const done = await listConversations(ctx, {
        query: "同名",
        page: 1,
        view: "done",
      });
      assert.equal(done.conversations[0].id, 2);
    },
  );
});

test("search and its history exclude other accounts, contacts and non-WhatsApp inboxes", async () => {
  await mockSearch(
    [{ id: 4 }],
    [
      raw(1),
      { ...raw(2), account_id: 99 },
      { ...raw(3), inbox_id: 99 },
      raw(4, 99),
      { ...raw(5), inbox_id: 3 },
    ],
    async () => {
      const multiInbox = {
        ...ctx,
        inboxes: [
          ...ctx.inboxes,
          { id: 3, name: "另一診所", channel_type: "Channel::Whatsapp" },
        ],
      };
      const result = await listConversations(multiInbox, {
        query: "同名",
        page: 1,
        view: "all",
        inboxId: 2,
      });
      assert.deepEqual(
        result.conversations.map((c) => c.id),
        [1],
      );
      assert.deepEqual(
        result.conversations[0].contactHistory?.map((c) => c.id),
        [1],
      );
    },
  );
});

test("empty filtered contact page still exposes the next page of matching people", async () => {
  await mockSearch(
    Array.from({ length: 15 }, (_, i) => ({ id: i + 1 })),
    [],
    async () => {
      const result = await listConversations(ctx, {
        query: "同名",
        page: 1,
        view: "reply",
      });
      assert.deepEqual(result.conversations, []);
      assert.equal(result.nextPage, 2);
    },
    16,
  );
});

test("no matching contacts does not fetch conversation history", async () => {
  await mockSearch([], [], async (calls) => {
    const result = await listConversations(ctx, {
      query: "不存在",
      page: 1,
      view: "all",
    });
    assert.deepEqual(result, { conversations: [], nextPage: null });
    assert.equal(calls.length, 1);
  });
});

test("overlapping pages and polling keep one row per contact and retain the shorter last page", () => {
  const pages = new Map<number, EdenConversation[]>([
    [1, [row(1, 4), row(2, 5)]],
    [2, [row(3, 4), row(4, 6)]],
  ]);
  assert.deepEqual(
    mergeEdenConversationPages(pages, true).map((c) => c.id),
    [4, 3, 2],
  );
  pages.set(1, [row(5, 4)]);
  assert.deepEqual(
    mergeEdenConversationPages(pages, true).map((c) => c.id),
    [5, 4],
  );
  // Ordinary inbox pagination remains conversation-based.
  assert.deepEqual(
    mergeEdenConversationPages(pages, false).map((c) => c.id),
    [5, 3, 4],
  );
});

test("unknown contact identities and same-name contacts are never merged by display name", () => {
  assert.equal(
    latestEdenConversationsPerContact([
      row(1, 0),
      row(2, 0),
      row(3, 4),
      row(4, 5),
    ]).length,
    4,
  );
});
