export function normalizePhoneForSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function normalizePhoneForStorage(value: string | null | undefined): string {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const hasPlusPrefix = trimmed.startsWith("+");
  const digitsOnly = normalizePhoneForSearch(trimmed);
  if (!digitsOnly) return trimmed;

  return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
}
