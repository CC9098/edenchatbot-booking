"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MAX_AUDIO_FILE_BYTES = 15 * 1024 * 1024;
const CHUNK_TIMESLICE_MS = 30_000;

type CopyTarget = "transcript" | "record";

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

function fileExtensionForMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

function combineTranscriptParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

interface VoiceNoteResponse {
  transcript?: string;
  recordText?: string;
  error?: string;
}

interface SaveToRecordResponse {
  symptom?: { id?: string };
  error?: string;
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewChunksRef = useRef<Blob[]>([]);
  const transcriptPartsRef = useRef<string[]>([]);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionIdRef = useRef(0);
  const activeMimeTypeRef = useRef("audio/webm");
  const recordingPatientRef = useRef<VoiceNotePatient | null>(null);
  const chunkCounterRef = useRef(0);
  const failedChunkCountRef = useRef(0);

  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [recordText, setRecordText] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [savingToPatientRecord, setSavingToPatientRecord] = useState(false);
  const [saveRecordStatus, setSaveRecordStatus] = useState<string | null>(null);
  const [saveRecordError, setSaveRecordError] = useState<string | null>(null);
  const [transcribedChunkCount, setTranscribedChunkCount] = useState(0);
  const [failedChunkCount, setFailedChunkCount] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  useEffect(() => {
    const hasSupport =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined";
    setIsSupported(hasSupport);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
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

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function replacePreviewUrl(nextUrl: string | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  }

  function resetSessionState() {
    transcriptPartsRef.current = [];
    previewChunksRef.current = [];
    uploadQueueRef.current = Promise.resolve();
    chunkCounterRef.current = 0;
    failedChunkCountRef.current = 0;
    setTranscribedChunkCount(0);
    setFailedChunkCount(0);
    setProcessingStatus(null);
  }

  function resetOutputs() {
    setTranscript("");
    setRecordText("");
    setCopyStatus(null);
    setSaveRecordStatus(null);
    setSaveRecordError(null);
    setError(null);
    setProcessingStatus(null);
    replacePreviewUrl(null);
    resetSessionState();
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
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("複製失敗，請手動選取文字");
      setTimeout(() => setCopyStatus(null), 2500);
    }
  }

  async function transcribeChunk(
    blob: Blob,
    mimeType: string,
    patient: VoiceNotePatient | null
  ): Promise<string> {
    if (blob.size <= 0) return "";
    if (blob.size > MAX_AUDIO_FILE_BYTES) {
      throw new Error("單段錄音仍然過大，請改用 Chrome/Edge，或通知我再把分段縮短。");
    }

    const extension = fileExtensionForMime(mimeType);
    const fileName = `doctor-note-chunk-${Date.now()}.${extension}`;
    const audioFile = new File([blob], fileName, { type: mimeType });
    const formData = new FormData();
    formData.append("mode", "transcribe-audio");
    formData.append("audio", audioFile);
    buildPatientFormData(formData, patient);

    const response = await fetch("/api/doctor/voice-notes", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => ({}))) as VoiceNoteResponse;

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data.transcript || "";
  }

