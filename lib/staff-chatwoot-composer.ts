const MAX_COMPOSER_TEXT_LENGTH = 2000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const WHATSAPP_FREE_TEXT_CLOSED_ERROR =
  "普通文字未能送出：WhatsApp 24 小時客服窗口已關閉，請改用 approved template，或請病人先回覆 WhatsApp。";

export function getChatwootComposerText(value: string): string | null {
  const text = value.trim();
  if (text.length > MAX_COMPOSER_TEXT_LENGTH) return null;
  return text;
}

export function buildChatwootComposerJsonBody(content: string) {
  return {
    content,
    message_type: "outgoing",
    private: false,
  };
}

export function isAllowedChatwootComposerAttachment(file: Pick<File, "type" | "size">): boolean {
  return file.type.startsWith("image/") && file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES;
}

export function getChatwootConversationReplyError(conversation: {
  status?: string | null;
  can_reply?: boolean | null;
}): string | null {
  if (conversation.can_reply === false) return WHATSAPP_FREE_TEXT_CLOSED_ERROR;
  if (conversation.status === "resolved") return WHATSAPP_FREE_TEXT_CLOSED_ERROR;
  return null;
}

export function isFailedChatwootDeliveryStatus(status: string | null | undefined): boolean {
  return status === "failed";
}
