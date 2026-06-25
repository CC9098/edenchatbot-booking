const CJK_CHARACTER_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function shouldSearchStaffContactQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (CJK_CHARACTER_PATTERN.test(trimmed)) return trimmed.length >= 1;
  return trimmed.length >= 2;
}
