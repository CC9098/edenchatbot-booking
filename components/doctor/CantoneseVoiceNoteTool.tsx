"use client";

import { useEffect, useRef, useState } from "react";

const MAX_AUDIO_FILE_BYTES = 15 * 1024 * 1024;

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

interface VoiceNoteResponse {
  transcript?: string;
  recordText?: string;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [recordText, setRecordText] = useState("");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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

  function clearTimer() {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function resetOutputs() {
    setTranscript("");
    setRecordText("");
    setCopyStatus(null);
  }

  function replacePreviewUrl(nextUrl: string | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
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

  async function uploadAndAnalyze(blob: Blob, mimeType: string) {
    if (blob.size > MAX_AUDIO_FILE_BYTES) {
      setError("錄音檔太大（上限 15MB），請縮短錄音後重試。");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const extension = fileExtensionForMime(mimeType);
      const fileName = `doctor-note-${Date.now()}.${extension}`;
      const audioFile = new File([blob], fileName, { type: mimeType });

      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("patientUserId", selectedPatient?.patientUserId || "");
      formData.append("patientDisplayName", selectedPatient?.displayName || "");
      formData.append("patientPhone", selectedPatient?.phone || "");

      const response = await fetch("/api/doctor/voice-notes", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as VoiceNoteResponse;

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setTranscript(data.transcript || "");
      setRecordText(data.recordText || "");
      if (!data.transcript || !data.recordText) {
        setError("分析完成，但回傳內容不完整，請再試一次。");
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "語音分析失敗";
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function startRecording() {
    if (!isSupported || isRecording || isProcessing) return;

    if (!selectedPatient) {
      setError("請先選擇病人，再開始錄音。");
      return;
    }

    setError(null);
    resetOutputs();
    setDurationSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMimeType = pickSupportedMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("錄音過程出錯，請重試。");
        setIsRecording(false);
        clearTimer();
        stopStream();
      };

      recorder.onstop = () => {
        clearTimer();
        setIsRecording(false);

        const chosenMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: chosenMimeType });
        chunksRef.current = [];
        stopStream();

        if (recordedBlob.size === 0) {
          setError("錄音內容為空，請重試。");
          return;
        }

        replacePreviewUrl(URL.createObjectURL(recordedBlob));
        void uploadAndAnalyze(recordedBlob, chosenMimeType);
      };

      recorder.start(500);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setDurationSeconds((current) => current + 1);
      }, 1000);
    } catch {
      setError("無法啟動咪高峰，請檢查瀏覽器權限。");
      stopStream();
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  return (
    <section className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">語音病歷工具（廣東話）</h2>
          <p className="mt-1 text-sm text-gray-600">
            錄音完成後會自動轉錄並整理為可貼入病歷的症狀摘要，結果請由醫師覆核。
          </p>
          <p className="mt-1 text-xs text-gray-500">
            當前病人：{selectedPatient?.displayName || "未選擇"}{selectedPatient?.phone ? `（${selectedPatient.phone}）` : ""}
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
              disabled={!isSupported || isProcessing || !selectedPatient}
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
        <span className="text-xs text-gray-500">上限 15MB，建議每段 2-8 分鐘。</span>
      </div>

      {!isSupported ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          此瀏覽器不支援錄音功能，請改用新版 Chrome / Edge / Safari。
        </div>
      ) : null}

      {isProcessing ? (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm text-primary">
          正在分析錄音，請稍候...
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      {copyStatus ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {copyStatus}
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
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">可貼入病歷之症狀摘要</h3>
            <button
              type="button"
              onClick={() => void copyText(recordText, "record")}
              className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              複製摘要
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{recordText}</pre>
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
            rows={8}
            className="w-full rounded-md border border-gray-300 bg-gray-50 p-2 text-sm text-gray-800"
          />
        </div>
      ) : null}
    </section>
  );
}
