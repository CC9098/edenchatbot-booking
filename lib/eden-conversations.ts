import {
  normalizeChatwootHistoryMessages,
  type RawChatwootHistoryMessage,
} from "@/lib/staff-chatwoot-history";
import type { StaffChatwootWorkbenchMessage } from "@/lib/staff-chatwoot-workbench";

export type ConversationStage = "reply" | "patient" | "doctor" | "done";
export const STAGE_LABELS: Record<ConversationStage, string> = {
  reply: "待回覆",
  patient: "等病人",
  doctor: "等醫師",
  done: "已完成",
};
export type ConversationActor = {
  id: string;
  name: string;
  role: string;
  agentId: number | null;
};
export type ConversationHandover = {
  summary: string;
  nextStep: string;
  dueAt: string;
  by: string;
  updatedAt: string;
};
export type WorkspaceState = {
  revision?: string;
  ownerId?: string | null;
  ownerName?: string | null;
  stage?: ConversationStage;
  updatedAt?: string;
  lastIncomingId?: number;
  doctorId?: number | null;
  doctorName?: string | null;
  handover?: ConversationHandover;
};
export type EdenMessage = StaffChatwootWorkbenchMessage & {
  private: boolean;
  senderName: string;
  requestId?: string;
};
export type RawEdenMessage = RawChatwootHistoryMessage & {
  sender?: { name?: string };
  content_attributes?: NonNullable<
    RawChatwootHistoryMessage["content_attributes"]
  > & {
    eden_workspace?: { actor?: string; actorId?: string; requestId?: string };
  };
};
export type RawEdenConversation = {
  id: number;
  account_id?: number;
  inbox_id: number;
  status?: string;
  can_reply?: boolean;
  unread_count?: number;
  timestamp?: number;
  last_activity_at?: number;
  custom_attributes?: Record<string, unknown> & {
    eden_workspace?: WorkspaceState;
    eden_flow_state?: string;
  };
  messages?: RawEdenMessage[];
  last_non_activity_message?: RawEdenMessage;
  meta?: {
    sender?: {
      id?: number;
      name?: string;
      phone_number?: string;
      thumbnail?: string;
    };
    assignee?: { id?: number; name?: string };
  };
};
export type EdenConversation = {
  id: number;
  contactId: number;
  name: string;
  phone: string;
  avatar: string;
  inboxId: number;
  inboxName: string;
  stage: ConversationStage;
  canReply: boolean;
  preview: string;
  updatedAt: number;
  lastMessageId: number;
  lastIncomingId: number;
  unread: boolean;
  bot: boolean;
  assigneeId: number | null;
  assigneeName: string;
  state: WorkspaceState;
  contactHistory?: {
    id: number;
    stage: ConversationStage;
    updatedAt: number;
    inboxName: string;
  }[];
};

export function latestEdenConversationsPerContact(
  conversations: EdenConversation[],
): EdenConversation[] {
  const contacts = new Map<string, EdenConversation>();
  for (const c of [...conversations].sort(
    (a, b) =>
      b.updatedAt - a.updatedAt ||
      b.lastMessageId - a.lastMessageId ||
      b.id - a.id,
  )) {
    const key =
      c.contactId > 0 ? `contact:${c.contactId}` : `conversation:${c.id}`;
    if (!contacts.has(key)) contacts.set(key, c);
  }
  return [...contacts.values()];
}

export function mergeEdenConversationPages(
  pages: Map<number, EdenConversation[]>,
  byContact: boolean,
): EdenConversation[] {
  const rows = [...pages.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, rows]) => rows);
  if (byContact) return latestEdenConversationsPerContact(rows);
  // Prefer the refreshed first page when conversations move between pages.
  return rows.filter(
    (c, index) => rows.findIndex((other) => other.id === c.id) === index,
  );
}

export function normalizeEdenMessages(raw: RawEdenMessage[]): EdenMessage[] {
  return raw
    .flatMap((message) => {
      const normalized = normalizeChatwootHistoryMessages([
        { ...message, private: false },
      ])[0];
      if (!normalized) return [];
      return [
        {
          ...normalized,
          private: message.private === true,
          senderName:
            message.content_attributes?.eden_workspace?.actor ||
            message.sender?.name ||
            "診所",
          requestId: message.content_attributes?.eden_workspace?.requestId,
        },
      ];
    })
    .sort((a, b) => a.id - b.id);
}

