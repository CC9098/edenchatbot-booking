"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const DRAFT_SUMMARY_INTERVAL_SECONDS = 5 * 60;
const ANALYZE_REQUEST_TIMEOUT_MS = 150_000;
const MAX_VOICE_NOTE_REQUEST_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEEPGRAM_KEEP_ALIVE_INTERVAL_MS = 4_000;
const DEEPGRAM_FINALIZE_TIMEOUT_MS = 8_000;
const DEEPGRAM_PROCESSOR_BUFFER_SIZE = 4_096;
const DEEPGRAM_ENDPOINTING_MS = 800;
const DEEPGRAM_UTTERANCE_END_MS = 1_000;
const DEEPGRAM_MAX_BUFFERED_AMOUNT_BYTES = 1_000_000;
const DEEPGRAM_REQUEST_TAG = "doctor-voice-note-live";

type CopyTarget = "transcript" | "record";

interface VoiceNoteResponse {
  transcript?: string;
  recordText?: string;
  error?: string;
}

interface SaveToRecordResponse {
  symptom?: { id?: string };
  error?: string;
}

interface VoiceNoteRequestOptions {
  buildFormData: () => FormData;
  operationLabel: string;
  timeoutMs: number;
}

interface DeepgramLiveTokenResponse {
  accessToken?: string;
  expiresIn?: number | null;
  apiBaseUrl?: string;
  model?: string;
  language?: string;
  error?: string;
}

