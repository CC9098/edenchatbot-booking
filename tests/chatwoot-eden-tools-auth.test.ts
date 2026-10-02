import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATWOOT_EDEN_TOOLS_PATH,
  CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH,
  getChatwootEdenToolsSessionRenewalDelay,
  getChatwootEdenToolsLoginPath,
} from "@/lib/chatwoot-eden-tools-auth";
import {
  createChatwootEdenToolsSessionToken,
  getChatwootEdenToolsRequestToken,
  verifyChatwootEdenToolsSessionToken,
} from "@/lib/chatwoot-eden-tools-session";

test("Chatwoot Eden tools login path keeps users returning to the dashboard app", () => {
  assert.equal(CHATWOOT_EDEN_TOOLS_PATH, "/chatwoot/eden-tools");
  assert.equal(CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH, "/chatwoot/eden-tools/login-bridge");
  assert.equal(
    getChatwootEdenToolsLoginPath(),
    "/login?next=%2Fchatwoot%2Feden-tools%2Flogin-bridge",
  );
});

test("Chatwoot Eden tools renews the short session five minutes before expiry", () => {
  assert.equal(getChatwootEdenToolsSessionRenewalDelay(2_000_000, 1_000_000), 700_000);
  assert.equal(getChatwootEdenToolsSessionRenewalDelay(1_100_000, 1_000_000), 5_000);
});

test("Chatwoot Eden tools session token verifies staff payload", () => {
  process.env.CHATWOOT_EDEN_TOOLS_SESSION_SECRET = "unit-test-secret";

  const token = createChatwootEdenToolsSessionToken(
    {
      userId: "staff-123",
      role: "assistant",
      staffKind: "core_assistant",
    },
    { now: 1_000, ttlMs: 60_000 },
  );

  assert.deepEqual(verifyChatwootEdenToolsSessionToken(token, { now: 30_000 }), {
    userId: "staff-123",
    role: "assistant",
    staffKind: "core_assistant",
    expiresAt: 61_000,
  });
});

test("Chatwoot Eden tools session token rejects expired or tampered tokens", () => {
  process.env.CHATWOOT_EDEN_TOOLS_SESSION_SECRET = "unit-test-secret";

  const token = createChatwootEdenToolsSessionToken(
    {
      userId: "staff-123",
      role: "assistant",
      staffKind: "core_assistant",
    },
    { now: 1_000, ttlMs: 60_000 },
  );

  assert.equal(verifyChatwootEdenToolsSessionToken(token, { now: 61_001 }), null);
  assert.equal(verifyChatwootEdenToolsSessionToken(`${token}x`, { now: 30_000 }), null);
});

test("Chatwoot Eden tools request token can come from bearer or fallback header", () => {
  const bearerRequest = new Request("https://app.edenclinic.hk/api/test", {
    headers: { authorization: "Bearer abc.def" },
  });
  const fallbackRequest = new Request("https://app.edenclinic.hk/api/test", {
    headers: { "x-eden-chatwoot-tools-token": "fallback-token" },
  });

  assert.equal(getChatwootEdenToolsRequestToken(bearerRequest), "abc.def");
  assert.equal(getChatwootEdenToolsRequestToken(fallbackRequest), "fallback-token");
});
