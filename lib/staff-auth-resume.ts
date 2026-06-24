import { sanitizeAuthNextPath } from "@/lib/auth-redirect";

export const STAFF_AUTH_RESUME_STORAGE_KEY = "eden.staffAuth.resumeNext";

const STAFF_AUTH_RESUME_TTL_MS = 10 * 60 * 1000;

type PendingStaffAuthResume = {
  path: string;
  expiresAt: number;
};

export function isStaffAuthPath(path: string) {
  return (
    path === "/doctor" ||
    path.startsWith("/doctor/") ||
    path.startsWith("/doctor?") ||
    path === "/nurse" ||
    path.startsWith("/nurse/") ||
    path.startsWith("/nurse?")
  );
}

export function createPendingStaffAuthResume(
  nextPath: string,
  now = Date.now(),
): PendingStaffAuthResume | null {
  const safePath = sanitizeAuthNextPath(nextPath);
  if (!isStaffAuthPath(safePath)) return null;

  return {
    path: safePath,
    expiresAt: now + STAFF_AUTH_RESUME_TTL_MS,
  };
}

export function parsePendingStaffAuthResume(raw: string | null, now = Date.now()) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingStaffAuthResume>;
    if (typeof parsed.path !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    if (parsed.expiresAt < now) return null;

    const safePath = sanitizeAuthNextPath(parsed.path);
    if (!isStaffAuthPath(safePath)) return null;

    return safePath;
  } catch {
    return null;
  }
}

export function shouldResumeStaffAuthFromLocation(pathname: string, hasLoginNext: boolean) {
  return pathname === "/" || pathname === "/chat" || (pathname === "/login" && !hasLoginNext);
}
