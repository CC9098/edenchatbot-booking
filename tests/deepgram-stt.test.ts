import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeepgramLiveListenWebSocketUrl,
  DeepgramApiError,
  extractDeepgramTranscript,
  grantDeepgramTemporaryToken,
  getDeepgramLiveApiKey,
  getDeepgramErrorStatus,
  isRetryableDeepgramError,
  resolveDoctorVoiceSttProvider,
  retryDeepgramRequest,
} from "@/lib/deepgram-stt";

test("resolveDoctorVoiceSttProvider prefers explicit provider over auto-detection", () => {
  assert.equal(resolveDoctorVoiceSttProvider("deepgram", false), "deepgram");
  assert.equal(resolveDoctorVoiceSttProvider("gemini", true), "gemini");
  assert.equal(resolveDoctorVoiceSttProvider(undefined, true), "deepgram");
  assert.equal(resolveDoctorVoiceSttProvider(undefined, false), "gemini");
});

test("getDeepgramLiveApiKey prefers live key over general key", () => {
  const originalLiveKey = process.env.DEEPGRAM_LIVE_API_KEY;
  const originalGeneralKey = process.env.DEEPGRAM_API_KEY;

  try {
    process.env.DEEPGRAM_LIVE_API_KEY = "live-key";
    process.env.DEEPGRAM_API_KEY = "general-key";
    assert.equal(getDeepgramLiveApiKey(), "live-key");

    delete process.env.DEEPGRAM_LIVE_API_KEY;
    assert.equal(getDeepgramLiveApiKey(), "general-key");
  } finally {
    if (originalLiveKey === undefined) {
      delete process.env.DEEPGRAM_LIVE_API_KEY;
    } else {
      process.env.DEEPGRAM_LIVE_API_KEY = originalLiveKey;
    }

    if (originalGeneralKey === undefined) {
      delete process.env.DEEPGRAM_API_KEY;
    } else {
      process.env.DEEPGRAM_API_KEY = originalGeneralKey;
    }
  }
});

test("extractDeepgramTranscript joins first transcript from each channel", () => {
  const transcript = extractDeepgramTranscript({
    results: {
      channels: [
        { alternatives: [{ transcript: "第一段廣東話" }] },
        { alternatives: [{ transcript: "第二段廣東話" }] },
      ],
    },
  });

  assert.equal(transcript, "第一段廣東話\n\n第二段廣東話");
});

test("buildDeepgramLiveListenWebSocketUrl switches to websockets and includes linear16 params", () => {
  const listenUrl = buildDeepgramLiveListenWebSocketUrl({
    sampleRate: 48_000,
    baseUrl: "https://api.deepgram.com",
    tag: "doctor-live",
  });

  const parsed = new URL(listenUrl);
  assert.equal(parsed.protocol, "wss:");
  assert.equal(parsed.pathname, "/v1/listen");
  assert.equal(parsed.searchParams.get("encoding"), "linear16");
  assert.equal(parsed.searchParams.get("sample_rate"), "48000");
  assert.equal(parsed.searchParams.get("tag"), "doctor-live");
});

test("getDeepgramErrorStatus reads status from typed errors", () => {
  assert.equal(getDeepgramErrorStatus(new DeepgramApiError("busy", 503)), 503);
});

test("isRetryableDeepgramError retries on 5xx and network-style errors", () => {
  assert.equal(isRetryableDeepgramError(new DeepgramApiError("busy", 503)), true);
  assert.equal(isRetryableDeepgramError(new TypeError("fetch failed")), true);
  assert.equal(isRetryableDeepgramError(new DeepgramApiError("bad request", 400)), false);
});

test("retryDeepgramRequest retries transient failures before succeeding", async () => {
  let attempts = 0;

  const result = await retryDeepgramRequest({
    operationLabel: "deepgram-test",
    maxRetries: 2,
    task: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new DeepgramApiError("busy", 503);
      }
      return "ok";
    },
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retryDeepgramRequest stops on non-retryable errors", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      retryDeepgramRequest({
        operationLabel: "deepgram-no-retry",
        maxRetries: 2,
        task: async () => {
          attempts += 1;
          throw new DeepgramApiError("bad request", 400);
        },
      }),
    /bad request/i,
  );

  assert.equal(attempts, 1);
});

test("grantDeepgramTemporaryToken returns access token payload", async () => {
  const token = await grantDeepgramTemporaryToken({
    apiKey: "secret",
    ttlSeconds: 45,
    baseUrl: "https://api.deepgram.com",
    fetchFn: async (input, init) => {
      assert.equal(input, "https://api.deepgram.com/v1/auth/grant");
      assert.equal(init?.method, "POST");
      assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Token secret");
      assert.equal(init?.body, JSON.stringify({ ttl_seconds: 45 }));

      return new Response(
        JSON.stringify({
          access_token: "temporary-token",
          expires_in: 45,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    },
  });

  assert.equal(token.accessToken, "temporary-token");
  assert.equal(token.expiresIn, 45);
});
