import { randomUUID } from "node:crypto";
import {
  AuthError,
  getCurrentUser,
  requireStaffRole,
} from "@/lib/auth-helpers";
import {
  getStaffChatwootConfig,
  resolveStaffChatwootAccountId,
} from "@/lib/staff-chatwoot-api";
import {
  normalizeEdenConversation,
  normalizeEdenMessages,
  matchesConversationView,
  latestEdenConversationsPerContact,
  assertWorkspaceRevision,
  validateConversationAttachment,
  type ConversationActor,
  type RawEdenConversation,
  type RawEdenMessage,
  type WorkspaceState,
  type ConversationStage,
  type EdenConversation,
} from "@/lib/eden-conversations";
import { getChatwootMessagePageState } from "@/lib/staff-chatwoot-history-pagination";
import { parseChatwootDoctorAgentIds } from "@/lib/staff-chatwoot-doctor-forward";
import { buildPublicUrl } from "@/lib/public-url";

type Agent = { id: number; name: string; email?: string; role?: string };
type Inbox = { id: number; name: string; channel_type: string };
export type ConversationContext = {
  actor: ConversationActor;
  accountId: number;
  baseUrl: string;
  token: string;
  inboxes: Inbox[];
  agents: Agent[];
};

export async function requireConversationContext(
  request?: Request,
): Promise<ConversationContext> {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new AuthError(403, "請由 Eden 對話發出操作。");
  }
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "請重新登入 Eden。");
  const role = await requireStaffRole(user.id);
  const config = getStaffChatwootConfig();
  const accountId = await resolveStaffChatwootAccountId(
    config.baseUrl,
    config.apiAccessToken,
    config.accountId,
  );
  const context = {
    actor: {
      id: user.id,
      name: "",
      role: role.role,
      agentId: null as number | null,
    },
    accountId,
    baseUrl: config.baseUrl,
    token: config.apiAccessToken,
    inboxes: [] as Inbox[],
    agents: [] as Agent[],
  };
  const [inboxes, agents] = await Promise.all([
    conversationRequest<{ payload: Inbox[] }>(context, "/inboxes"),
    conversationRequest<Agent[]>(context, "/agents"),
  ]);
  context.inboxes = (inboxes.payload || []).filter(
    (i) => i.channel_type === "Channel::Whatsapp",
  );
  context.agents = agents;
  const agent = user.email
    ? agents.find((a) => a.email?.toLowerCase() === user.email!.toLowerCase())
    : undefined;
  context.actor = {
    id: user.id,
    name:
      agent?.name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "同事",
    role: role.role,
    agentId: agent?.id || null,
  };
  return context;
}

