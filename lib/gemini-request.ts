import {
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
} from "@google/generative-ai";

export const RETRYABLE_GEMINI_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface RetryGeminiRequestOptions<T> {
  operationLabel: string;
  maxRetries: number;
  task: () => Promise<T>;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getGeminiErrorStatus(error: unknown): number | null {
  if (error instanceof GoogleGenerativeAIFetchError && typeof error.status === "number") {
    return error.status;
  }

  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  const message = error instanceof Error ? error.message : String(error);
  const bracketStatusMatch = message.match(/\[(\d{3})\s/);
  if (bracketStatusMatch) {
    return Number(bracketStatusMatch[1]);
  }

  const bareStatusMatch = message.match(/\b(408|425|429|500|502|503|504)\b/);
  if (bareStatusMatch) {
    return Number(bareStatusMatch[1]);
  }

  return null;
}

export function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof GoogleGenerativeAIAbortError) return true;

  const status = getGeminiErrorStatus(error);
  if (status !== null) {
    return RETRYABLE_GEMINI_STATUS_CODES.has(status);
  }

  if (error instanceof GoogleGenerativeAIFetchError) return true;

  if (error instanceof GoogleGenerativeAIError) {
    return error.message.includes("Error fetching from");
  }

  return false;
}

export async function retryGeminiRequest<T>({
  operationLabel,
  maxRetries,
  task,
}: RetryGeminiRequestOptions<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error) || attempt >= maxRetries) {
        throw error;
      }

      const status = getGeminiErrorStatus(error);
      console.warn(`[gemini-request] ${operationLabel} retry ${attempt + 1}/${maxRetries}`, {
        status,
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(600 * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${operationLabel} failed after retry attempts`);
}
