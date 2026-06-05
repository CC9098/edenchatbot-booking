"use client";

import Link from "next/link";
import { DragEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";

type UploadResult = {
  fileName: string;
  mediaUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
  contentType: string;
  size: number;
};

const EXPIRY_OPTIONS = [
  { label: "24 小時", value: "86400" },
  { label: "1 小時", value: "3600" },
  { label: "7 日", value: "604800" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }

  return "未能產生連結。";
}

export function WhatsappMediaLinkClient() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expirySeconds, setExpirySeconds] = useState(EXPIRY_OPTIONS[0].value);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setResult(null);
    setError(null);
    setCopyStatus(null);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  async function uploadSelectedFile() {
    if (!selectedFile) {
      setError("請先拖入圖片。");
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);
    setCopyStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("expiresInSeconds", expirySeconds);

      const response = await fetch("/api/staff/whatsapp-media", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(getErrorText(payload));
        return;
      }

      setResult(payload as UploadResult);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "未能產生連結。");
    } finally {
      setIsUploading(false);
    }
  }

  async function copyLink() {
    if (!result?.mediaUrl) return;

    try {
      await navigator.clipboard.writeText(result.mediaUrl);
      setCopyStatus("已複製");
      window.setTimeout(() => setCopyStatus(null), 1800);
    } catch {
      setCopyStatus("請手動複製");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/nurse"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
            >
              <ArrowLeft className="h-4 w-4" />
              返回姑娘主頁
            </Link>
            <p className="mt-4 text-sm font-semibold text-emerald-800">WhatsApp template 圖片</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              圖片短期連結
            </h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Staff only
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition ${
              isDragging
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50"
            }`}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="max-h-56 max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-emerald-100 bg-white text-emerald-800 shadow-sm">
                <UploadCloud className="h-8 w-8" />
              </span>
            )}
            <span className="mt-4 text-base font-semibold text-slate-950">
              {selectedFile ? selectedFile.name : "拖入圖片"}
            </span>
            <span className="mt-2 text-sm text-slate-500">
              JPG / PNG，5MB 以下
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Clock3 className="h-4 w-4 text-emerald-700" />
                有效期
              </span>
              <select
                value={expirySeconds}
                onChange={(event) => setExpirySeconds(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void uploadSelectedFile()}
              disabled={isUploading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {isUploading ? "上載中..." : "產生連結"}
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">未能處理</p>
                  <p className="mt-1 text-rose-800">{error}</p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-semibold text-emerald-200">Chatwoot URL</p>
            {result ? (
              <div className="mt-4 space-y-4">
                <textarea
                  readOnly
                  value={result.mediaUrl}
                  className="min-h-32 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm leading-6 text-slate-100 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50"
                >
                  <ClipboardCopy className="h-4 w-4" />
                  {copyStatus || "複製連結"}
                </button>
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">{result.fileName}</p>
                      <p className="mt-1 text-emerald-100/85">
                        {formatFileSize(result.size)} · 到期 {new Date(result.expiresAt).toLocaleString("zh-HK")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm leading-6 text-slate-300">
                上載後貼去 template 圖片欄。
              </div>
            )}
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            私人醫療相只限必要時使用短期連結；傾緊嘅客戶優先用 Chatwoot 附件。
          </section>
        </aside>
      </div>
    </div>
  );
}