interface DeepgramLiveMessage {
  type?: string;
  is_final?: boolean;
  from_finalize?: boolean;
  start?: number;
  duration?: number;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
    }>;
  };
  error?: {
    message?: string;
    description?: string;
  };
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;

  const browserWindow = window as Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return browserWindow.AudioContext || browserWindow.webkitAudioContext || null;
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  const matched = candidates.find((item) => MediaRecorder.isTypeSupported(item));
  return matched || "";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function combineTranscriptParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildDeepgramLiveWebSocketUrl({
  apiBaseUrl,
  model,
  language,
  sampleRate,
}: {
  apiBaseUrl: string;
  model: string;
  language: string;
  sampleRate: number;
}) {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/listen`;
  url.searchParams.set("model", model);
  url.searchParams.set("language", language);
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", String(Math.max(8_000, Math.round(sampleRate))));
  url.searchParams.set("channels", "1");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("endpointing", String(DEEPGRAM_ENDPOINTING_MS));
  url.searchParams.set("utterance_end_ms", String(DEEPGRAM_UTTERANCE_END_MS));
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("tag", DEEPGRAM_REQUEST_TAG);
  return url.toString();
}

function float32ToLinear16Pcm(input: Float32Array): ArrayBuffer {
  const output = new ArrayBuffer(input.length * 2);
  const view = new DataView(output);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return output;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function submitVoiceNoteRequest({
  buildFormData,
  operationLabel,
  timeoutMs,
}: VoiceNoteRequestOptions): Promise<VoiceNoteResponse> {
  let lastRetryableError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_VOICE_NOTE_REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("/api/doctor/voice-notes", {
        method: "POST",
        body: buildFormData(),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as VoiceNoteResponse;

      if (!response.ok) {
        const requestError = new Error(data.error || `HTTP ${response.status}`);
        if (RETRYABLE_STATUS_CODES.has(response.status)) {
          lastRetryableError = requestError;
          if (attempt < MAX_VOICE_NOTE_REQUEST_RETRIES) {
            await sleep(600 * (attempt + 1));
            continue;
          }
          break;
        }

        throw requestError;
      }

      return data;
    } catch (requestError) {
      if (isAbortError(requestError) || requestError instanceof TypeError) {
        lastRetryableError =
          requestError instanceof Error ? requestError : new Error(String(requestError));
        if (attempt < MAX_VOICE_NOTE_REQUEST_RETRIES) {
          await sleep(600 * (attempt + 1));
          continue;
        }
        break;
      }

      throw requestError instanceof Error
        ? requestError
        : new Error(`${operationLabel}失敗，請重試。`);
    } finally {
      window.clearTimeout(timeoutHandle);
    }
  }

  if (isAbortError(lastRetryableError)) {
    throw new Error(`${operationLabel}逾時，請重試。`);
  }

  throw new Error(
    `${operationLabel}失敗，已自動重試 ${MAX_VOICE_NOTE_REQUEST_RETRIES} 次仍未成功。`
  );
}

function getDeepgramTranscriptText(message: DeepgramLiveMessage): string {
  return message.channel?.alternatives?.[0]?.transcript?.trim() || "";
}

function buildTranscriptSegmentKey(message: DeepgramLiveMessage, transcriptText: string) {
  const startMs = Math.round((message.start || 0) * 1000);
  const durationMs = Math.round((message.duration || 0) * 1000);
  return `${startMs}:${durationMs}:${transcriptText}`;
}

function normalizeSocketErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "未能連接即時語音轉錄服務，請重試。";
}

function connectDeepgramSocket(url: string, accessToken: string): Promise<WebSocket> {
  const protocolCandidates = [
    ["bearer", accessToken],
    ["token", accessToken],
  ];

  let lastError: Error | null = null;

  const connectWithProtocols = (protocols: string[]) =>
    new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(url, protocols);
      socket.binaryType = "arraybuffer";

      const cleanup = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        socket.removeEventListener("close", handleClose);
      };

      const handleOpen = () => {
        cleanup();
        resolve(socket);
      };

      const handleError = () => {
        cleanup();
        try {
          socket.close();
        } catch {
          // ignore close failures after handshake errors
        }
        reject(new Error("Deepgram WebSocket handshake failed"));
      };

      const handleClose = (event: CloseEvent) => {
        cleanup();
        reject(new Error(event.reason || `Deepgram WebSocket closed (${event.code})`));
      };

      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
      socket.addEventListener("close", handleClose, { once: true });
    });

  return (async () => {
    for (const protocols of protocolCandidates) {
      try {
        return await connectWithProtocols(protocols);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError || new Error("Deepgram WebSocket handshake failed");
  })();
}

export interface VoiceNotePatient {
  patientUserId: string;
  displayName: string | null;
  phone: string | null;
  constitution: string;
  nextFollowUpDate: string | null;
}

interface CantoneseVoiceNoteToolProps {
  selectedPatient: VoiceNotePatient | null;
}

export function CantoneseVoiceNoteTool({ selectedPatient }: CantoneseVoiceNoteToolProps) {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const keepAliveTimerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewChunksRef = useRef<Blob[]>([]);
  const transcriptPartsRef = useRef<string[]>([]);
  const transcriptSegmentKeysRef = useRef<Set<string>>(new Set());
  const interimTranscriptRef = useRef("");
  const sessionIdRef = useRef(0);
  const recordingPatientRef = useRef<VoiceNotePatient | null>(null);
  const durationSecondsRef = useRef(0);
  const nextDraftDueSecondsRef = useRef(DRAFT_SUMMARY_INTERVAL_SECONDS);
  const draftSummaryInFlightRef = useRef(false);
  const expectedSocketCloseRef = useRef(false);
  const finalizeResolverRef = useRef<(() => void) | null>(null);
  const stoppingRef = useRef(false);
  const liveProviderLabelRef = useRef("Deepgram");

  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [draftRecordText, setDraftRecordText] = useState("");
  const [recordText, setRecordText] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [savingToPatientRecord, setSavingToPatientRecord] = useState(false);
  const [saveRecordStatus, setSaveRecordStatus] = useState<string | null>(null);
  const [saveRecordError, setSaveRecordError] = useState<string | null>(null);
  const [finalizedSegmentCount, setFinalizedSegmentCount] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [draftSummaryMinuteMark, setDraftSummaryMinuteMark] = useState<number | null>(null);
  const [liveProviderLabel, setLiveProviderLabel] = useState("Deepgram");

  useEffect(() => {
    const hasSupport =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined" &&
      typeof WebSocket !== "undefined" &&
      Boolean(getAudioContextConstructor());
    setIsSupported(hasSupport);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      clearKeepAliveTimer();
      resolveFinalizeWait();
      stopAudioPipeline();
      closeDeepgramSocket(true);
      stopStream();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSaveRecordStatus(null);
    setSaveRecordError(null);
  }, [selectedPatient?.patientUserId]);

  function clearTimer() {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function clearKeepAliveTimer() {
    if (!keepAliveTimerRef.current) return;
    clearInterval(keepAliveTimerRef.current);
    keepAliveTimerRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function resolveFinalizeWait() {
    const resolve = finalizeResolverRef.current;
    finalizeResolverRef.current = null;
    resolve?.();
  }

  function replacePreviewUrl(nextUrl: string | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function updateTranscriptDisplay() {
    setTranscript(combineTranscriptParts([...transcriptPartsRef.current, interimTranscriptRef.current]));
  }

  function resetSessionState() {
    previewChunksRef.current = [];
    transcriptPartsRef.current = [];
    transcriptSegmentKeysRef.current = new Set();
    interimTranscriptRef.current = "";
    durationSecondsRef.current = 0;
    nextDraftDueSecondsRef.current = DRAFT_SUMMARY_INTERVAL_SECONDS;
    draftSummaryInFlightRef.current = false;
    expectedSocketCloseRef.current = false;
    finalizeResolverRef.current = null;
    stoppingRef.current = false;
    liveProviderLabelRef.current = "Deepgram";
    setFinalizedSegmentCount(0);
    setDraftSummaryMinuteMark(null);
    setProcessingStatus(null);
    setLiveProviderLabel("Deepgram");
  }

  function resetOutputs() {
    setTranscript("");
    setDraftRecordText("");
    setRecordText("");
    setCopyStatus(null);
    setSaveRecordStatus(null);
    setSaveRecordError(null);
    setError(null);
    replacePreviewUrl(null);
    resetSessionState();
  }

  function stopAudioPipeline() {
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (silenceGainRef.current) {
      silenceGainRef.current.disconnect();
      silenceGainRef.current = null;
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      void audioContext.close().catch(() => undefined);
    }
  }

  function closeDeepgramSocket(expected: boolean) {
    const socket = deepgramSocketRef.current;
    deepgramSocketRef.current = null;
    expectedSocketCloseRef.current = expected;
    clearKeepAliveTimer();

    if (!socket) return;

    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      try {
        socket.close(1000, expected ? "client-close" : "client-reset");
      } catch {
        // ignore client close errors
      }
    }
  }

  async function stopPreviewRecorder() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      mediaRecorderRef.current = null;
      if (previewChunksRef.current.length > 0) {
        replacePreviewUrl(URL.createObjectURL(new Blob(previewChunksRef.current, { type: recorder?.mimeType })));
      }
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          mediaRecorderRef.current = null;
          resolve();
        },
        { once: true }
      );
      recorder.stop();
    });

    if (previewChunksRef.current.length > 0) {
      replacePreviewUrl(URL.createObjectURL(new Blob(previewChunksRef.current, { type: recorder.mimeType })));
    }
  }

  function startKeepAlive() {
    clearKeepAliveTimer();

    keepAliveTimerRef.current = window.setInterval(() => {
      const socket = deepgramSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      try {
        socket.send(JSON.stringify({ type: "KeepAlive" }));
      } catch {
        // onclose handler will surface socket failures if the connection is broken
      }
    }, DEEPGRAM_KEEP_ALIVE_INTERVAL_MS);
  }

  function buildPatientFormData(formData: FormData, patient: VoiceNotePatient | null) {
    formData.append("patientUserId", patient?.patientUserId || "");
    formData.append("patientDisplayName", patient?.displayName || "");
    formData.append("patientPhone", patient?.phone || "");
  }

  async function copyText(text: string, target: CopyTarget) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(target === "transcript" ? "逐字稿已複製" : "病歷摘要已複製");
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("複製失敗，請手動選取文字");
      window.setTimeout(() => setCopyStatus(null), 2500);
    }
  }

  async function analyzeTranscript(transcriptText: string, patient: VoiceNotePatient | null) {
    return submitVoiceNoteRequest({
      operationLabel: "病歷整理",
      timeoutMs: ANALYZE_REQUEST_TIMEOUT_MS,
      buildFormData: () => {
        const formData = new FormData();
        formData.append("mode", "extract-transcript");
        formData.append("transcript", transcriptText);
        buildPatientFormData(formData, patient);
        return formData;
      },
    });
  }

  async function maybeGenerateDraftSummary(
    sessionId: number,
    combinedTranscript: string,
    elapsedSeconds: number,
    patient: VoiceNotePatient | null
  ) {
    if (mediaRecorderRef.current?.state !== "recording") return;
    if (elapsedSeconds < nextDraftDueSecondsRef.current) return;
    if (combinedTranscript.trim().length < 20) return;
    if (draftSummaryInFlightRef.current) return;

    const dueSeconds = nextDraftDueSecondsRef.current;
    nextDraftDueSecondsRef.current += DRAFT_SUMMARY_INTERVAL_SECONDS;
    const minuteMark = Math.floor(dueSeconds / 60);
    draftSummaryInFlightRef.current = true;
    setProcessingStatus(`已錄音 ${minuteMark} 分鐘，正在更新暫時病歷摘要...`);

    try {
      const analysis = await analyzeTranscript(combinedTranscript, patient);
      if (sessionIdRef.current !== sessionId) return;
      if (mediaRecorderRef.current?.state !== "recording") return;
      if (analysis.recordText) {
        setDraftRecordText(analysis.recordText);
        setDraftSummaryMinuteMark(minuteMark);
        setProcessingStatus(`暫時病歷摘要已更新至 ${minuteMark} 分鐘`);
      }
    } catch (draftError) {
      if (sessionIdRef.current !== sessionId) return;
      if (mediaRecorderRef.current?.state !== "recording") return;
      setError(draftError instanceof Error ? draftError.message : "暫時病歷摘要更新失敗");
      setProcessingStatus("即時逐字稿仍會繼續更新，暫時摘要將於下一個時間點再試。");
    } finally {
      if (sessionIdRef.current === sessionId) {
        draftSummaryInFlightRef.current = false;
      }
    }
  }

  async function fetchDeepgramLiveToken() {
    const response = await fetch("/api/doctor/voice-notes/token", {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as DeepgramLiveTokenResponse;

    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
    const apiBaseUrl = typeof payload.apiBaseUrl === "string" ? payload.apiBaseUrl.trim() : "";
    const model = typeof payload.model === "string" ? payload.model.trim() : "";
    const language = typeof payload.language === "string" ? payload.language.trim() : "";

    if (!accessToken || !apiBaseUrl || !model || !language) {
      throw new Error("即時語音轉錄設定不完整，請稍後再試。");
    }

    return {
      accessToken,
      apiBaseUrl,
      model,
      language,
    };
  }

  function commitFinalTranscriptSegment(
    message: DeepgramLiveMessage,
    transcriptText: string,
    sessionId: number
  ) {
    const segmentKey = buildTranscriptSegmentKey(message, transcriptText);
    if (transcriptSegmentKeysRef.current.has(segmentKey)) {
      interimTranscriptRef.current = "";
      updateTranscriptDisplay();
      if (message.from_finalize) {
        resolveFinalizeWait();
      }
      return;
    }

    transcriptSegmentKeysRef.current.add(segmentKey);
    transcriptPartsRef.current.push(transcriptText);
    interimTranscriptRef.current = "";
    setFinalizedSegmentCount(transcriptPartsRef.current.length);
    updateTranscriptDisplay();

    const combinedTranscript = combineTranscriptParts(transcriptPartsRef.current);
    const elapsedSeconds = durationSecondsRef.current;
    void maybeGenerateDraftSummary(sessionId, combinedTranscript, elapsedSeconds, recordingPatientRef.current);

    if (message.from_finalize) {
      resolveFinalizeWait();
    }
  }

  async function stopRecordingInternal(options?: {
    skipAnalysis?: boolean;
    forcedErrorMessage?: string | null;
  }) {
    if (stoppingRef.current) return;

    const activeSessionId = sessionIdRef.current;
    const hasActiveRecorder = mediaRecorderRef.current?.state === "recording";
    const hasOpenSocket =
      deepgramSocketRef.current?.readyState === WebSocket.OPEN ||
      deepgramSocketRef.current?.readyState === WebSocket.CONNECTING;

    if (!hasActiveRecorder && !hasOpenSocket && !isRecording) return;

    stoppingRef.current = true;
    setIsRecording(false);
    setIsProcessing(true);
    setProcessingStatus(
      options?.skipAnalysis
        ? "正在中止即時語音轉錄..."
        : "錄音已停止，正在補齊最後一句並整理整段逐字稿..."
    );

    clearTimer();
    clearKeepAliveTimer();
    stopAudioPipeline();

    try {
      if (!options?.skipAnalysis && deepgramSocketRef.current?.readyState === WebSocket.OPEN) {
        await new Promise<void>((resolve) => {
          const timeoutHandle = window.setTimeout(() => {
            if (finalizeResolverRef.current === handleResolve) {
              finalizeResolverRef.current = null;
            }
            resolve();
          }, DEEPGRAM_FINALIZE_TIMEOUT_MS);

          const handleResolve = () => {
            window.clearTimeout(timeoutHandle);
            if (finalizeResolverRef.current === handleResolve) {
              finalizeResolverRef.current = null;
            }
            resolve();
          };

          finalizeResolverRef.current = handleResolve;

          try {
            deepgramSocketRef.current?.send(JSON.stringify({ type: "Finalize" }));
          } catch {
            handleResolve();
          }
        });
      } else {
        resolveFinalizeWait();
      }

      expectedSocketCloseRef.current = true;
      closeDeepgramSocket(true);
      await stopPreviewRecorder();
      stopStream();

      const combinedTranscript = combineTranscriptParts([
        ...transcriptPartsRef.current,
        interimTranscriptRef.current,
      ]);

      setTranscript(combinedTranscript);

      if (options?.skipAnalysis) {
        if (options.forcedErrorMessage) {
          setError(options.forcedErrorMessage);
        }
        setProcessingStatus(null);
        return;
      }

      if (!combinedTranscript) {
        throw new Error("未能從即時轉錄取得逐字稿，請重試。");
      }

      setProcessingStatus("逐字稿完成，正在整理最終病歷摘要...");
      const analysis = await analyzeTranscript(combinedTranscript, recordingPatientRef.current);
      if (sessionIdRef.current !== activeSessionId) return;

      setDraftRecordText("");
      setDraftSummaryMinuteMark(null);
      setTranscript(analysis.transcript || combinedTranscript);
      setRecordText(analysis.recordText || "");

      if (!analysis.recordText) {
        setError("已取得逐字稿，但未能整理摘要，請重試。");
      } else {
        setError(null);
      }

      setProcessingStatus("最終病歷摘要已完成");
    } catch (finalError) {
      if (sessionIdRef.current !== activeSessionId) return;
      setError(finalError instanceof Error ? finalError.message : "語音分析失敗");
      setProcessingStatus(null);
    } finally {
      if (sessionIdRef.current === activeSessionId) {
        setIsProcessing(false);
      }
      stoppingRef.current = false;
    }
  }

  async function startRecording() {
    if (!isSupported || isRecording || isProcessing || stoppingRef.current) return;

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      setError("此瀏覽器未能啟動即時語音轉錄，請改用新版 Chrome / Edge / Safari。");
      return;
    }

    sessionIdRef.current += 1;
    const activeSessionId = sessionIdRef.current;
    resetOutputs();
    recordingPatientRef.current = selectedPatient;
    setDurationSeconds(0);
    durationSecondsRef.current = 0;
    setIsProcessing(true);

    try {
      setProcessingStatus("正在連接 Deepgram 即時語音轉錄服務...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContextConstructor({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const liveConfig = await fetchDeepgramLiveToken();
      const sampleRate = audioContext.sampleRate || 16_000;
      const socketUrl = buildDeepgramLiveWebSocketUrl({
        apiBaseUrl: liveConfig.apiBaseUrl,
        model: liveConfig.model,
        language: liveConfig.language,
        sampleRate,
      });

      const socket = await connectDeepgramSocket(socketUrl, liveConfig.accessToken);
      if (sessionIdRef.current !== activeSessionId) {
        socket.close();
        return;
      }

      deepgramSocketRef.current = socket;
      expectedSocketCloseRef.current = false;
      liveProviderLabelRef.current = `Deepgram ${liveConfig.model}`;
      setLiveProviderLabel(liveProviderLabelRef.current);

      socket.onmessage = (event) => {
        if (sessionIdRef.current !== activeSessionId) return;

        try {
          const message = JSON.parse(event.data as string) as DeepgramLiveMessage;
          if (message.type === "Results") {
            const transcriptText = getDeepgramTranscriptText(message);
            if (message.is_final && transcriptText) {
              commitFinalTranscriptSegment(message, transcriptText, activeSessionId);
              return;
            }

            interimTranscriptRef.current = transcriptText;
            updateTranscriptDisplay();
            if (message.from_finalize) {
              resolveFinalizeWait();
            }
            return;
          }

          if (message.type === "Error") {
            void stopRecordingInternal({
              skipAnalysis: true,
              forcedErrorMessage:
                message.error?.message || message.error?.description || "即時語音轉錄服務中斷，請重試。",
            });
            return;
          }

          if (message.type === "Finalize" || message.type === "CloseStream") {
            resolveFinalizeWait();
          }
        } catch {
          // ignore non-JSON websocket frames
        }
      };

      socket.onerror = () => {
        if (sessionIdRef.current !== activeSessionId) return;
        void stopRecordingInternal({
          skipAnalysis: true,
          forcedErrorMessage: "即時語音轉錄連線中斷，請重試。",
        });
      };

      socket.onclose = (event) => {
        resolveFinalizeWait();

        if (sessionIdRef.current !== activeSessionId) return;
        if (expectedSocketCloseRef.current) return;

        void stopRecordingInternal({
          skipAnalysis: true,
          forcedErrorMessage: event.reason || "即時語音轉錄已中斷，請重新錄音。",
        });
      };

      const preferredMimeType = pickSupportedMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      previewChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size <= 0) return;
        previewChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        void stopRecordingInternal({
          skipAnalysis: true,
          forcedErrorMessage: "錄音過程出錯，請重試。",
        });
      };

      recorder.start();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(DEEPGRAM_PROCESSOR_BUFFER_SIZE, 1, 1);
      const silenceGain = audioContext.createGain();
      silenceGain.gain.value = 0;

      source.connect(processor);
      processor.connect(silenceGain);
      silenceGain.connect(audioContext.destination);

      processor.onaudioprocess = (audioEvent) => {
        const currentSocket = deepgramSocketRef.current;
        if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) return;
        if (currentSocket.bufferedAmount > DEEPGRAM_MAX_BUFFERED_AMOUNT_BYTES) return;

        const inputData = audioEvent.inputBuffer.getChannelData(0);
        audioEvent.outputBuffer.getChannelData(0).fill(0);

        try {
          currentSocket.send(float32ToLinear16Pcm(inputData));
        } catch {
          void stopRecordingInternal({
            skipAnalysis: true,
            forcedErrorMessage: "即時語音轉錄送出音訊失敗，請重試。",
          });
        }
      };

      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      silenceGainRef.current = silenceGain;

      startKeepAlive();
      setIsProcessing(false);
      setIsRecording(true);
      setProcessingStatus(
        `即時語音轉錄已開始，系統會持續串流至 ${liveProviderLabelRef.current}，並於每 5 分鐘更新一次暫時摘要。`
      );

      timerRef.current = window.setInterval(() => {
        setDurationSeconds((current) => {
          const next = current + 1;
          durationSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (startError) {
      resolveFinalizeWait();
      stopAudioPipeline();
      closeDeepgramSocket(true);
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore recorder stop failures during startup rollback
        }
      }
      mediaRecorderRef.current = null;
      stopStream();
      setIsRecording(false);
      setIsProcessing(false);
      setProcessingStatus(null);
      setError(normalizeSocketErrorMessage(startError));
    }
  }

  function stopRecording() {
    void stopRecordingInternal();
  }

  async function saveToPatientRecord() {
    if (!selectedPatient) {
      setSaveRecordError("未勾選病人，未能寫入病人記錄。");
      return;
    }
    if (!recordText.trim()) {
      setSaveRecordError("未有可寫入內容。");
      return;
    }

    setSavingToPatientRecord(true);
    setSaveRecordStatus(null);
    setSaveRecordError(null);

    const today = new Date();
    const startedAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(today.getDate()).padStart(2, "0")}`;

    try {
      const response = await fetch(`/api/doctor/patients/${selectedPatient.patientUserId}/symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "語音問診摘要",
          description: recordText,
          status: "active",
          startedAt,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as SaveToRecordResponse;
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setSaveRecordStatus("已寫入病人症狀記錄。");
    } catch (saveError) {
      setSaveRecordError(saveError instanceof Error ? saveError.message : "寫入病人記錄失敗");
    } finally {
      setSavingToPatientRecord(false);
    }
  }

  const displayedPatient = isRecording || isProcessing ? recordingPatientRef.current : selectedPatient;

  return (
    <section className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">語音病歷工具（廣東話）</h2>
          <p className="mt-1 text-sm text-gray-600">
            已改為 Deepgram 即時串流轉錄：錄音期間會連續送出音訊並即時更新逐字稿，不再依賴每 30 秒切檔；停止錄音後，系統會先補齊最後一句，再交由 Gemini 整理最終病歷摘要。
          </p>
          <p className="mt-1 text-xs text-gray-500">
            錄音綁定病人：{displayedPatient?.displayName || "未選擇（可直接錄音）"}
            {displayedPatient?.phone ? `（${displayedPatient.phone}）` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              停止錄音
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={!isSupported || isProcessing}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              開始錄音
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {isRecording ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            錄音中 {formatDuration(durationSeconds)}
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">未錄音</span>
        )}
        <span className="rounded-full bg-primary/[0.06] px-2.5 py-1 text-xs text-primary">
          即時轉錄：{liveProviderLabel}
        </span>
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs text-cyan-800">
          暫時摘要：每 5 分鐘
        </span>
      </div>

      {finalizedSegmentCount > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="rounded-full bg-gray-100 px-2.5 py-1">已定稿 {finalizedSegmentCount} 段</span>
        </div>
      ) : null}

      {!isSupported ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          此瀏覽器不支援即時錄音串流，請改用新版 Chrome / Edge / Safari。
        </div>
      ) : null}

      {processingStatus ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-primary">
          {processingStatus}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saveRecordError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveRecordError}
        </div>
      ) : null}

      {copyStatus ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {copyStatus}
        </div>
      ) : null}

      {saveRecordStatus ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {saveRecordStatus}
        </div>
      ) : null}

      {previewUrl ? (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-gray-500">錄音回放</p>
          <audio controls src={previewUrl} className="w-full" />
        </div>
      ) : null}

      {draftRecordText && !recordText ? (
        <div className="mt-4 space-y-2 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">暫時病歷摘要</h3>
              <p className="text-xs text-gray-600">
                {draftSummaryMinuteMark ? `已整理至第 ${draftSummaryMinuteMark} 分鐘` : "錄音中間版本"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyText(draftRecordText, "record")}
              className="rounded-md border border-cyan-200 bg-white px-2.5 py-1 text-xs font-medium text-cyan-900 transition-colors hover:bg-cyan-50"
            >
              複製暫時摘要
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{draftRecordText}</pre>
          <p className="text-xs text-cyan-900">
            只供醫師即場追問參考；停止錄音後，系統會再整理一次最終版。
          </p>
        </div>
      ) : null}

      {recordText ? (
        <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">最終病歷摘要</h3>
              <p className="text-xs text-gray-600">停止錄音後整段整理，可直接貼入病歷系統。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyText(recordText, "record")}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                複製摘要
              </button>
              {selectedPatient ? (
                <>
                  <button
                    type="button"
                    onClick={() => void saveToPatientRecord()}
                    disabled={savingToPatientRecord}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingToPatientRecord ? "寫入中..." : "寫入病人記錄"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/doctor/patients/${selectedPatient.patientUserId}`)}
                    className="rounded-md border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                  >
                    打開病人記錄
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{recordText}</pre>
          {!selectedPatient ? (
            <p className="text-xs text-amber-700">
              目前未勾選病人；你可先複製使用。若想一鍵寫入，先在上方選取病人。
            </p>
          ) : null}
        </div>
      ) : null}

      {transcript ? (
        <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">逐字稿（完整對話）</h3>
              <p className="text-xs text-gray-600">即時更新；停止錄音後會再補齊最後一句。</p>
            </div>
            <button
              type="button"
              onClick={() => void copyText(transcript, "transcript")}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              複製逐字稿
            </button>
          </div>
          <textarea
            value={transcript}
            readOnly
            rows={10}
            className="w-full rounded-md border border-gray-300 bg-gray-50 p-2 text-sm text-gray-800"
          />
        </div>
      ) : null}
    </section>
  );
}
