export type StaffCannedReply = {
  id: number;
  shortCode: string;
  content: string;
};

export type CannedReplySlashToken = {
  start: number;
  end: number;
  query: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function positiveInteger(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Keep the Chatwoot response boundary small and predictable for the browser.
 * Chatwoot currently returns an array, but accepting payload/data wrappers keeps
 * this adapter tolerant of account-level API proxies.
 */
export function normalizeStaffCannedReplies(input: unknown): StaffCannedReply[] {
  const root = asRecord(input);
  const values = Array.isArray(input)
    ? input
    : Array.isArray(root?.payload)
      ? root.payload
      : Array.isArray(root?.data)
        ? root.data
        : [];
  const seen = new Set<number>();
  const replies: StaffCannedReply[] = [];

  for (const value of values) {
    const record = asRecord(value);
    const id = positiveInteger(record?.id);
    const shortCode =
      typeof record?.short_code === "string"
        ? record.short_code.trim()
        : typeof record?.shortCode === "string"
          ? record.shortCode.trim()
          : "";
    const content = typeof record?.content === "string" ? record.content : "";
    if (!id || seen.has(id) || !shortCode || !content.trim()) continue;
    seen.add(id);
    replies.push({ id, shortCode, content });
  }

  return replies;
}

export function filterStaffCannedReplies(
  replies: StaffCannedReply[],
  query: string,
): StaffCannedReply[] {
  const needle = query.trim().replace(/^\//, "").toLocaleLowerCase();
  if (!needle) return replies;

  return replies.filter((reply) =>
    `${reply.shortCode}\n${reply.content}`.toLocaleLowerCase().includes(needle),
  );
}

/**
 * Finds a slash command at the cursor when slash is the first character of a
 * token. Requiring a token boundary prevents URLs such as /booking-whatsapp
 * from opening the canned-reply menu.
 */
export function getCannedReplySlashToken(
  value: string,
  cursor = value.length,
): CannedReplySlashToken | null {
  const end = Math.max(0, Math.min(cursor, value.length));
  const beforeCursor = value.slice(0, end);
  const match = beforeCursor.match(/(?:^|\s)\/([^\s/]*)$/u);
  if (!match || match.index === undefined) return null;

  const start = match.index + (match[0].startsWith("/") ? 0 : 1);
  return { start, end, query: match[1] || "" };
}

export function replaceCannedReplySlashToken(
  value: string,
  cursor: number,
  content: string,
): { value: string; cursor: number } | null {
  const token = getCannedReplySlashToken(value, cursor);
  if (!token) return null;

  const nextValue = `${value.slice(0, token.start)}${content}${value.slice(token.end)}`;
  return {
    value: nextValue,
    cursor: token.start + content.length,
  };
}
