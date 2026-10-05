import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { establishSessionForUser, ensureSupabaseUserForPhone } from "@/lib/whatsapp-auth-bridge";
import { getLoginOtpSecret, verifyLoginOtp } from "@/lib/phone-login";

const user = {
  id: "11111111-1111-4111-8111-111111111111", aud: "authenticated",
  email: "wa_85290000001@whatsapp.internal", phone: "85290000001",
  phone_confirmed_at: "2026-10-05T00:00:00Z", created_at: "2026-10-05T00:00:00Z",
  app_metadata: {}, user_metadata: {},
};
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

async function withAuthMock(run: () => Promise<void>, handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const keys = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_JWT_SECRET", "WIDGET_BOOKING_OTP_SECRET"];
  const env = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL = "https://login-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  delete process.env.SUPABASE_JWT_SECRET;
  delete process.env.WIDGET_BOOKING_OTP_SECRET;
  global.fetch = async (input, init) => handler(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), init);
  try { await run(); } finally {
    global.fetch = originalFetch;
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  }
}

function sessionResponse() {
  const payload = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 };
  const access = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.test-signature`;
  return json({ access_token: access, refresh_token: "issued-by-auth-server", expires_in: 3600, token_type: "bearer", user });
}

test("WhatsApp login exchanges a server-only token for real SSR cookies without a JWT signing secret", async () => {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const paths: string[] = [];
  await withAuthMock(async () => {
    const result = await establishSessionForUser(user.id, (name, value, options) => cookies.push({ name, value, options }));
    assert.equal(result.success, true);
    assert.deepEqual(paths, ["/auth/v1/admin/users/" + user.id, "/auth/v1/admin/generate_link", "/auth/v1/verify"]);
    const cookie = cookies.find((entry) => entry.name.startsWith("sb-login-test-auth-token"));
    assert.ok(cookie);
    assert.ok(cookie.value.startsWith("base64-"));
    const session = JSON.parse(Buffer.from(cookie.value.slice(7), "base64url").toString());
    assert.equal(session.refresh_token, "issued-by-auth-server");
    assert.equal(session.user.id, user.id);
    assert.notEqual(cookie.options.httpOnly, true);
    assert.ok(Number(cookie.options.maxAge) > 3600);
  }, (url, init) => {
    paths.push(url.pathname);
    if (url.pathname.endsWith("/generate_link")) {
      assert.equal(JSON.parse(String(init?.body)).type, "magiclink");
      return json({ ...user, hashed_token: "server-only-token", verification_type: "magiclink" });
    }
    if (url.pathname.endsWith("/verify")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.token_hash, "server-only-token");
      assert.equal(body.type, "email");
      return sessionResponse();
    }
    return json(user);
  });
});

test("a token for another account never writes a login cookie", async () => {
  let written = false;
  await withAuthMock(async () => {
    const result = await establishSessionForUser(user.id, () => { written = true; });
    assert.equal(result.success, false);
    assert.equal(written, false);
  }, (url) => url.pathname.endsWith("/generate_link")
    ? json({ ...user, id: "another-account", hashed_token: "wrong-account-token" })
    : json(user));
});

test("an editable profile phone cannot be used to log in to another account", async () => {
  await withAuthMock(async () => {
    const result = await ensureSupabaseUserForPhone({ phoneDigits: "90000001", phoneE164: "+85290000001" });
    assert.equal(result.userId, user.id);
  }, (url, init) => {
    if (url.pathname === "/rest/v1/profiles") return json(init?.method === "POST" ? [] : [{ id: "22222222-2222-4222-8222-222222222222" }]);
    if (url.pathname.endsWith("/users/22222222-2222-4222-8222-222222222222")) return json({ ...user, id: "22222222-2222-4222-8222-222222222222", phone: "85290000002" });
    if (url.pathname === "/auth/v1/admin/users") return json({ users: [user] });
    throw new Error("Unexpected auth request: " + url.pathname);
  });
});

test("parallel verification consumes an OTP once and establishes only one session", async () => {
  let claimed = false;
  let sessionCount = 0;
  await withAuthMock(async () => {
    const results = await Promise.all([1, 2].map(() => verifyLoginOtp({ phone: "90000001", code: "123456", setCookie: () => {} })));
    assert.equal(results.filter((result) => result.success).length, 1);
    assert.equal(sessionCount, 1);
  }, (url, init) => {
    if (url.pathname === "/rest/v1/widget_booking_verifications") {
      if (init?.method === "PATCH") {
        assert.equal(url.searchParams.get("consumed_at"), "is.null");
        assert.ok(url.searchParams.get("expires_at")?.startsWith("gt."));
        const result = claimed ? [] : [{ id: "verification-id" }];
        claimed = true;
        return json(result);
      }
      return json([{
        id: "verification-id", phone_digits: "85290000001", attempt_count: 0, max_attempts: 5,
        code_hash: createHmac("sha256", getLoginOtpSecret()).update("widget-booking-otp:verification-id:85290000001:123456").digest("base64url"),
        expires_at: new Date(Date.now() + 600_000).toISOString(), consumed_at: null,
      }]);
    }
    if (url.pathname === "/rest/v1/profiles") return json(init?.method === "POST" ? [] : [{ id: user.id }]);
    if (url.pathname.endsWith("/generate_link")) return json({ ...user, hashed_token: "server-only-token" });
    if (url.pathname.endsWith("/verify")) { sessionCount++; return sessionResponse(); }
    return json(user);
  });
});

test("a synthetic email cannot select an account whose confirmed phone has changed", async () => {
  await withAuthMock(async () => {
    const result = await ensureSupabaseUserForPhone({ phoneDigits: "90000001", phoneE164: "+85290000001" });
    assert.equal(result.userId, undefined);
    assert.ok(result.error);
  }, (url, init) => {
    if (url.pathname === "/rest/v1/profiles") return json([]);
    if (url.pathname === "/auth/v1/admin/users" && init?.method === "POST") {
      return new Response(JSON.stringify({ msg: "User already registered", code: "email_exists" }), {
        status: 422, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/auth/v1/admin/users") return json({ users: [{ ...user, phone: "85290000002" }] });
    throw new Error("Unexpected auth request: " + url.pathname);
  });
});
