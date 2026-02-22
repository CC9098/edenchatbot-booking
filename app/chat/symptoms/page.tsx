"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SymptomItem = {
  id: string;
  category: string | null;
  description: string | null;
  severity: number | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  loggedVia: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type SymptomApiResponse = {
  symptoms?: SymptomItem[];
  error?: string;
};

type StatusFilter = "all" | "active" | "resolved" | "recurring";

const STATUS_META: Record<Exclude<StatusFilter, "all">, { label: string; pillClass: string }> = {
  active: {
    label: "進行中",
    pillClass: "bg-red-100 text-red-700",
  },
  resolved: {
    label: "已好返",
    pillClass: "bg-green-100 text-green-700",
  },
  recurring: {
    label: "反覆",
    pillClass: "bg-orange-100 text-orange-700",
  },
};

function getStatusLabel(value: string | null): string {
  if (!value) return "未分類";
  return STATUS_META[value as Exclude<StatusFilter, "all">]?.label || value;
}

function getStatusPillClass(value: string | null): string {
  if (!value) return "bg-gray-100 text-gray-600";
  return STATUS_META[value as Exclude<StatusFilter, "all">]?.pillClass || "bg-gray-100 text-gray-600";
}

function toSafeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isSameMonth(date: Date, monthBase: Date): boolean {
  return (
    date.getFullYear() === monthBase.getFullYear() &&
    date.getMonth() === monthBase.getMonth()
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = toSafeDate(value);
  if (!date) return value;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function severityBar(severity: number | null) {
  if (!severity) return null;

  const level = Math.min(5, Math.max(1, severity));
  const filledClass =
    level <= 2 ? "bg-amber-400" : level === 3 ? "bg-orange-400" : "bg-red-500";

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-2.5 w-4 rounded-sm ${n <= level ? filledClass : "bg-gray-200"}`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{level}/5</span>
    </div>
  );
}

export default function MySymptomsPage() {
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadSymptoms = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/me/symptoms?limit=100");

      if (!response.ok) {
        throw new Error("無法載入症狀紀錄");
      }

      const data = (await response.json()) as SymptomApiResponse;
      setSymptoms(data.symptoms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入症狀紀錄");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSymptoms();
  }, [loadSymptoms]);

  const sortedSymptoms = useMemo(
    () =>
      [...symptoms].sort((a, b) => {
        const aTime = toSafeDate(a.startedAt || a.createdAt)?.getTime() || 0;
        const bTime = toSafeDate(b.startedAt || b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      }),
    [symptoms],
  );

  const filteredSymptoms = useMemo(() => {
    if (statusFilter === "all") return sortedSymptoms;
    return sortedSymptoms.filter((item) => item.status === statusFilter);
  }, [sortedSymptoms, statusFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCount = sortedSymptoms.filter((s) => s.status === "active").length;
    const recurringCount = sortedSymptoms.filter((s) => s.status === "recurring").length;
    const improvedThisMonthCount = sortedSymptoms.filter((s) => {
      if (s.status !== "resolved") return false;
      const ended = toSafeDate(s.endedAt);
      if (ended) return isSameMonth(ended, now);
      const updated = toSafeDate(s.updatedAt || s.createdAt);
      return updated ? isSameMonth(updated, now) : false;
    }).length;

    return {
      total: sortedSymptoms.length,
      activeCount,
      recurringCount,
      improvedThisMonthCount,
    };
  }, [sortedSymptoms]);

  const filterChips = useMemo(
    () => [
      { value: "all" as const, label: "全部", count: stats.total },
      { value: "active" as const, label: "進行中", count: stats.activeCount },
      { value: "resolved" as const, label: "已好返", count: sortedSymptoms.filter((s) => s.status === "resolved").length },
      { value: "recurring" as const, label: "反覆", count: stats.recurringCount },
    ],
    [stats.activeCount, stats.recurringCount, stats.total, sortedSymptoms],
  );

  return (
    <div className="mx-auto h-full w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">我的症狀紀錄</h1>
            <p className="mt-1 text-xs text-gray-500">
              追蹤你最近身體變化，方便覆診時更快溝通。
            </p>
          </div>
          <Link
            href="/chat"
            className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
          >
            返回 AI 諮詢
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-primary/10 bg-white p-3">
            <p className="text-xs text-gray-500">總紀錄</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
            <p className="text-xs text-red-700">進行中</p>
            <p className="mt-1 text-xl font-semibold text-red-700">{stats.activeCount}</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50/50 p-3">
            <p className="text-xs text-green-700">本月已改善</p>
            <p className="mt-1 text-xl font-semibold text-green-700">{stats.improvedThisMonthCount}</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3">
            <p className="text-xs text-orange-700">反覆症狀</p>
            <p className="mt-1 text-xl font-semibold text-orange-700">{stats.recurringCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => {
            const active = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {chip.label} ({chip.count})
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
          {loading ? (
            <div className="px-4 py-8 text-sm text-gray-500">載入中...</div>
          ) : error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={loadSymptoms}
                className="mt-3 rounded-md bg-red-100 px-4 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-200"
              >
                重試
              </button>
            </div>
          ) : sortedSymptoms.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-gray-900">暫時未有症狀紀錄</p>
              <p className="mt-1 text-xs text-gray-500">你可以喺聊天時描述症狀，系統會自動幫你整理。</p>
              <Link
                href="/chat"
                className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3d6b20]"
              >
                去 AI 對話記錄首個症狀
              </Link>
            </div>
          ) : filteredSymptoms.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-medium text-gray-900">呢個篩選暫時未有資料</p>
              <p className="mt-1 text-xs text-gray-500">可以切換其他狀態查看。</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSymptoms.map((symptom) => (
                <article key={symptom.id} className="px-4 py-4 sm:px-5">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusPillClass(
                          symptom.status,
                        )}`}
                      >
                        {getStatusLabel(symptom.status)}
                      </span>
                      <h2 className="text-sm font-semibold text-gray-900">
                        {symptom.category?.trim() || "未命名症狀"}
                      </h2>
                      <span className="text-xs text-gray-400">
                        {symptom.loggedVia === "chat" ? "AI 對話記錄" : "手動記錄"}
                      </span>
                    </div>

                    {symptom.description?.trim() ? (
                      <p className="text-sm text-gray-700">{symptom.description.trim()}</p>
                    ) : (
                      <p className="text-sm text-gray-400">未有補充描述</p>
                    )}

                    {symptom.severity ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">嚴重程度</span>
                        {severityBar(symptom.severity)}
                      </div>
                    ) : null}

                    <p className="text-xs text-gray-400">
                      {formatDate(symptom.startedAt)}
                      {symptom.endedAt ? ` → ${formatDate(symptom.endedAt)}` : ""}
                      {!symptom.endedAt && symptom.status === "active" ? " → 進行中" : ""}
                      {" ・ "}更新於 {formatDateTime(symptom.updatedAt || symptom.createdAt)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && filteredSymptoms.length > 0 ? (
          <div className="rounded-xl border border-primary/10 bg-primary-light/30 px-4 py-3 text-xs text-gray-600">
            提示：如果某個症狀已改善，可以喺聊天同 AI 講「好返咗」，系統會更新狀態。
          </div>
        ) : null}
      </div>
    </div>
  );
}
