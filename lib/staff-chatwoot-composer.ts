const MAX_COMPOSER_TEXT_LENGTH = 2000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
