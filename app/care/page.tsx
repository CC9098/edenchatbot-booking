"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getConstitutionDietTips } from "@/lib/constitution-diet-tips";

type CareInstruction = {
  id: string;
  instructionType: string;
  title: string;
  contentMd: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type NextFollowUp = {
  id: string;
  suggestedDate: string;
  status: string;
};

type CareContextResponse = {
  constitution: string;
  constitutionSource?: "patient_care_profile" | "profiles" | "chat_sessions" | "default";
  constitutionNote: string | null;
  activeInstructions: CareInstruction[];
  nextFollowUp: NextFollowUp | null;
  error?: string;
};

type ConstitutionMeta = {
  label: string;
  badgeClass: string;
  summary: string;
};

const CONSTITUTION_META: Record<string, ConstitutionMeta> = {
  depleting: {
    label: "虛損",
    badgeClass: "bg-emerald-100 text-emerald-800",
    summary: "重點是補氣養血、減少過度勞累，飲食以溫和、易消化為主。",
  },
  crossing: {
    label: "鬱結",
    badgeClass: "bg-blue-100 text-blue-800",
    summary: "重點是疏導壓力、調節作息，飲食避免過度刺激與偏性太強。",
  },
  hoarding: {
    label: "痰濕",
    badgeClass: "bg-purple-100 text-purple-800",
    summary: "重點是化濕健脾，飲食以清淡為主，減少濕重與黏滯食物。",
  },
  mixed: {
    label: "混合",
    badgeClass: "bg-orange-100 text-orange-800",
    summary: "目前屬混合狀態，先跟隨醫師指示，逐步微調飲食與作息。",
  },
  unknown: {
    label: "未評估",
    badgeClass: "bg-gray-100 text-gray-700",
    summary: "尚未建立完整體質評估，先採用清淡、規律、少刺激的基本原則。",
  },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatInstructionDateRange(item: CareInstruction): string {
  if (item.startDate && item.endDate) {
    return `${formatDate(item.startDate)} 至 ${formatDate(item.endDate)}`;
  }
  if (item.startDate) return `開始：${formatDate(item.startDate)}`;
  if (item.endDate) return `截止：${formatDate(item.endDate)}`;
  return `建立：${formatDate(item.createdAt)}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function instructionMetaText(item: CareInstruction): string {
  const doctorName = item.createdByName || "醫師";
  const updatedAt = formatDateTime(item.updatedAt || item.createdAt);
  return `${formatInstructionDateRange(item)} ・ 醫師：${doctorName} ・ 更新：${updatedAt}`;
}

function constitutionSourceLabel(source: CareContextResponse["constitutionSource"]): string {
  if (source === "patient_care_profile") return "來源：醫師評估";
  if (source === "profiles") return "來源：帳號體質檔案";
  if (source === "chat_sessions") return "來源：登入帳號對話紀錄";
  return "來源：未有完整資料";
}

export default function CareAdvicePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CareContextResponse | null>(null);

  const loadCareContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/me/care-context");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("請先登入，先可以查看你的養生宜忌建議。");
        }
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "載入養生宜忌建議失敗");
      }
      const payload = (await res.json()) as CareContextResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入養生宜忌建議失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCareContext();
  }, [loadCareContext]);

  const constitutionKey = data?.constitution ?? "unknown";
  const constitutionMeta = CONSTITUTION_META[constitutionKey] || CONSTITUTION_META.unknown;
  const fallbackDietTips = useMemo(
    () => getConstitutionDietTips(constitutionKey),
    [constitutionKey],
  );

  const dietRecommendItems = useMemo(
    () => (data?.activeInstructions || []).filter((item) => item.instructionType === "diet_recommend"),
    [data?.activeInstructions],
  );

  const dietAvoidItems = useMemo(
    () => (data?.activeInstructions || []).filter((item) => item.instructionType === "diet_avoid"),
    [data?.activeInstructions],
  );

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-3">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">個人化照護</p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">養生宜忌建議</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            這裡整合你的體質、飲食方向與醫師戒口提醒，方便你每日跟住做。
          </p>
        </header>

        {loading ? (
          <section className="patient-card px-6 py-10 text-center">
            <p className="text-sm text-slate-600">載入中...</p>
          </section>
        ) : error ? (
          <section className="patient-card px-6 py-10 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void loadCareContext()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
              >
                重新載入
              </button>
              <Link
                href="/login"
                className="rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                前往登入
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="patient-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">我的體質</h2>
                  <p className="mt-1 text-sm text-slate-600">{constitutionMeta.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">{constitutionSourceLabel(data?.constitutionSource)}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${constitutionMeta.badgeClass}`}
                >
                  {constitutionMeta.label}
                </span>
              </div>

              {data?.constitutionNote ? (
                <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-light/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">醫師體質備註</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{data.constitutionNote}</p>
                </div>
              ) : null}

              {data?.nextFollowUp ? (
                <p className="mt-4 text-xs text-slate-500">下次建議覆診：{formatDate(data.nextFollowUp.suggestedDate)}</p>
              ) : null}
            </section>

            <section className="patient-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">養生飲食方針</h2>
              {dietRecommendItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dietRecommendItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">{item.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.contentMd}</p>
                      <p className="mt-3 text-xs text-slate-500">{instructionMetaText(item)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-light/35 p-4">
                  <p className="text-sm font-medium text-slate-900">目前未有醫師設定的綠色推薦，先按以下體質方針執行：</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                    {fallbackDietTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="patient-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">醫師點評的戒口指引</h2>
              {dietAvoidItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dietAvoidItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-red-200 bg-red-50/55 p-4">
                      <p className="text-sm font-semibold text-red-900">{item.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.contentMd}</p>
                      <p className="mt-3 text-xs text-slate-500">{instructionMetaText(item)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
                  <p className="text-sm text-slate-600">暫時未有醫師新增戒口指引。</p>
                </div>
              )}
            </section>

            <section className="flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                去 AI 諮詢
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                查看電子課程
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
