/**
 * Resolve phone accounts after WhatsApp verification and exchange a server-only
 * Supabase magic-link token for a real, refreshable Auth session. generateLink
 * does not send an email; the token hash never leaves this server module.
 */

import { createServerClient } from "@supabase/ssr";

import { normalizePhoneForSearch, toHKE164 } from "@/lib/contact-utils";

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
  const { displayNameHint } = params;
  const phoneE164 = toHKE164(params.phoneE164);
  const phoneDigits = normalizePhoneForSearch(phoneE164);

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
      .in("phone_digits", phoneDigits.startsWith("852") && phoneDigits.length === 11
        ? [phoneDigits, phoneDigits.slice(3)]
        : [phoneDigits])
      .limit(10);

    if (profileErr) {
      console.error("[whatsapp-auth-bridge] profiles lookup error:", profileErr.message);
      // Non-fatal — fall through to auth.users search.
    } else if (profileRows && profileRows.length > 0) {
      // A profile phone is editable contact information, not proof of ownership.
      // Reuse only an Auth account whose confirmed phone matches the OTP phone.
      for (const profile of profileRows) {
        const userId = profile.id as string;
        const { data, error } = await supabase.auth.admin.getUserById(userId);
        if (!error && data.user?.phone_confirmed_at &&
            normalizePhoneForSearch(toHKE164(data.user.phone || "")) === phoneDigits) {
          return { userId, created: false };
        }
      }
    }

    // ------------------------------------------------------------------
    // Step 2: Look up auth.users via the Supabase Admin REST endpoint.
    // The JS admin SDK only exposes listUsers (paginated, no email filter).
    // We use the REST API directly: GET /auth/v1/admin/users?filter=<email>
    // with the service_role key, which is what supabase-js does internally.
    // ------------------------------------------------------------------
    const syntheticEmail = syntheticEmailForPhone(phoneDigits);
    const existingUserId = await findAuthUserIdByEmail(syntheticEmail, phoneDigits);

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
        const retryId = await findAuthUserIdByEmail(syntheticEmail, phoneDigits);
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
async function findAuthUserIdByEmail(email: string, phoneDigits: string): Promise<string | null> {
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
  type AdminUsersResponse = { users?: Array<{ id: string; email?: string; phone?: string; phone_confirmed_at?: string }> };
  const json = (await res.json()) as AdminUsersResponse;
  const match = json.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase() &&
    u.phone_confirmed_at && normalizePhoneForSearch(toHKE164(u.phone || "")) === phoneDigits);
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

/** Called only after the caller has verified ownership of the phone. */
export async function establishSessionForUser(
  userId: string,
  setCookie: CookieSetter,
): Promise<EstablishSessionResult> {
  try {
    const admin = createServiceClient();
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    if (userError || !email) {
      return { success: false, error: "Unable to resolve the verified account." };
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link?.properties?.hashed_token || link.user?.id !== userId) {
      return { success: false, error: "Unable to create the verified account session." };
    }

    const pendingCookies: Array<Parameters<CookieSetter>> = [];
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: (cookies) => {
            for (const { name, value, options } of cookies) {
              pendingCookies.push([name, value, options]);
            }
          },
        },
      },
    );
    const { data, error } = await client.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    if (error || !data.session || data.user?.id !== userId) {
      return { success: false, error: "Unable to establish the verified account session." };
    }

    // Keep the SDK's cookie encoding/chunking and refresh-token persistence.
    for (const cookie of pendingCookies) setCookie(...cookie);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to establish the verified account session.",
    };
  }
}
