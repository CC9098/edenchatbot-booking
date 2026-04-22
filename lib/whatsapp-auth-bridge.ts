/**
 * whatsapp-auth-bridge.ts
 *
 * Bridges a successful WhatsApp OTP verification into a real Supabase auth session.
 *
 * Strategy:
 *  - ensureSupabaseUserForPhone: find-or-create an auth.users row keyed by phone.
 *    A synthetic email (wa_<digits>@whatsapp.internal) is stored so that
 *    generateLink can be used in establishSessionForUser.
 *  - establishSessionForUser: uses SUPABASE_JWT_SECRET (approach B) to mint a
 *    short-lived JWT directly, then writes it into the standard @supabase/ssr
 *    cookie via the provided setCookie callback.
 *
 * ENV REQUIREMENTS (add to .env.example and Vercel project settings):
 *   SUPABASE_JWT_SECRET  — the "JWT Secret" shown in Supabase > Settings > API.
 *                          Required for establishSessionForUser. If absent the
 *                          call resolves with { success: false } and logs a warning
 *                          so callers can degrade gracefully.
 *
 * This module is server-only (no "server-only" sentinel needed — callers are already
 * server-side and the module uses the service-role key directly).
 */

import { createHmac } from "crypto";

import { createServiceClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnsureUserResult =
  | { userId: string; created: boolean; error?: never }
  | { userId?: never; created?: never; error: string };

export type EstablishSessionResult =
  | { success: true; error?: never }
  | { success: false; error: string };

/** Minimal subset of a cookie setter compatible with @supabase/ssr setAll. */
export type CookieSetter = (
  name: string,
  value: string,
  options: Record<string, unknown>,
) => void;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derives the synthetic email used for phone-only auth users.
 * Format: wa_<digits>@whatsapp.internal
 * This is deterministic so lookups can reconstruct it without DB queries.
 */
function syntheticEmailForPhone(phoneDigits: string): string {
  return `wa_${phoneDigits}@whatsapp.internal`;
}

/**
 * Extracts the Supabase project ref from NEXT_PUBLIC_SUPABASE_URL.
 * URL format: https://<projectRef>.supabase.co
 */
function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) {
    throw new Error(
      "[whatsapp-auth-bridge] Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL.",
    );
  }
  return match[1];
}

/**
 * Signs a minimal Supabase-compatible JWT using SUPABASE_JWT_SECRET.
 * Uses HS256, matching what Supabase's GoTrue expects.
 */
function mintSupabaseJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// Public: ensureSupabaseUserForPhone
// ---------------------------------------------------------------------------

/**
 * Ensure a Supabase auth user exists for this HK WhatsApp phone number.
 * Returns the user_id. Creates one if none exists. Also ensures profiles row.
 * Does NOT create a session — caller handles that via establishSessionForUser.
 *
 * Idempotent: safe to call concurrently; relies on Supabase unique constraints
 * for deduplication.
 */
