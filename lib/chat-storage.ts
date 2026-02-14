const LEGACY_CHAT_STORAGE_KEY = "eden.chat.v1";
const LEGACY_CHAT_SESSION_KEY = "eden.chat.session.v1";

const LEGACY_ROOM_KEYS = [
  "eden.chat.depleting.v1",
  "eden.chat.crossing.v1",
  "eden.chat.hoarding.v1",
  "eden.chat.session.depleting.v1",
  "eden.chat.session.crossing.v1",
  "eden.chat.session.hoarding.v1",
];

export function getChatStorageKey(userId?: string | null): string {
  return userId ? `eden.chat.${userId}.v1` : LEGACY_CHAT_STORAGE_KEY;
}

export function getChatSessionKey(userId?: string | null): string {
  return userId
    ? `eden.chat.session.${userId}.v1`
    : LEGACY_CHAT_SESSION_KEY;
}

export function clearChatCacheForUser(userId?: string | null) {
  if (typeof window === "undefined") return;

  const keys = new Set<string>([
    LEGACY_CHAT_STORAGE_KEY,
    LEGACY_CHAT_SESSION_KEY,
    ...LEGACY_ROOM_KEYS,
  ]);

  if (userId) {
    keys.add(getChatStorageKey(userId));
    keys.add(getChatSessionKey(userId));
  }

  for (const key of keys) {
    localStorage.removeItem(key);
  }
}