  function enqueueChunkUpload(blob: Blob, mimeType: string, sessionId: number) {
    const patientAtStart = recordingPatientRef.current;
    const chunkNumber = chunkCounterRef.current + 1;
    chunkCounterRef.current = chunkNumber;
    previewChunksRef.current.push(blob);

    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      if (sessionIdRef.current !== sessionId) return;

      try {
        const isStillRecording = mediaRecorderRef.current?.state === "recording";
        setProcessingStatus(
          isStillRecording
            ? `分段轉錄中：正在處理第 ${chunkNumber} 段`
            : `停止錄音，正在補傳第 ${chunkNumber} 段`
        );
        const chunkTranscript = await transcribeChunk(blob, mimeType, patientAtStart);
        if (sessionIdRef.current !== sessionId) return;
        if (chunkTranscript.trim()) {
          transcriptPartsRef.current.push(chunkTranscript.trim());
          setTranscribedChunkCount(transcriptPartsRef.current.length);
          setTranscript(combineTranscriptParts(transcriptPartsRef.current));
        }
      } catch (chunkError) {
        if (sessionIdRef.current !== sessionId) return;
        failedChunkCountRef.current += 1;
        setFailedChunkCount(failedChunkCountRef.current);
        setError(
          chunkError instanceof Error ? chunkError.message : `第 ${chunkNumber} 段轉錄失敗`
        );
      }
    });
  }

  async function analyzeTranscript(transcriptText: string, patient: VoiceNotePatient | null) {
    const formData = new FormData();
    formData.append("mode", "extract-transcript");
    formData.append("transcript", transcriptText);
    buildPatientFormData(formData, patient);

    const response = await fetch("/api/doctor/voice-notes", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => ({}))) as VoiceNoteResponse;

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async function finalizeRecording(sessionId: number) {
    setIsProcessing(true);
    setProcessingStatus("錄音已停止，正在整理整段逐字稿...");

    try {
      await uploadQueueRef.current;
      if (sessionIdRef.current !== sessionId) return;

      if (previewChunksRef.current.length > 0) {
        replacePreviewUrl(
          URL.createObjectURL(new Blob(previewChunksRef.current, { type: activeMimeTypeRef.current }))
        );
      }

      const combinedTranscript = combineTranscriptParts(transcriptPartsRef.current);
      setTranscript(combinedTranscript);

      if (!combinedTranscript) {
        throw new Error("未能從錄音取得逐字稿，請重試。若問題持續，我可再改成更短分段。");
      }

      setProcessingStatus("逐字稿完成，正在整理病歷摘要...");
      const analysis = await analyzeTranscript(combinedTranscript, recordingPatientRef.current);
      if (sessionIdRef.current !== sessionId) return;

      setTranscript(analysis.transcript || combinedTranscript);
      setRecordText(analysis.recordText || "");

      if (!analysis.recordText) {
        setError("已取得逐字稿，但未能整理摘要，請重試。");
      } else if (failedChunkCountRef.current > 0) {
        setError(`已完成分析，但有 ${failedChunkCountRef.current} 段分段轉錄失敗，請覆核逐字稿。`);
      } else {
        setError(null);
      }

      setProcessingStatus("分析完成");
    } catch (finalError) {
      if (sessionIdRef.current !== sessionId) return;
      setError(finalError instanceof Error ? finalError.message : "語音分析失敗");
      setProcessingStatus(null);
    } finally {
      if (sessionIdRef.current === sessionId) {
        setIsProcessing(false);
      }
    }
  }

  async function startRecording() {
    if (!isSupported || isRecording || isProcessing) return;

    sessionIdRef.current += 1;
    recordingPatientRef.current = selectedPatient;
    resetOutputs();
    setDurationSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMimeType = pickSupportedMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      const chosenMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
      activeMimeTypeRef.current = chosenMimeType;
      mediaRecorderRef.current = recorder;
      setProcessingStatus("錄音已開始，系統會每 30 秒自動分段上傳。");

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size <= 0) return;
        enqueueChunkUpload(event.data, chosenMimeType, sessionIdRef.current);
      };

      recorder.onerror = () => {
        setError("錄音過程出錯，請重試。");
        setProcessingStatus(null);
        setIsRecording(false);
        clearTimer();
        stopStream();
      };

      recorder.onstop = () => {
        const finishedSessionId = sessionIdRef.current;
        clearTimer();
        setIsRecording(false);
        stopStream();
        void finalizeRecording(finishedSessionId);
      };

      recorder.start(CHUNK_TIMESLICE_MS);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setDurationSeconds((current) => current + 1);
      }, 1000);
    } catch {
      setError("無法啟動咪高峰，請檢查瀏覽器權限。");
      setProcessingStatus(null);
      stopStream();
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setProcessingStatus("正在結束錄音並等待最後分段上傳...");
    recorder.stop();
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
      const response = await fetch(
        `/api/doctor/patients/${selectedPatient.patientUserId}/symptoms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "語音問診摘要",
            description: recordText,
            status: "active",
            startedAt,
          }),
        }
      );
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
            已升級為長錄音模式：每 30 秒自動分段轉錄，停止後再整體整理病歷摘要。
          </p>
          <p className="mt-1 text-xs text-gray-500">
            錄音綁定病人：{displayedPatient?.displayName || "未選擇（可直接錄音）"}
            {displayedPatient?.phone
              ? `（${displayedPatient.phone}）`
              : ""}
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
          自動分段：每 30 秒
        </span>
        <span className="text-xs text-gray-500">適合 15-20 分鐘問診，不再整段一次過上傳。</span>
      </div>

      {(transcribedChunkCount > 0 || failedChunkCount > 0) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="rounded-full bg-gray-100 px-2.5 py-1">已轉錄 {transcribedChunkCount} 段</span>
          {failedChunkCount > 0 ? (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">失敗 {failedChunkCount} 段</span>
          ) : null}
        </div>
      ) : null}

      {!isSupported ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          此瀏覽器不支援錄音功能，請改用新版 Chrome / Edge / Safari。
        </div>
      ) : null}

      {processingStatus ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-primary">
          {processingStatus}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
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

      {recordText ? (
        <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">可貼入病歷之症狀摘要</h3>
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
            <h3 className="text-sm font-semibold text-gray-900">逐字稿（完整對話）</h3>
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
