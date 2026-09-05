import { createHash } from "node:crypto";
import { AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import {
  conversationRequest,
  getConversation,
  type ConversationContext,
} from "@/lib/eden-conversations-server";
import {
  normalizeEdenMessages,
  validateConversationAttachment,
  type RawEdenMessage,
  type RawEdenConversation,
} from "@/lib/eden-conversations";
import {
  getWhatsappForwardDoctors,
  forwardMessageText,
  templateForwardText,
  type WhatsappForwardPreview,
  type WhatsappForwardResult,
} from "@/lib/eden-whatsapp-forward";

type ForwardInput = { messageId: number; doctorId: string };
type ForwardRecord = {
  request_id: string;
  actor_id: string;
  account_id: number;
  payload_hash: string;
  source_conversation_id: number;
  source_message_id: number;
  destination_conversation_id: number;
  doctor_id: string;
  message_id: number | null;
  message_ids: number[];
  part_count: number;
};
export type ForwardLedger = {
  find(id: string): Promise<ForwardRecord | null>;
  claim(record: ForwardRecord): Promise<boolean>;
  saveMessage(id: string, messageIds: number[]): Promise<void>;
};
export function createForwardLedger(): ForwardLedger {
  const table = () =>
    createServiceClient().from("staff_whatsapp_forward_requests");
  return {
    async find(id) {
      const { data, error } = await table()
        .select("*")
        .eq("request_id", id)
        .maybeSingle();
      if (error) throw new AuthError(503, "轉寄紀錄暫時未能使用，請稍後再試。");
      return data;
    },
    async claim(record) {
      const { error } = await table().insert(record);
      if (error?.code === "23505") return false;
      if (error) throw new AuthError(503, "未能建立轉寄紀錄，訊息未送出。");
      return true;
    },
    async saveMessage(id, messageIds) {
      const { error } = await table()
        .update({ message_id: messageIds.at(-1), message_ids: messageIds })
        .eq("request_id", id);
      if (error)
        throw new AuthError(502, "訊息已提交，請查看醫師對話確認狀態。");
    },
  };
}

const digits = (phone?: string) => (phone || "").replace(/\D/g, "");
async function prepare(
  ctx: ConversationContext,
  sourceId: number,
  input: ForwardInput,
) {
  const doctor = getWhatsappForwardDoctors().find(
    (d) => d.id === input.doctorId,
  );
  if (!doctor) throw new AuthError(400, "請選擇已設定 WhatsApp 嘅醫師。");
  if (!Number.isSafeInteger(input.messageId) || input.messageId <= 0)
    throw new AuthError(400, "訊息編號無效。");
  const source = await getConversation(ctx, sourceId);
  const page = await conversationRequest<{ payload: RawEdenMessage[] }>(
    ctx,
    `/conversations/${source.id}/messages?before=${input.messageId + 1}`,
  );
  const message = page.payload.find(
    (m) =>
      m.id === input.messageId &&
      !m.private &&
      [0, 1, "incoming", "outgoing"].includes(
        m.message_type as string | number,
      ),
  );
  const normalized = message && normalizeEdenMessages([message])[0];
  if (!message || !normalized)
    throw new AuthError(400, "搵唔到可轉寄嘅訊息。內部備註不會轉寄。");
  const contacts = await conversationRequest<{
    payload: { id: number; phone_number?: string }[];
  }>(ctx, `/contacts/search?q=${encodeURIComponent(digits(doctor.phone))}`);
  const matches = contacts.payload.filter(
    (c) => digits(c.phone_number) === digits(doctor.phone),
  );
  const lists = await Promise.all(
    matches.map((c) =>
      conversationRequest<{ payload: RawEdenConversation[] }>(
        ctx,
        `/contacts/${c.id}/conversations`,
      ),
    ),
  );
  const candidate = lists
    .flatMap((l) => l.payload)
    .filter((c) => c.inbox_id === source.inbox_id)
    .sort(
      (a, b) =>
        Number(b.can_reply === true) - Number(a.can_reply === true) ||
        (b.last_activity_at || b.id) - (a.last_activity_at || a.id),
    )[0];
  if (!candidate)
    throw new AuthError(
      409,
      "未有此醫師與診所嘅 WhatsApp 對話，請醫師先 WhatsApp 診所。",
    );
  const target = await getConversation(ctx, candidate.id);
  if (
    target.inbox_id !== source.inbox_id ||
    digits(target.meta?.sender?.phone_number) !== digits(doctor.phone)
  )
    throw new AuthError(409, "醫師收件號碼有更新，請重新選擇。");
  if (
    target.id === source.id ||
    digits(source.meta?.sender?.phone_number) === digits(doctor.phone)
  )
    throw new AuthError(400, "呢段已經係該醫師嘅 WhatsApp 對話。");
  const content = forwardMessageText(
    source.meta?.sender?.name || "病人",
    source.meta?.sender?.phone_number || "",
    normalized.content,
  );
  let mode: WhatsappForwardPreview["mode"] =
    target.can_reply === true ? "text" : "template";
  let reason: string | null = null;
  const parameter = templateForwardText(content);
  if (mode === "template") {
    if (normalized.attachments.length)
      reason = "醫師需要先回覆診所 WhatsApp，先可以轉寄圖片、語音或檔案。";
    else if (parameter.length > 900)
      reason = "訊息較長，需要醫師先回覆診所 WhatsApp，先可以完整轉寄。";
    else {
      const inbox = await conversationRequest<{
        message_templates?: {
          name: string;
          status: string;
          language: string;
          components?: { type: string; text?: string }[];
        }[];
      }>(ctx, `/inboxes/${source.inbox_id}`);
      const template = inbox.message_templates?.find(
        (t) =>
          t.name === "staff_patient_follow_up" &&
          t.language === "zh_HK" &&
          t.status.toUpperCase() === "APPROVED",
      );
      if (
        !template ||
        template.components?.find((c) => c.type === "BODY")?.text !==
          "你好，以下是診所給你的跟進訊息：\n\n{{1}}\n\n如有問題，請直接回覆此 WhatsApp。"
      )
        reason = "暫時未能使用診所 WhatsApp 通知，請醫師先回覆診所。";
    }
  }
  if (content.length > 4096)
    reason = "訊息超過 WhatsApp 單則文字上限，未能完整轉寄。";
  if (reason) mode = "blocked";
  const visibleContent =
    mode === "template"
      ? `醫天圓中醫診所通知\n\n你好，以下是診所給你的跟進訊息：\n\n${parameter}\n\n如有問題，請直接回覆此 WhatsApp。`
      : content;
  const token = createHash("sha256")
    .update(
      JSON.stringify({
        account: ctx.accountId,
        source: source.id,
        message: input.messageId,
        doctor,
        target: target.id,
        content: visibleContent,
        mode,
        attachments: normalized.attachments.map((a) => a.id),
      }),
    )
    .digest("hex");
  const preview: WhatsappForwardPreview = {
    doctor,
    sourceMessageId: input.messageId,
    destinationId: target.id,
    content: visibleContent,
    attachments: normalized.attachments,
    mode,
    reason,
    token,
  };
  return { preview, target, message, parameter };
}

export async function previewWhatsappForward(
  ctx: ConversationContext,
  sourceId: number,
  input: ForwardInput,
) {
  return (await prepare(ctx, sourceId, input)).preview;
}

// Only fetch attachments returned by the source conversation, through the configured
// Chatwoot storage endpoint. Never accept a browser-supplied URL or cross-host redirect.
export async function downloadForwardAttachment(
  ctx: ConversationContext,
  attachment: NonNullable<RawEdenMessage["attachments"]>[number],
) {
  let url = new URL(attachment.data_url || "", ctx.baseUrl);
  let response: Response | undefined;
  for (let redirects = 0; redirects < 4; redirects++) {
    if (
      url.origin !== new URL(ctx.baseUrl).origin ||
      !url.pathname.startsWith("/rails/active_storage/") ||
      url.username ||
      url.password
    )
      throw new AuthError(400, "此附件未能直接轉寄，請先下載後另行傳送。");
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new AuthError(502, "未能讀取附件。");
      url = new URL(location, url);
    } else break;
  }
  if (!response?.ok || !response.body)
    throw new AuthError(502, "未能讀取附件，訊息未送出。");
  const type = (response.headers.get("content-type") || "").split(";")[0];
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4 * 1024 * 1024) {
      await reader.cancel();
      throw new AuthError(400, "轉寄附件最多 4MB。");
    }
    chunks.push(value);
  }
  const error = validateConversationAttachment({ size, type });
  if (error) throw new AuthError(400, error);
  const extension = (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "application/pdf": "pdf",
      "audio/ogg": "ogg",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "audio/aac": "aac",
      "video/mp4": "mp4",
    } as Record<string, string>
  )[type];
  return new File(
    chunks as BlobPart[],
    `message-${attachment.id}.${extension}`,
    { type },
  );
}

