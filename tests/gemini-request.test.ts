import test from "node:test";
import assert from "node:assert/strict";

import {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";

import {
  getGeminiErrorStatus,
  isRetryableGeminiError,
  retryGeminiRequest,
} from "@/lib/gemini-request";

test("getGeminiErrorStatus extracts HTTP status from SDK fetch errors", () => {
  const error = new GoogleGenerativeAIFetchError("upstream 503", 503, "Service Unavailable");

  assert.equal(getGeminiErrorStatus(error), 503);
});

test("isRetryableGeminiError treats 5xx and abort errors as retryable", () => {
  assert.equal(
    isRetryableGeminiError(new GoogleGenerativeAIFetchError("upstream 503", 503, "Service Unavailable")),
    true,
  );
  assert.equal(
    isRetryableGeminiError(new GoogleGenerativeAIAbortError("request aborted")),
    true,
  );
});

test("isRetryableGeminiError rejects non-retryable 4xx input failures", () => {
  assert.equal(
    isRetryableGeminiError(new GoogleGenerativeAIFetchError("bad request", 400, "Bad Request")),
    false,
  );
  assert.equal(
    isRetryableGeminiError(new GoogleGenerativeAIError("model returned malformed content")),
    false,
  );
});

test("retryGeminiRequest retries transient upstream errors before succeeding", async () => {
  let attempts = 0;

  const result = await retryGeminiRequest({
    operationLabel: "test-retry",
    maxRetries: 2,
    task: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new GoogleGenerativeAIFetchError("busy", 503, "Service Unavailable");
      }
      return "ok";
    },
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("retryGeminiRequest stops immediately for non-retryable errors", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      retryGeminiRequest({
        operationLabel: "test-no-retry",
        maxRetries: 2,
        task: async () => {
          attempts += 1;
          throw new GoogleGenerativeAIFetchError("bad request", 400, "Bad Request");
        },
      }),
    /bad request/i,
  );

  assert.equal(attempts, 1);
});
