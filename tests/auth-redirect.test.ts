import assert from "node:assert/strict";
import test from "node:test";

import { buildGoogleOAuthOptions } from "@/lib/auth-redirect";
import {
  createPendingStaffAuthResume,
  parsePendingStaffAuthResume,
  shouldResumeStaffAuthFromLocation,
} from "@/lib/staff-auth-resume";

test("buildGoogleOAuthOptions forces account chooser on web login", () => {
  const options = buildGoogleOAuthOptions("/doctor");
  const redirectUrl = new URL(options.redirectTo);

  assert.equal(options.queryParams.prompt, "select_account");
  assert.equal(options.skipBrowserRedirect, undefined);
  assert.equal(redirectUrl.pathname, "/api/auth/callback");
  assert.equal(redirectUrl.searchParams.get("next"), "/doctor");
});

test("buildGoogleOAuthOptions keeps native login in in-app browser flow", () => {
  const options = buildGoogleOAuthOptions("/doctor", true);
  const redirectUrl = new URL(options.redirectTo);

  assert.equal(options.queryParams.prompt, "select_account");
  assert.equal(options.skipBrowserRedirect, true);
  assert.equal(redirectUrl.protocol, "com.cc9098.edenchatbotbooking:");
  assert.equal(redirectUrl.pathname, "/callback");
  assert.equal(redirectUrl.searchParams.get("next"), "/doctor");
});

test("staff auth resume only stores doctor and nurse destinations", () => {
  const now = 1_000;

  assert.deepEqual(createPendingStaffAuthResume("/nurse/knowledge", now), {
    path: "/nurse/knowledge",
    expiresAt: now + 10 * 60 * 1000,
  });
  assert.deepEqual(createPendingStaffAuthResume("/doctor?tab=bookings", now), {
    path: "/doctor?tab=bookings",
    expiresAt: now + 10 * 60 * 1000,
  });
  assert.equal(createPendingStaffAuthResume("/chat", now), null);
  assert.equal(createPendingStaffAuthResume("https://evil.example/nurse", now), null);
});

test("staff auth resume rejects expired or non-staff stored paths", () => {
  assert.equal(
    parsePendingStaffAuthResume(JSON.stringify({ path: "/nurse/knowledge", expiresAt: 2_000 }), 1_500),
    "/nurse/knowledge",
  );
  assert.equal(
    parsePendingStaffAuthResume(JSON.stringify({ path: "/nurse/knowledge", expiresAt: 2_000 }), 2_001),
    null,
  );
  assert.equal(
    parsePendingStaffAuthResume(JSON.stringify({ path: "/chat", expiresAt: 2_000 }), 1_500),
    null,
  );
  assert.equal(parsePendingStaffAuthResume("not-json", 1_500), null);
});

test("staff auth resume only runs from fallback destinations", () => {
  assert.equal(shouldResumeStaffAuthFromLocation("/", false), true);
  assert.equal(shouldResumeStaffAuthFromLocation("/chat", false), true);
  assert.equal(shouldResumeStaffAuthFromLocation("/login", false), true);
  assert.equal(shouldResumeStaffAuthFromLocation("/login", true), false);
  assert.equal(shouldResumeStaffAuthFromLocation("/booking", false), false);
  assert.equal(shouldResumeStaffAuthFromLocation("/nurse/knowledge", false), false);
});