async function readResult(
  ctx: ConversationContext,
  record: ForwardRecord,
): Promise<WhatsappForwardResult> {
  const ids =
    record.message_ids || (record.message_id ? [record.message_id] : []);
  const pages = await Promise.all(
    [...new Set([...ids.map((id) => `?before=${id + 1}`), ""])].map((query) =>
      conversationRequest<{ payload: RawEdenMessage[] }>(
        ctx,
        `/conversations/${record.destination_conversation_id}/messages${query}`,
      ),
    ),
  );
  const messages = [
    ...new Map(
      pages
        .flatMap((page) => page.payload)
        .filter(
          (m) =>
            m.id &&
            m.content_attributes?.eden_workspace?.requestId ===
              record.request_id &&
            m.content_attributes?.eden_workspace?.actorId === record.actor_id,
        )
        .map((m) => [m.id!, m]),
    ).values(),
  ];
  if (!messages.length)
    throw new AuthError(
      409,
      "呢次轉寄已提交，正在確認結果；請查看醫師對話，唔好重複發送。",
    );
  const partial = messages.length < (record.part_count || 1);
  const status = partial
    ? "partial"
    : messages.some((m) => m.status === "failed")
      ? "failed"
      : messages.every((m) => m.status === "read")
        ? "read"
        : messages.every((m) => ["read", "delivered"].includes(m.status || ""))
          ? "delivered"
          : "sent";
  return {
    conversationId: record.destination_conversation_id,
    messageId: messages.at(-1)!.id!,
    status,
  };
}