export async function conversationRequest<T>(
  ctx: Pick<ConversationContext, "baseUrl" | "token" | "accountId">,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(
    `${ctx.baseUrl}/api/v1/accounts/${ctx.accountId}${path}`,
    {
      method,
      headers: {
        api_access_token: ctx.token,
        ...(multipart ? {} : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new AuthError(
      response.status === 404 ? 404 : 502,
      response.status === 404
        ? "搵唔到呢段對話。"
        : "暫時未能連接訊息服務，請再試。",
    );
  return response.status === 204 ? ({} as T) : response.json();
}

export async function getConversation(ctx: ConversationContext, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new AuthError(400, "對話編號無效。");
  const raw = await conversationRequest<RawEdenConversation>(
    ctx,
    `/conversations/${id}`,
  );
  if (
    raw.id !== id ||
    (raw.account_id && raw.account_id !== ctx.accountId) ||
    !ctx.inboxes.some((i) => i.id === raw.inbox_id)
  )
    throw new AuthError(404, "搵唔到呢段對話。");
  return raw;
}

export function presentConversation(
  ctx: ConversationContext,
  raw: RawEdenConversation,
) {
  return normalizeEdenConversation(
    raw,
    ctx.actor,
    ctx.inboxes.find((i) => i.id === raw.inbox_id)?.name,
  );
}

export async function listConversations(
  ctx: ConversationContext,
  options: { view: string; page: number; query: string; inboxId?: number },
) {
  const query = options.query.trim().slice(0, 100);
  if (query) {
    const contacts = await conversationRequest<{
      payload: { id: number }[];
      meta?: { count?: number };
    }>(
      ctx,
      `/contacts/search?q=${encodeURIComponent(query)}&page=${options.page}&sort=-last_activity_at`,
    );
    const contactIds = [
      ...new Set((contacts.payload || []).map((c) => c.id)),
    ].filter((id) => Number.isSafeInteger(id) && id > 0);
    const conversations: EdenConversation[] = [];
    // Contact search is paged by people, never by their historical tickets.
    // Limit fan-out while fetching the full history for each contact on this page.
    for (let offset = 0; offset < contactIds.length; offset += 5) {
      const results = await Promise.all(
        contactIds.slice(offset, offset + 5).map(async (contactId) => {
          const result = await conversationRequest<{
            payload: RawEdenConversation[];
          }>(ctx, `/contacts/${contactId}/conversations`);
          const history = (result.payload || [])
            .filter(
              (c) =>
                (!c.account_id || c.account_id === ctx.accountId) &&
                c.meta?.sender?.id === contactId &&
                ctx.inboxes.some((i) => i.id === c.inbox_id) &&
                (!options.inboxId || c.inbox_id === options.inboxId),
            )
            .map((c) => presentConversation(ctx, c))
            .sort(
              (a, b) =>
                b.updatedAt - a.updatedAt ||
                b.lastMessageId - a.lastMessageId ||
                b.id - a.id,
            );
          const latest = history.find((c) =>
            matchesConversationView(c, options.view, ctx.actor),
          );
          return latest
            ? {
                ...latest,
                contactHistory: history.map(
                  ({ id, stage, updatedAt, inboxName }) => ({
                    id,
                    stage,
                    updatedAt,
                    inboxName,
                  }),
                ),
              }
            : null;
        }),
      );
      for (const result of results) if (result) conversations.push(result);
    }
    const count = contacts.meta?.count;
    const hasMore =
      (contacts.payload || []).length > 0 &&
      (typeof count === "number"
        ? options.page * 15 < count
        : contacts.payload.length >= 15);
    return {
      conversations: latestEdenConversationsPerContact(conversations),
      nextPage: hasMore ? options.page + 1 : null,
    };
  }
  const status =
    options.view === "done"
      ? "resolved"
      : ["reply", "doctor", "mine"].includes(options.view)
        ? "open"
        : "all";
  const qs = new URLSearchParams({
    status,
    page: String(options.page),
    sort_by: "last_activity_at_desc",
  });
  if (options.inboxId) qs.set("inbox_id", String(options.inboxId));
  const result = await conversationRequest<{
    data?: { payload?: RawEdenConversation[] };
  }>(ctx, `/conversations?${qs}`);
  const raw: RawEdenConversation[] =
    result.data?.payload ||
    (result as { payload?: RawEdenConversation[] }).payload ||
    [];
  const conversations = raw
    .filter(
      (c) =>
        ctx.inboxes.some((i) => i.id === c.inbox_id) &&
        (!options.inboxId || c.inbox_id === options.inboxId),
    )
    .map((c) => presentConversation(ctx, c))
    .filter((c) => matchesConversationView(c, options.view, ctx.actor));
  return {
    conversations,
    nextPage: raw.length >= 25 ? options.page + 1 : null,
  };
}

export async function conversationDetail(
  ctx: ConversationContext,
  id: number,
  before?: number,
) {
  const raw = await getConversation(ctx, id);
  const data = await conversationRequest<{ payload: RawEdenMessage[] }>(
    ctx,
    `/conversations/${id}/messages${before ? `?before=${before}` : ""}`,
  );
  const page = getChatwootMessagePageState(data.payload || [], before || null);
  const configured = parseChatwootDoctorAgentIds(
    process.env.CHATWOOT_DOCTOR_AGENT_IDS,
  );
  return {
    conversation: presentConversation(ctx, raw),
    messages: normalizeEdenMessages(data.payload || []),
    nextBefore: page.nextBefore,
    hasMore: page.hasMore,
    doctors: ctx.agents
      .filter((a) => configured.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name })),
    actor: ctx.actor,
  };
}

export async function saveConversationState(
  ctx: ConversationContext,
  raw: RawEdenConversation,
  patch: Partial<WorkspaceState>,
  expectedRevision: string,
) {
  try {
    assertWorkspaceRevision(
      expectedRevision,
      raw.custom_attributes?.eden_workspace || {},
    );
  } catch {
    throw new AuthError(409, "同事已更新呢段對話，已重新載入，請核對後再試。");
  }
  const state: WorkspaceState = {
    ...raw.custom_attributes?.eden_workspace,
    ...patch,
    revision: randomUUID(),
    updatedAt: new Date().toISOString(),
    lastIncomingId: presentConversation(ctx, raw).lastIncomingId,
  };
  await conversationRequest(ctx, `/conversations/${raw.id}/custom_attributes`, {
    custom_attributes: { eden_workspace: state, eden_flow_state: "human" },
  });
  const targetStatus = state.stage === "done" ? "resolved" : "open";
  if (raw.status !== targetStatus)
    await conversationRequest(ctx, `/conversations/${raw.id}/toggle_status`, {
      status: targetStatus,
    });
  const saved = await getConversation(ctx, raw.id);
  if (
    saved.custom_attributes?.eden_workspace?.revision !== state.revision ||
    saved.status !== targetStatus ||
    saved.custom_attributes?.eden_flow_state !== "human"
  )
    throw new AuthError(409, "對話狀態有更新，請重新載入確認。");
  return presentConversation(ctx, saved);
}

export async function updateConversation(
  ctx: ConversationContext,
  raw: RawEdenConversation,
  action: {
    type: "claim" | "stage" | "handover" | "doctor" | "read";
    revision: string;
    stage?: ConversationStage;
    summary?: string;
    nextStep?: string;
    dueAt?: string;
    doctorId?: number;
  },
) {
  if (action.type === "read") {
    const lastId = presentConversation(ctx, raw).lastIncomingId;
    const key = `eden_read_${ctx.actor.id.replace(/-/g, "")}`;
    if (lastId > (Number(raw.custom_attributes?.[key]) || 0))
      await conversationRequest(
        ctx,
        `/conversations/${raw.id}/custom_attributes`,
        { custom_attributes: { [key]: lastId } },
      );
    return presentConversation(ctx, await getConversation(ctx, raw.id));
  }
  const patch: Partial<WorkspaceState> = {};
  if (action.type === "claim") {
    patch.ownerId = ctx.actor.id;
    patch.ownerName = ctx.actor.name;
    patch.stage = "reply";
  } else if (action.type === "stage") {
    patch.stage = action.stage;
  } else if (action.type === "handover") {
    patch.handover = {
      summary: action.summary || "",
      nextStep: action.nextStep || "",
      dueAt: action.dueAt || "",
      by: ctx.actor.name,
      updatedAt: new Date().toISOString(),
    };
    patch.ownerId = null;
    patch.ownerName = null;
    patch.stage = "reply";
  } else if (action.type === "doctor") {
    const configured = parseChatwootDoctorAgentIds(
      process.env.CHATWOOT_DOCTOR_AGENT_IDS,
    );
    const doctor = ctx.agents.find(
      (a) => a.id === action.doctorId && configured.includes(a.id),
    );
    if (!doctor) throw new AuthError(400, "請選擇醫師。");
    const members = await conversationRequest<{ payload: Agent[] }>(
      ctx,
      `/inbox_members/${raw.inbox_id}`,
    );
    if (
      doctor.role !== "administrator" &&
      !members.payload.some((a) => a.id === doctor.id)
    )
      throw new AuthError(400, "呢位醫師未能接收此診所嘅對話。");
    patch.doctorId = doctor.id;
    patch.doctorName = doctor.name;
    patch.stage = "doctor";
    patch.ownerId = null;
    patch.ownerName = doctor.name;
  }
  // Validate before changing the Chatwoot assignee as well as before saving metadata.
  try {
    assertWorkspaceRevision(
      action.revision,
      raw.custom_attributes?.eden_workspace || {},
    );
  } catch {
    throw new AuthError(409, "同事已更新呢段對話，請核對後再試。");
  }
  if (
    action.type === "doctor" ||
    action.type === "handover" ||
    action.type === "claim"
  ) {
    const assigneeId =
      action.type === "doctor"
        ? action.doctorId
        : action.type === "handover"
          ? null
          : ctx.actor.agentId;
    await conversationRequest(ctx, `/conversations/${raw.id}/assignments`, {
      assignee_id: assigneeId,
    });
  }
  const saved = await saveConversationState(ctx, raw, patch, action.revision);
  if (action.type === "doctor") {
    await conversationRequest(ctx, `/conversations/${raw.id}/messages`, {
      content: `[@${patch.doctorName}](mention://user/${patch.doctorId}/${encodeURIComponent(patch.doctorName || "")}) ${ctx.actor.name} 已轉交病人訊息。\n\n[開啟 Eden 對話](${buildPublicUrl(`/conversations?id=${raw.id}`)})`,
      message_type: "outgoing",
      private: true,
    });
  }
  return saved;
}

export async function sendConversationMessage(
  ctx: ConversationContext,
  raw: RawEdenConversation,
  input: {
    content: string;
    private: boolean;
    replyTo?: number;
    requestId: string;
    attachment?: File | null;
  },
) {
  const recent = await conversationRequest<{ payload: RawEdenMessage[] }>(
    ctx,
    `/conversations/${raw.id}/messages`,
  );
  const duplicate = recent.payload.find(
    (m) =>
      m.content_attributes?.eden_workspace?.requestId === input.requestId &&
      m.content_attributes?.eden_workspace?.actorId === ctx.actor.id,
  );
  if (duplicate)
    return { message: normalizeEdenMessages([duplicate])[0], duplicate: true };
  if (!input.private && raw.can_reply !== true)
    throw new AuthError(
      409,
      "請用跟進訊息聯絡病人，等病人回覆後就可以直接聊天。",
    );
  if (input.attachment) {
    const error = validateConversationAttachment(input.attachment);
    if (error) throw new AuthError(400, error);
  }
  if (input.replyTo) {
    const page = await conversationRequest<{ payload: RawEdenMessage[] }>(
      ctx,
      `/conversations/${raw.id}/messages?before=${input.replyTo + 1}`,
    );
    const parent = page.payload.find(
      (m) => m.id === input.replyTo && !m.private,
    );
    if (!parent) throw new AuthError(400, "搵唔到要引用嘅病人訊息。");
  }
  const attrs = {
    ...(input.replyTo ? { in_reply_to: input.replyTo } : {}),
    eden_workspace: {
      actor: ctx.actor.name,
      actorId: ctx.actor.id,
      requestId: input.requestId,
    },
  };
  let body: unknown = {
    content: input.content,
    message_type: "outgoing",
    private: input.private,
    content_attributes: attrs,
  };
  if (input.attachment) {
    const form = new FormData();
    form.set("content", input.content);
    form.set("message_type", "outgoing");
    form.set("private", String(input.private));
    form.set("content_attributes", JSON.stringify(attrs));
    form.set("attachments[]", input.attachment, input.attachment.name);
    body = form;
  }
  // A sent message must never compete with a bot reply.
  if (!input.private && raw.custom_attributes?.eden_flow_state !== "human") {
    await conversationRequest(
      ctx,
      `/conversations/${raw.id}/custom_attributes`,
      { custom_attributes: { eden_flow_state: "human" } },
    );
  }
  let sent: RawEdenMessage;
  try {
    sent = await conversationRequest<RawEdenMessage>(
      ctx,
      `/conversations/${raw.id}/messages`,
      body,
    );
  } catch {
    const after = await conversationRequest<{ payload: RawEdenMessage[] }>(
      ctx,
      `/conversations/${raw.id}/messages`,
    );
    const found = after.payload.find(
      (m) =>
        m.content_attributes?.eden_workspace?.requestId === input.requestId &&
        m.content_attributes?.eden_workspace?.actorId === ctx.actor.id,
    );
    if (!found)
      throw new AuthError(
        502,
        "未能確認有冇送出，請先查看最新對話，避免重覆發送。",
      );
    sent = found;
  }
  if (!sent.id) throw new AuthError(502, "未能確認訊息紀錄，請重新載入。");
  const readback = await conversationRequest<{ payload: RawEdenMessage[] }>(
    ctx,
    `/conversations/${raw.id}/messages?before=${sent.id + 1}`,
  );
  const verified = readback.payload.find((m) => m.id === sent.id);
  if (!verified) throw new AuthError(502, "正在確認訊息，請重新載入查看。");
  const message = normalizeEdenMessages([verified])[0];
  if (!message) throw new AuthError(502, "未能確認訊息內容，請重新載入查看。");
  if (!input.private && !message.deliveryIssue && ["sent", "delivered", "read"].includes(message.status || "")) {
    const latest = await getConversation(ctx, raw.id);
    if (
      (latest.custom_attributes?.eden_workspace?.revision || "") ===
      (raw.custom_attributes?.eden_workspace?.revision || "")
    ) {
      await saveConversationState(
        ctx,
        latest,
        {
          stage: "patient",
          ownerId: ctx.actor.id,
          ownerName: ctx.actor.name,
          doctorId: null,
          doctorName: null,
        },
        latest.custom_attributes?.eden_workspace?.revision || "",
      );
    }
  }
  return { message, duplicate: false };
}
