export type DoctorVoiceSttProvider = "deepgram" | "gemini";

export class DeepgramApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DeepgramApiError";
    this.status = status;
  }
}

interface RetryDeepgramRequestOptions<T> {
  operationLabel: string;
  maxRetries: number;
  task: () => Promise<T>;
}

interface DeepgramTranscriptionResult {
  transcript: string;
  model: string;
  language: string;
  requestId: string | null;
}

interface DeepgramGrantTokenResponse {
  access_token?: string;
  expires_in?: number | null;
  err_code?: string;
  err_msg?: string;
}

interface DeepgramAlternative {
  transcript?: string;
}

interface DeepgramChannel {
  alternatives?: DeepgramAlternative[];
}

interface DeepgramResponse {
  metadata?: {
    request_id?: string;
  };
  results?: {
    channels?: DeepgramChannel[];
  };
}

export const RETRYABLE_DEEPGRAM_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveDoctorVoiceSttProvider(
  rawProvider: string | undefined,
  hasDeepgramApiKey: boolean,
): DoctorVoiceSttProvider {
  const normalized = rawProvider?.trim().toLowerCase();
  if (normalized === "deepgram") return "deepgram";
  if (normalized === "gemini") return "gemini";
  return hasDeepgramApiKey ? "deepgram" : "gemini";
}

export function getDoctorVoiceSttProvider(): DoctorVoiceSttProvider {
  return resolveDoctorVoiceSttProvider(
    process.env.DOCTOR_VOICE_STT_PROVIDER,
    Boolean(process.env.DEEPGRAM_API_KEY),
  );
}

export function getDeepgramDoctorVoiceModel(): string {
  return process.env.DEEPGRAM_DOCTOR_VOICE_MODEL || "nova-2";
}

export function getDeepgramDoctorVoiceLanguage(): string {
  return process.env.DEEPGRAM_DOCTOR_VOICE_LANGUAGE || "zh-HK";
}

export function getDeepgramApiBaseUrl(): string {
  return (process.env.DEEPGRAM_API_BASE_URL || "https://api.deepgram.com").replace(/\/$/, "");
}

export function buildDeepgramListenUrl(baseUrl = getDeepgramApiBaseUrl()): string {
  const params = new URLSearchParams({
    model: getDeepgramDoctorVoiceModel(),
    language: getDeepgramDoctorVoiceLanguage(),
    smart_format: "true",
  });

  return `${baseUrl}/v1/listen?${params.toString()}`;
}

export function buildDeepgramLiveListenWebSocketUrl({
  sampleRate,
  channels = 1,
  baseUrl = getDeepgramApiBaseUrl(),
  endpointingMs = 800,
  utteranceEndMs = 1000,
  interimResults = true,
  smartFormat = true,
  punctuate = true,
  tag,
}: {
  sampleRate: number;
  channels?: number;
  baseUrl?: string;
  endpointingMs?: number;
  utteranceEndMs?: number;
  interimResults?: boolean;
  smartFormat?: boolean;
  punctuate?: boolean;
  tag?: string;
}): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/listen`;

  url.searchParams.set("model", getDeepgramDoctorVoiceModel());
  url.searchParams.set("language", getDeepgramDoctorVoiceLanguage());
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", String(Math.max(8_000, Math.round(sampleRate))));
  url.searchParams.set("channels", String(Math.max(1, Math.round(channels))));
  url.searchParams.set("interim_results", interimResults ? "true" : "false");
  url.searchParams.set("endpointing", String(Math.max(0, Math.round(endpointingMs))));
  url.searchParams.set("utterance_end_ms", String(Math.max(0, Math.round(utteranceEndMs))));
  url.searchParams.set("smart_format", smartFormat ? "true" : "false");
  url.searchParams.set("punctuate", punctuate ? "true" : "false");

  if (tag) {
    url.searchParams.set("tag", tag);
  }

  return url.toString();
}

export function getDeepgramErrorStatus(error: unknown): number | null {
  if (error instanceof DeepgramApiError && typeof error.status === "number") {
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

export function isRetryableDeepgramError(error: unknown): boolean {
  const status = getDeepgramErrorStatus(error);
  if (status !== null) {
    return RETRYABLE_DEEPGRAM_STATUS_CODES.has(status);
  }

  if (error instanceof TypeError) return true;
  if (error instanceof DeepgramApiError) return true;
  return false;
}

export async function retryDeepgramRequest<T>({
  operationLabel,
  maxRetries,
  task,
}: RetryDeepgramRequestOptions<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (!isRetryableDeepgramError(error) || attempt >= maxRetries) {
        throw error;
      }

      const status = getDeepgramErrorStatus(error);
      console.warn(`[deepgram-stt] ${operationLabel} retry ${attempt + 1}/${maxRetries}`, {
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

export function extractDeepgramTranscript(payload: DeepgramResponse): string {
  const channels = Array.isArray(payload.results?.channels) ? payload.results.channels : [];

  return channels
    .map((channel) => {
      const alternatives = Array.isArray(channel.alternatives) ? channel.alternatives : [];
      return alternatives[0]?.transcript?.trim() || "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function transcribeAudioWithDeepgram({
  apiKey,
  audioBuffer,
  mimeType,
  fetchFn = fetch,
  maxRetries = 2,
}: {
  apiKey: string;
  audioBuffer: Buffer;
  mimeType: string;
  fetchFn?: typeof fetch;
  maxRetries?: number;
}): Promise<DeepgramTranscriptionResult> {
  return retryDeepgramRequest({
    operationLabel: "deepgram-transcription",
    maxRetries,
    task: async () => {
      const response = await fetchFn(buildDeepgramListenUrl(), {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": mimeType,
        },
        body: new Uint8Array(audioBuffer),
      });

      const payload = (await response.json().catch(() => ({}))) as DeepgramResponse & {
        err_code?: string;
        err_msg?: string;
      };

      if (!response.ok) {
        const errorMessage =
          payload.err_msg ||
          payload.err_code ||
          `Deepgram request failed with status ${response.status}`;
        throw new DeepgramApiError(errorMessage, response.status);
      }

      const transcript = extractDeepgramTranscript(payload);
      if (!transcript) {
        throw new DeepgramApiError("Deepgram transcript is empty", 502);
      }

      return {
        transcript,
        model: getDeepgramDoctorVoiceModel(),
        language: getDeepgramDoctorVoiceLanguage(),
        requestId: payload.metadata?.request_id || null,
      };
    },
  });
}

export async function grantDeepgramTemporaryToken({
  apiKey,
  ttlSeconds = 60,
  fetchFn = fetch,
  baseUrl = getDeepgramApiBaseUrl(),
}: {
  apiKey: string;
  ttlSeconds?: number;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}): Promise<{
  accessToken: string;
  expiresIn: number | null;
}> {
  return retryDeepgramRequest({
    operationLabel: "deepgram-temporary-token",
    maxRetries: 1,
    task: async () => {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, "")}/v1/auth/grant`, {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ttl_seconds: Math.min(3600, Math.max(1, Math.round(ttlSeconds))),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as DeepgramGrantTokenResponse;
      if (!response.ok) {
        const errorMessage =
          payload.err_msg ||
          payload.err_code ||
          `Deepgram token grant failed with status ${response.status}`;
        throw new DeepgramApiError(errorMessage, response.status);
      }

      const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
      if (!accessToken) {
        throw new DeepgramApiError("Deepgram temporary token is empty", 502);
      }

      return {
        accessToken,
        expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
      };
    },
  });
}