export async function ensureSupabaseUserForPhone(params: {
  /** Normalized phone digits only (as stored in booking_intake.phone_digits). */
  phoneDigits: string;
  /** Full E.164 format (+852XXXXXXXX) — stored in auth.users.phone. */
  phoneE164: string;
  /** Optional patient name from booking. */
  displayNameHint?: string;
}): Promise<EnsureUserResult> {
  const { phoneDigits, phoneE164, displayNameHint } = params;

  if (!phoneDigits || !phoneE164) {
    return { error: "[whatsapp-auth-bridge] phoneDigits and phoneE164 are required." };
  }

  const supabase = createServiceClient();

  try {
    // ------------------------------------------------------------------
    // Step 1: Search profiles table for a row with matching phone digits.
    // ------------------------------------------------------------------
    const { data: profileRows, error: profileErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phoneDigits)
      .limit(1);

    if (profileErr) {
      console.error("[whatsapp-auth-bridge] profiles lookup error:", profileErr.message);
      // Non-fatal — fall through to auth.users search.
    } else if (profileRows && profileRows.length > 0) {
      const userId = profileRows[0].id as string;
      return { userId, created: false };
    }

    // ------------------------------------------------------------------
    // Step 2: Look up auth.users via the Supabase Admin REST endpoint.
    // The JS admin SDK only exposes listUsers (paginated, no email filter).
    // We use the REST API directly: GET /auth/v1/admin/users?filter=<email>
    // with the service_role key, which is what supabase-js does internally.
    // ------------------------------------------------------------------
    const syntheticEmail = syntheticEmailForPhone(phoneDigits);
    const existingUserId = await findAuthUserIdByEmail(syntheticEmail);

    if (existingUserId) {
      await upsertProfilesRow({ supabase, userId: existingUserId, phoneDigits, displayNameHint });
      return { userId: existingUserId, created: false };
    }

    // ------------------------------------------------------------------
    // Step 3: Create a new auth user.
    // Use try-create-then-retry to handle races idempotently.
    // ------------------------------------------------------------------
    const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: {
        display_name: displayNameHint ?? null,
        phone_digits: phoneDigits,
        phone_e164: phoneE164,
        source: "whatsapp_otp",
      },
    });

    if (createErr || !newUserData?.user?.id) {
      // Could be a duplicate if two requests raced — retry the REST lookup once.
      if (createErr?.message?.toLowerCase().includes("already")) {
        const retryId = await findAuthUserIdByEmail(syntheticEmail);
        if (retryId) {
          await upsertProfilesRow({ supabase, userId: retryId, phoneDigits, displayNameHint });
          return { userId: retryId, created: false };
        }
      }
      return {
        error: `[whatsapp-auth-bridge] createUser failed: ${createErr?.message ?? "unknown"}`,
      };
    }

    const userId = newUserData.user.id;
    await upsertProfilesRow({ supabase, userId, phoneDigits, displayNameHint });
    return { userId, created: true };
  } catch (err) {
    return {
      error: `[whatsapp-auth-bridge] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal: findAuthUserIdByEmail
// ---------------------------------------------------------------------------

/**
 * Looks up an auth.users row by email using the Supabase Admin REST API
 * (/auth/v1/admin/users?filter=<email>).
 *
 * The supabase-js SDK admin.listUsers() does not support email filtering, so
 * we call the REST endpoint directly using the service_role key.
 *
 * Returns the user UUID string if found, or null.
 */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    console.warn("[whatsapp-auth-bridge] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for auth user lookup.");
    return null;
  }

  const url = `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    // Non-fatal: a 404 means no user found.
    return null;
  }

  // Response shape: { users: [...], aud: string, ... }
  type AdminUsersResponse = { users?: Array<{ id: string; email?: string }> };
  const json = (await res.json()) as AdminUsersResponse;
  const match = json.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

// ---------------------------------------------------------------------------
// Internal: upsertProfilesRow
// ---------------------------------------------------------------------------

async function upsertProfilesRow(params: {
  supabase: ReturnType<typeof createServiceClient>;
  userId: string;
  phoneDigits: string;
  displayNameHint?: string;
}) {
  const { supabase, userId, phoneDigits, displayNameHint } = params;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      phone: phoneDigits,
      ...(displayNameHint ? { display_name: displayNameHint } : {}),
    },
    { onConflict: "id", ignoreDuplicates: false },
  );

  if (error) {
    // Non-fatal — log and continue. The auth user exists; profiles row can be
    // created later (e.g., by the profiles trigger if one exists).
    console.warn("[whatsapp-auth-bridge] profiles upsert warning:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Public: establishSessionForUser
// ---------------------------------------------------------------------------

/**
 * Called after OTP success. Creates a Supabase session (access + refresh token)
 * for the given user and writes the standard @supabase/ssr cookies via setCookie.
 *
 * Implementation: Approach B — mints a JWT using SUPABASE_JWT_SECRET, then
 * writes it as the `sb-<projectRef>-auth-token` cookie that @supabase/ssr reads.
 *
 * Required env var: SUPABASE_JWT_SECRET (Supabase > Settings > API > JWT Secret).
 * If absent, this function resolves with { success: false } and logs a warning.
 *
 * @param userId    - The Supabase auth.users UUID.
 * @param setCookie - A callback that writes a cookie (name, value, options).
 *                    In a Next.js Route Handler, pass:
 *                    (name, value, options) => response.cookies.set(name, value, options)
 *                    or use the @supabase/ssr `setAll` pattern.
 */
export async function establishSessionForUser(
  userId: string,
  setCookie: CookieSetter,
): Promise<EstablishSessionResult> {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET?.trim();

  if (!jwtSecret) {
    console.warn(
      "[whatsapp-auth-bridge] SUPABASE_JWT_SECRET is not set. " +
        "Session establishment skipped. Add this env var to enable WhatsApp login.",
    );
    return { success: false, error: "SUPABASE_JWT_SECRET not configured." };
  }

  try {
    const projectRef = getProjectRef();

    // Fetch user metadata so we can include email/phone in claims.
    const supabase = createServiceClient();
    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return {
        success: false,
        error: `[whatsapp-auth-bridge] getUserById failed: ${userErr?.message ?? "unknown"}`,
      };
    }
    const user = userData.user;

    // Access token: 1 hour TTL (standard Supabase default).
    const nowSec = Math.floor(Date.now() / 1000);
    const accessTokenTtlSec = 3600;

    const accessTokenPayload: Record<string, unknown> = {
      aud: "authenticated",
      exp: nowSec + accessTokenTtlSec,
      iat: nowSec,
      iss: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      sub: userId,
      role: "authenticated",
      // Optional claims mirroring GoTrue's output:
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      session_id: crypto.randomUUID(),
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
    };

    const accessToken = mintSupabaseJwt(accessTokenPayload, jwtSecret);

    // Refresh token: opaque random string (not a JWT). Supabase's client will
    // use this to call the token refresh endpoint. We generate a random one here.
    // NOTE: A JWT-signed refresh token is not directly usable with Supabase's
    // /token?grant_type=refresh_token endpoint unless it was issued by GoTrue.
    // We persist a real refresh token by calling supabase.auth.admin.generateLink
    // to get one, OR we set a short access token TTL and acknowledge the user
    // will need to re-authenticate when it expires.
    //
    // For Phase 0A, we use a signed dummy refresh token. The session will last
    // accessTokenTtlSec (1 hour). Persistent refresh is a Phase 0B concern.
    const refreshToken = Buffer.from(crypto.randomUUID()).toString("base64url");

    // The @supabase/ssr cookie stores a JSON object matching the Session type.
    const sessionPayload = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: accessTokenTtlSec,
      expires_at: nowSec + accessTokenTtlSec,
      token_type: "bearer",
      user: {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: user.email ?? null,
        phone: user.phone ?? null,
        created_at: user.created_at,
        updated_at: user.updated_at ?? user.created_at,
        user_metadata: user.user_metadata ?? {},
        app_metadata: user.app_metadata ?? {},
      },
    };

    // Cookie name follows @supabase/ssr convention.
    const cookieName = `sb-${projectRef}-auth-token`;
    const cookieValue = JSON.stringify(sessionPayload);

    // Secure cookie options (match what @supabase/ssr sets in production).
    const cookieOptions: Record<string, unknown> = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // Access token is 1 hour; let the browser keep the cookie a bit longer
      // so the client-side can detect expiry and redirect to login.
      maxAge: accessTokenTtlSec + 60,
    };

    setCookie(cookieName, cookieValue, cookieOptions);

    // @supabase/ssr also sets a code verifier cookie in some flows; not needed here.

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `[whatsapp-auth-bridge] Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