export function normalizeEdenConversation(
  raw: RawEdenConversation,
  actor: ConversationActor,
  inboxName = "WhatsApp",
): EdenConversation {
  const state = raw.custom_attributes?.eden_workspace || {};
  const messages = [
    raw.last_non_activity_message,
    ...(raw.messages || []),
  ].filter((m): m is RawEdenMessage =>
    Boolean(
      m &&
      !m.private &&
      (m.message_type === 0 ||
        m.message_type === 1 ||
        m.message_type === "incoming" ||
        m.message_type === "outgoing"),
    ),
  );
  const latest = messages.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  const incoming = messages
    .filter((m) => m.message_type === 0 || m.message_type === "incoming")
    .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  const lastIncomingId = Math.max(
    incoming?.id || 0,
    Number(raw.custom_attributes?.eden_last_incoming_message_id) || 0,
  );
  const readKey = `eden_read_${actor.id.replace(/-/g, "")}`;
  const readId = Number(raw.custom_attributes?.[readKey]) || 0;
  const newIncoming = lastIncomingId > (state.lastIncomingId || 0);
  let stage: ConversationStage =
    raw.status === "resolved"
      ? "done"
      : state.stage || (raw.status === "pending" ? "patient" : "reply");
  if (stage !== "doctor" && raw.status !== "resolved" && newIncoming)
    stage = "reply";
  return {
    id: raw.id,
    contactId: raw.meta?.sender?.id || 0,
    name:
      raw.meta?.sender?.name ||
      raw.meta?.sender?.phone_number ||
      "未命名聯絡人",
    phone: raw.meta?.sender?.phone_number || "",
    avatar: raw.meta?.sender?.thumbnail || "",
    inboxId: raw.inbox_id,
    inboxName,
    stage,
    canReply: raw.can_reply === true,
    preview:
      latest?.content?.trim() ||
      (latest?.attachments?.length ? "附件" : "未有訊息"),
    updatedAt:
      Number(latest?.created_at) || raw.last_activity_at || raw.timestamp || 0,
    lastMessageId: latest?.id || 0,
    lastIncomingId,
    // First use inherits the existing inbox baseline instead of flagging all history.
    // After a staff member opens the conversation, their own cursor is authoritative.
    unread: readId > 0 ? lastIncomingId > readId : (raw.unread_count || 0) > 0,
    bot:
      raw.custom_attributes?.eden_flow_state !== "human" &&
      raw.status === "pending",
    assigneeId: raw.meta?.assignee?.id || null,
    assigneeName: state.ownerName || raw.meta?.assignee?.name || "未接手",
    state,
  };
}

export function matchesConversationView(
  c: EdenConversation,
  view: string,
  actor: ConversationActor,
) {
  if (view === "unread") return c.unread;
  if (view === "mine")
    return (
      c.stage !== "done" &&
      (c.state.ownerId === actor.id ||
        (actor.agentId !== null && c.assigneeId === actor.agentId))
    );
  if (view === "doctor")
    return (
      c.stage === "doctor" ||
      (c.stage !== "done" &&
        actor.role === "doctor" &&
        actor.agentId !== null &&
        c.assigneeId === actor.agentId)
    );
  if (view === "reply") return c.stage === "reply" && !c.bot;
  if (view === "done") return c.stage === "done";
  return true;
}

export function mergeEdenMessages(
  previous: EdenMessage[],
  incoming: EdenMessage[],
) {
  const map = new Map(previous.map((m) => [m.id, m]));
  incoming.forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export function validateConversationAttachment(
  file: Pick<File, "type" | "size">,
): string | null {
  // Keep multipart requests below the hosting platform's 4.5 MB body limit.
  const max = 4;
  const supported = [
    "image/jpeg",
    "image/png",
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "video/mp4",
    "application/pdf",
  ];
  if (!supported.includes(file.type))
    return "請選擇 JPG、PNG、PDF、MP3、M4A、OGG 或 MP4。";
  if (file.size <= 0 || file.size > max * 1024 * 1024)
    return `附件最多 ${max}MB。`;
  return null;
}

export function assertWorkspaceRevision(
  expected: string,
  state: WorkspaceState,
) {
  if (expected !== (state.revision || ""))
    throw new Error("CONVERSATION_CHANGED");
}
