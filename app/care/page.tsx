"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Wind, Droplet, Zap } from "lucide-react";
import { getConstitutionDietTips } from "@/lib/constitution-diet-tips";
import {
  FORCE_NARRATIVE,
  NARRATIVE,
  constitutionToTendencyKey,
} from "@/lib/narrative-copy";
import { DailyTipCard } from "@/components/patient/DailyTipCard";
import { DailySensePrompt } from "@/components/patient/DailySensePrompt";

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了，記得早休息。";
  if (hour < 11) return "早安，今天的節奏由你決定。";
  if (hour < 14) return "午間稍息，讓身體回氣。";
  if (hour < 18) return "下午好，保持你的步調。";
  if (hour < 21) return "黃昏時分，讓一天慢慢收束。";
  return "晚安，身體記得今天的一切。";
}

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
  constitutionSource?: "patient_care_profile" | "default";
  constitutionNote: string | null;
  activeInstructions: CareInstruction[];
  nextFollowUp: NextFollowUp | null;
  error?: string;
};

function ForceIcon({ tendencyKey, className }: { tendencyKey: string; className?: string }) {
  const cls = className ?? "h-4 w-4";
  if (tendencyKey === "J") return <Wind className={cls} strokeWidth={1.9} />;
  if (tendencyKey === "K") return <Droplet className={cls} strokeWidth={1.9} />;
  return <Zap className={cls} strokeWidth={1.9} />;
}

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
  if (source === "patient_care_profile") return "來源：體質檔案";
  return "來源：未有正式體質資料";
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
          throw new Error("請先登入，先可以查看你的養生建議。");
        }
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "載入養生建議失敗");
      }
      const payload = (await res.json()) as CareContextResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入養生建議失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCareContext();
  }, [loadCareContext]);

  const constitutionKey = data?.constitution ?? "unknown";
  const tendencyKey = constitutionToTendencyKey(constitutionKey);
  const narrative = tendencyKey ? FORCE_NARRATIVE[tendencyKey] : null;

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

  // Resolve narrative text (with fallbacks for mixed/unknown)
  const bodyDescription = narrative?.bodyDescription ?? (
    constitutionKey === "mixed" ? NARRATIVE.mixedBodyDescription : NARRATIVE.unknownBodyDescription
  );
  const dietIntro = narrative?.dietIntro ?? (
    constitutionKey === "mixed" ? NARRATIVE.mixedDietIntro : NARRATIVE.unknownDietIntro
  );
  const tcmLabel = narrative?.tcmLabel ?? (
    constitutionKey === "mixed" ? NARRATIVE.mixedTcmLabel : NARRATIVE.unknownTcmLabel
  );
  const accentBg = narrative?.accentBg ?? "bg-primary-light/30";

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* ── Opening: time-aware greeting ── */}
        <header className="animate-eden-enter space-y-3 pb-4">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-primary sm:text-[32px]">養生</h1>
          <p
            className="text-sm leading-relaxed text-slate-400"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {getTimeGreeting()}
          </p>
        </header>

        {loading ? (
          <section className="py-16 text-center">
            <div className="animate-breathe">
              <p
                className="text-sm text-slate-400"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                正在準備你的養生空間...
              </p>
            </div>
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
            {/* ── Daily tip card (one quiet thought per day) ── */}
            <div className="animate-eden-enter-delay-1">
              <DailyTipCard constitution={constitutionKey} accentBg={accentBg} />
            </div>

            {/* ── Constitution card (dual-track: force name + TCM label) ── */}
            <section className={`animate-eden-enter-delay-2 rounded-[28px] border border-primary/10 shadow-sm p-5 sm:p-6 ${accentBg}`}>
              <div className="flex items-start gap-3">
                {tendencyKey ? (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <ForceIcon tendencyKey={tendencyKey} className="h-4 w-4 text-slate-600" />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900">
                    {narrative ? `你的體質傾向：${narrative.forceName}` : "你的體質"}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {bodyDescription}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
                    中醫稱為「{tcmLabel}」 · {constitutionSourceLabel(data?.constitutionSource)}
                  </p>
                </div>
              </div>

              {data?.constitutionNote ? (
                <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-light/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">醫師備註</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{data.constitutionNote}</p>
                </div>
              ) : null}

              {data?.nextFollowUp ? (
                <p className="mt-4 text-xs text-slate-500">下次建議覆診：{formatDate(data.nextFollowUp.suggestedDate)}</p>
              ) : null}
            </section>

            {/* ── Diet recommendations ── */}
            <section className="animate-eden-enter-delay-3 patient-card p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900">養生飲食方針</h2>
              <p className="mt-2 text-sm text-slate-500">{dietIntro}</p>

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
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                  {fallbackDietTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Diet avoidances ── */}
            <section className="animate-eden-enter-delay-4 patient-card p-5 sm:p-6">
              <h2 className="text-base font-semibold text-slate-900">醫師戒口提醒</h2>
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
                <p className="mt-3 text-sm text-slate-500">暫時未有醫師新增戒口指引。</p>
              )}
            </section>

            {/* ── Daily sense prompt (gentle check-in at the bottom) ── */}
            <DailySensePrompt />

            {/* ── Navigation links ── */}
            <section className="flex flex-wrap gap-3 pb-2">
              <Link
                href="/chat"
                className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                去問問 AI
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
