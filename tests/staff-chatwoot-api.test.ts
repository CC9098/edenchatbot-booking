import assert from "node:assert/strict";
import test from "node:test";

import { staffChatwootRequest } from "@/lib/staff-chatwoot-api";

test("sends Chatwoot filter requests as JSON POST without exposing the token in the URL", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;

  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ payload: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await staffChatwootRequest(
      "https://chatwoot.example.test",
      "secret-token",
      "/api/v1/accounts/2/conversations/filter",
      {
        method: "POST",
        body: { page: 2 },
      },
    );

    assert.equal(
      requestedUrl,
      "https://chatwoot.example.test/api/v1/accounts/2/conversations/filter",
    );
    assert.equal(requestedInit?.method, "POST");
    assert.equal(requestedInit?.body, JSON.stringify({ page: 2 }));
    assert.equal((requestedInit?.headers as Record<string, string>).api_access_token, "secret-token");
    assert.equal(requestedUrl.includes("secret-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
