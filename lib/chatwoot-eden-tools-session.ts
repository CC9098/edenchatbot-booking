import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  AuthError,
  getCurrentUser,
  requireStaffRole,
  type StaffRoleName,
  type StaffRoleResult,
} from "@/lib/auth-helpers";
import type { StaffKind } from "@/lib/staff-access";

const DEFAULT_TTL_MS = 30 * 60 * 1000;

type TokenOptions = {
  now?: number;
  ttlMs?: number;
};

export type ChatwootEdenToolsSessionPayload = {
  userId: string;
  role: StaffRoleName;
  staffKind: StaffKind | null;
  expiresAt: number;
};

type SignedPayload = ChatwootEdenToolsSessionPayload & {
  nonce: string;
};

function getSessionSecret(): string {
  const secret = (
    process.env.CHATWOOT_EDEN_TOOLS_SESSION_SECRET ||
    process.env.CHATWOOT_WEBHOOK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();

  if (!secret) {
    throw new Error("Chatwoot Eden tools session secret is not configured");
  }

  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createChatwootEdenToolsSessionToken(
  staff: Pick<StaffRoleResult, "user_id" | "role" | "staff_kind"> | {
    userId: string;
    role: StaffRoleName;
    staffKind: StaffKind | null;
  },
  options: TokenOptions = {},
): string {
  const now = options.now ?? Date.now();
  const payload: SignedPayload = {
    userId: "userId" in staff ? staff.userId : staff.user_id,
    role: staff.role,
    staffKind: "staffKind" in staff ? staff.staffKind : staff.staff_kind,
    expiresAt: now + (options.ttlMs ?? DEFAULT_TTL_MS),
    nonce: randomUUID(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyChatwootEdenToolsSessionToken(
  token: string,
  options: Pick<TokenOptions, "now"> = {},
): ChatwootEdenToolsSessionPayload | null {
  try {
    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra) return null;

    const expectedSignature = signPayload(encodedPayload);
    if (!signaturesMatch(signature, expectedSignature)) return null;

    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SignedPayload>;
    if (!payload.userId || !payload.role || typeof payload.expiresAt !== "number") return null;

    const now = options.now ?? Date.now();
    if (payload.expiresAt <= now) return null;

    return {
      userId: payload.userId,
      role: payload.role,
      staffKind: payload.staffKind ?? null,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export function getChatwootEdenToolsRequestToken(request: Pick<Request, "headers">): string | null {
  const authorization = request.headers.get("authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const fallback = request.headers.get("x-eden-chatwoot-tools-token")?.trim();
  return fallback || null;
}

export function verifyChatwootEdenToolsRequest(request: Pick<Request, "headers">) {
  const token = getChatwootEdenToolsRequestToken(request);
  if (!token) return null;
  return verifyChatwootEdenToolsSessionToken(token);
}

export async function requireStaffRoleWithChatwootEdenToolsToken(request: Pick<Request, "headers">) {
  const session = verifyChatwootEdenToolsRequest(request);
  if (session) {
    return {
      userId: session.userId,
      staffRole: {
        user_id: session.userId,
        role: session.role,
        is_active: true,
        staff_kind: session.staffKind,
      } satisfies StaffRoleResult,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError(401, "Unauthorized");
  }

  return {
    userId: user.id,
    staffRole: await requireStaffRole(user.id),
  };
}