export async function sendWhatsappForward(
  ctx: ConversationContext,
  sourceId: number,
  input: ForwardInput & { token: string; requestId: string },
  ledger = createForwardLedger(),
): Promise<WhatsappForwardResult> {
  // A durable claim is checked before re-validating a possibly changed reply window.
  const prior = await ledger.find(input.requestId);
  if (prior) {
    if (
      prior.actor_id !== ctx.actor.id ||
      prior.account_id !== ctx.accountId ||
      prior.source_conversation_id !== sourceId ||
      prior.source_message_id !== input.messageId ||
      prior.doctor_id !== input.doctorId ||
      prior.payload_hash !== input.token
    )
      throw new AuthError(409, "轉寄內容有變，請重新預覽。");
    await getConversation(ctx, sourceId);
    await getConversation(ctx, prior.destination_conversation_id);
    return readResult(ctx, prior);
  }
  const { preview, target, message, parameter } = await prepare(
    ctx,
    sourceId,
    input,
  );
  if (preview.token !== input.token)
    throw new AuthError(409, "收件人或發送方式有更新，請重新預覽後確認。");
  if (preview.mode === "blocked")
    throw new AuthError(409, preview.reason || "暫時未能轉寄。");
  const files: File[] = [];
  for (const attachment of message.attachments || [])
    files.push(await downloadForwardAttachment(ctx, attachment));
  if (files.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024)
    throw new AuthError(400, "轉寄附件合共最多 4MB。");
  const record: ForwardRecord = {
    request_id: input.requestId,
    actor_id: ctx.actor.id,
    account_id: ctx.accountId,
    source_conversation_id: sourceId,
    source_message_id: input.messageId,
    destination_conversation_id: target.id,
    doctor_id: input.doctorId,
    payload_hash: input.token,
    message_id: null,
    message_ids: [],
    part_count: 1 + files.length,
  };
  if (!(await ledger.claim(record)))
    return sendWhatsappForward(ctx, sourceId, input, ledger);
  const attrs = {
    eden_workspace: {
      actor: ctx.actor.name,
      actorId: ctx.actor.id,
      requestId: input.requestId,
    },
    eden_whatsapp_forward: {
      sourceConversationId: sourceId,
      sourceMessageId: input.messageId,
      doctorId: input.doctorId,
    },
  };
  const body: unknown = {
    content: preview.content,
    message_type: "outgoing",
    private: false,
    content_attributes: attrs,
    ...(preview.mode === "template"
      ? {
          template_params: {
            name: "staff_patient_follow_up",
            category: "UTILITY",
            language: "zh_HK",
            processed_params: { body: { "1": parameter } },
          },
        }
      : {}),
  };
  const bodies: unknown[] = [body];
  for (const [index, file] of files.entries()) {
    const form = new FormData();
    form.set("content", "");
    form.set("message_type", "outgoing");
    form.set("private", "false");
    form.set(
      "content_attributes",
      JSON.stringify({
        ...attrs,
        eden_whatsapp_forward: {
          ...attrs.eden_whatsapp_forward,
          partIndex: index + 1,
        },
      }),
    );
    form.append("attachments[]", file, file.name);
    bodies.push(form);
  }
  // Keep doctor replies in the staff inbox instead of triggering the patient bot.
  await conversationRequest(
    ctx,
    `/conversations/${target.id}/custom_attributes`,
    { custom_attributes: { eden_flow_state: "human" } },
  );
  if (target.status !== "open")
    await conversationRequest(
      ctx,
      `/conversations/${target.id}/toggle_status`,
      { status: "open" },
    );
  for (const part of bodies) {
    try {
      const sent = await conversationRequest<RawEdenMessage>(
        ctx,
        `/conversations/${target.id}/messages`,
        part,
      );
      if (!sent.id) return readResult(ctx, record);
      record.message_id = sent.id;
      record.message_ids.push(sent.id);
      await ledger.saveMessage(input.requestId, record.message_ids);
      if (sent.status === "failed") break;
    } catch {
      // Stop on an uncertain part; never repeat it or silently claim all attachments sent.
      return readResult(ctx, record);
    }
  }
  return readResult(ctx, record);
}
