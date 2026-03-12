import assert from "node:assert/strict";
import test from "node:test";

import { buildGoogleOAuthOptions } from "@/lib/auth-redirect";

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
