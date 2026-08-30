export type RawChatwootAttachment = {
  id?: number;
  file_type?: string | null;
  data_url?: string | null;
  thumb_url?: string | null;
  extension?: string | null;
  content_type?: string | null;
};

export type RawChatwootHistoryMessage = {
  id?: number;
  content?: string | null;
  message_type?: number | string | null;
  created_at?: number | string | null;
  private?: boolean | null;
  status?: string | null;
  source_id?: string | null;
  content_attributes?: {
    in_reply_to?: unknown;
    in_reply_to_external_id?: unknown;
  } | null;
  attachments?: RawChatwootAttachment[] | null;
};

export type StaffChatwootHistoryMessage = {
  id: number;
  direction: "incoming" | "outgoing";
  content: string;
  createdAt: string | null;
  status: string | null;
  sourceId: string | null;
  replyToMessageId: number | null;
  replyToExternalId: string | null;
  attachments: Array<{
    id: number;
    fileType: string;
    url: string;
    label: string;
  }>;
};

function getMessageDirection(messageType: RawChatwootHistoryMessage["message_type"]) {
  if (messageType === 0 || messageType === "incoming") return "incoming";
  if (messageType === 1 || messageType === "outgoing") return "outgoing";
  return null;
}

function normalizeCreatedAt(createdAt: RawChatwootHistoryMessage["created_at"]) {
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return new Date(createdAt * 1000).toISOString();
  }

  if (typeof createdAt === "string" && createdAt.trim()) {
    const parsed = Number(createdAt);
    if (Number.isFinite(parsed)) return new Date(parsed * 1000).toISOString();

    const date = new Date(createdAt);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function normalizeAttachments(attachments: RawChatwootHistoryMessage["attachments"]) {
  return (attachments || [])
    .filter((attachment) => attachment.id && (attachment.data_url || attachment.thumb_url))
    .map((attachment) => {
      const label =
        attachment.extension ||
        attachment.file_type ||
        attachment.content_type ||
        "附件";

      return {
        id: attachment.id as number,
        fileType: attachment.file_type || "file",
        url: (attachment.data_url || attachment.thumb_url) as string,
        label,
      };
    });
}

function normalizeReplyToMessageId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeReplyToExternalId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeChatwootHistoryMessages(
  messages: RawChatwootHistoryMessage[],
): StaffChatwootHistoryMessage[] {
  return messages
    .map((message) => {
      const direction = getMessageDirection(message.message_type);
      if (!direction || message.private) return null;

      const content = (message.content || "").trim();
      const attachments = normalizeAttachments(message.attachments);
      if (!content && attachments.length === 0) return null;

      return {
        id: message.id || 0,
        direction,
        content,
        createdAt: normalizeCreatedAt(message.created_at),
        status: message.status || null,
        sourceId: message.source_id || null,
        replyToMessageId: normalizeReplyToMessageId(message.content_attributes?.in_reply_to),
        replyToExternalId: normalizeReplyToExternalId(message.content_attributes?.in_reply_to_external_id),
        attachments,
      };
    })
    .filter((message): message is StaffChatwootHistoryMessage => Boolean(message && message.id));
}
