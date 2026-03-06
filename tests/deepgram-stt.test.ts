import test from "node:test";
import assert from "node:assert/strict";

import {
  DeepgramApiError,
  extractDeepgramTranscript,
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
