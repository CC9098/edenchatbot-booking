"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpCircle, ChevronRight } from "lucide-react";
import { constitutionToTendencyKey, FORCE_NARRATIVE } from "@/lib/narrative-copy";

type SymptomItem = {
  id: string;
  category: string | null;
  description: string | null;
  severity: number | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  resolutionMethod: string | null;
  resolutionNote: string | null;
  resolutionDays: number | null;
  loggedVia: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  elementTraits?: Record<string, unknown> | null;
  elementScoreWater?: number | null;
  elementScoreWind?: number | null;
  elementScoreThunder?: number | null;
  elementSuggestedLabel?: "water" | "wind" | "thunder" | "undetermined" | null;
  elementReviewLabel?: "water" | "wind" | "thunder" | "undetermined" | null;
};

type SymptomApiResponse = {
  symptoms?: SymptomItem[];
  error?: string;
};

type CareContextResponse = {
  userId?: string;
  constitution: string;
  constitutionSource?: "patient_care_profile" | "default";
  constitutionNote: string | null;
  error?: string;
};

type StatusFilter = "all" | "active" | "resolved" | "recurring";

type ResolveFormState = {
  endedAt: string;
  resolutionMethod: string;
  customMethod: string;
  resolutionNote: string;
};

type EditFormState = {
  description: string;
  severity: string;
};

type SymptomGroup = {
  key: string;
  label: string;
  count: number;
  latest: SymptomItem;
};

type ElementSegment = {
  key: ElementKey;
  label: string;
  value: number;
  width: number;
  barClass: string;
};

type ConstitutionMeta = {
  label: string;
  badgeClass: string;
};

type ElementKey = "water" | "wind" | "thunder";

const CONSTITUTION_META: Record<string, ConstitutionMeta> = {
  depleting: {
    label: "虛耗型",
    badgeClass: "bg-emerald-100 text-emerald-800",
  },
  crossing: {
    label: "交錯型",
    badgeClass: "bg-blue-100 text-blue-800",
  },
  hoarding: {
    label: "屯積型",
    badgeClass: "bg-purple-100 text-purple-800",
  },
  mixed: {
    label: "混合",
    badgeClass: "bg-orange-100 text-orange-800",
  },
  unknown: {
    label: "未評估",
    badgeClass: "bg-gray-100 text-gray-700",
  },
};

const ELEMENT_META: Record<
  ElementKey,
  {
    shortLabel: string;
    label: string;
    barClass: string;
  }
> = {
  water: {
    shortLabel: "水",
    label: "水",
    barClass: "bg-cyan-500",
  },
  wind: {
    shortLabel: "風",
    label: "風",
    barClass: "bg-emerald-500",
  },
  thunder: {
    shortLabel: "雷",
    label: "雷",
    barClass: "bg-amber-500",
  },
};

const RESOLUTION_METHOD_OPTIONS = [
  "多休息",
  "飲薑茶或暖身飲品",
  "補充水分",
  "調整飲食",
  "按時服藥",
  "減少壓力 / 早睡",
  "其他",
] as const;

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

function getSymptomPriority(value: string | null): number {
  if (value === "active") return 0;
  if (value === "recurring") return 1;
  if (value === "resolved") return 2;
  return 3;
}

function resolveSeverityPoint(severity: number | null | undefined): number {
  const normalizedSeverity = typeof severity === "number" ? severity : Number.NaN;
  if (!Number.isInteger(normalizedSeverity)) return 1;
  return normalizedSeverity >= 4 ? 2 : 1;
}

function resolveFinalElementLabel(symptom: SymptomItem): ElementKey | "undetermined" {
  const reviewed = symptom.elementReviewLabel;
  if (reviewed === "water" || reviewed === "wind" || reviewed === "thunder") return reviewed;

  const suggested = symptom.elementSuggestedLabel;
  if (suggested === "water" || suggested === "wind" || suggested === "thunder") return suggested;
  return "undetermined";
}

function toSafeDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function todayInHongKongDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isSameMonth(date: Date, monthBase: Date): boolean {
  return date.getFullYear() === monthBase.getFullYear() && date.getMonth() === monthBase.getMonth();
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

function getSymptomLabel(symptom: SymptomItem): string {
  return symptom.category?.trim() || "未命名症狀";
}

function toSymptomGroupKey(label: string): string {
  return label.toLowerCase();
}

function groupSymptoms(symptoms: SymptomItem[]): SymptomGroup[] {
  const groups = new Map<string, SymptomGroup>();

  for (const symptom of symptoms) {
    const label = getSymptomLabel(symptom);
    const key = toSymptomGroupKey(label);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        label,
        count: 1,
        latest: symptom,
      });
      continue;
    }

    existing.count += 1;
  }

  return Array.from(groups.values());
}

function getLeadingElement(stats: {
  waterScore: number;
  windScore: number;
  thunderScore: number;
}): ElementKey | null {
  const entries: Array<{ key: ElementKey; value: number }> = [
    { key: "water", value: stats.waterScore },
    { key: "wind", value: stats.windScore },
    { key: "thunder", value: stats.thunderScore },
  ];

  const leader = entries.sort((a, b) => b.value - a.value)[0];
  if (!leader || leader.value <= 0) return null;
  return leader.key;
}

export default function MySymptomsPage() {
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [careContext, setCareContext] = useState<CareContextResponse | null>(null);
  const [careLoading, setCareLoading] = useState(true);
  const [careError, setCareError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [showSymptomDrawer, setShowSymptomDrawer] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<SymptomItem | null>(null);
  const [resolveSaving, setResolveSaving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [expandedSymptomId, setExpandedSymptomId] = useState<string | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState<EditFormState>({
    description: "",
    severity: "",
  });
  const [resolveForm, setResolveForm] = useState<ResolveFormState>({
    endedAt: todayInHongKongDate(),
    resolutionMethod: RESOLUTION_METHOD_OPTIONS[0],
    customMethod: "",
    resolutionNote: "",
  });

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

  const loadCareContext = useCallback(async () => {
    try {
      setCareLoading(true);
      setCareError("");
      const response = await fetch("/api/me/care-context");
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "無法載入體質資料");
      }
      const data = (await response.json()) as CareContextResponse;
      setCareContext(data);
    } catch (err) {
      setCareError(err instanceof Error ? err.message : "無法載入體質資料");
    } finally {
      setCareLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSymptoms();
    void loadCareContext();
  }, [loadSymptoms, loadCareContext]);

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

  const groupedSymptoms = useMemo(() => groupSymptoms(filteredSymptoms), [filteredSymptoms]);

  const dashboardSymptomGroups = useMemo(
    () =>
      groupSymptoms(sortedSymptoms).sort((a, b) => {
        const byStatus = getSymptomPriority(a.latest.status) - getSymptomPriority(b.latest.status);
        if (byStatus !== 0) return byStatus;
        const aTime = toSafeDate(a.latest.updatedAt || a.latest.createdAt)?.getTime() || 0;
        const bTime = toSafeDate(b.latest.updatedAt || b.latest.createdAt)?.getTime() || 0;
        return bTime - aTime;
      }),
    [sortedSymptoms],
  );

  const previewSymptoms = useMemo(() => dashboardSymptomGroups.slice(0, 2), [dashboardSymptomGroups]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCount = sortedSymptoms.filter((s) => s.status === "active").length;
    const resolvedCount = sortedSymptoms.filter((s) => s.status === "resolved").length;
    const recurringCount = sortedSymptoms.filter((s) => s.status === "recurring").length;
    const improvedThisMonthCount = sortedSymptoms.filter((s) => {
      if (s.status !== "resolved") return false;
      const ended = toSafeDate(s.endedAt);
      if (ended) return isSameMonth(ended, now);
      const updated = toSafeDate(s.updatedAt || s.createdAt);
      return updated ? isSameMonth(updated, now) : false;
    }).length;

    let waterScore = 0;
    let windScore = 0;
    let thunderScore = 0;
    let undeterminedCount = 0;

    for (const symptom of sortedSymptoms) {
      const water = Number(symptom.elementScoreWater || 0);
      const wind = Number(symptom.elementScoreWind || 0);
      const thunder = Number(symptom.elementScoreThunder || 0);
      const hasDbScores = water > 0 || wind > 0 || thunder > 0;

      if (hasDbScores) {
        waterScore += water;
        windScore += wind;
        thunderScore += thunder;
      } else {
        const finalLabel = resolveFinalElementLabel(symptom);
        const fallbackPoint = resolveSeverityPoint(symptom.severity);
        if (finalLabel === "water") waterScore += fallbackPoint;
        if (finalLabel === "wind") windScore += fallbackPoint;
        if (finalLabel === "thunder") thunderScore += fallbackPoint;
      }

      if (resolveFinalElementLabel(symptom) === "undetermined") {
        undeterminedCount += 1;
      }
    }

    return {
      total: sortedSymptoms.length,
      activeCount,
      resolvedCount,
      recurringCount,
      improvedThisMonthCount,
      waterScore,
      windScore,
      thunderScore,
      undeterminedCount,
    };
  }, [sortedSymptoms]);

  const filterChips = useMemo(
    () => [
      { value: "all" as const, label: "全部", count: stats.total },
      { value: "active" as const, label: "進行中", count: stats.activeCount },
      { value: "resolved" as const, label: "已好返", count: stats.resolvedCount },
      { value: "recurring" as const, label: "反覆", count: stats.recurringCount },
    ],
    [stats.activeCount, stats.recurringCount, stats.resolvedCount, stats.total],
  );

  const elementBarSegments = useMemo<ElementSegment[]>(() => {
    const totalScore = stats.waterScore + stats.windScore + stats.thunderScore;
    return [
      {
        key: "water" as const,
        label: ELEMENT_META.water.label,
        value: stats.waterScore,
        width: totalScore > 0 ? Math.round((stats.waterScore / totalScore) * 100) : 0,
        barClass: ELEMENT_META.water.barClass,
      },
      {
        key: "wind" as const,
        label: ELEMENT_META.wind.label,
        value: stats.windScore,
        width: totalScore > 0 ? Math.round((stats.windScore / totalScore) * 100) : 0,
        barClass: ELEMENT_META.wind.barClass,
      },
      {
        key: "thunder" as const,
        label: ELEMENT_META.thunder.label,
        value: stats.thunderScore,
        width: totalScore > 0 ? Math.round((stats.thunderScore / totalScore) * 100) : 0,
        barClass: ELEMENT_META.thunder.barClass,
      },
    ];
  }, [stats.thunderScore, stats.waterScore, stats.windScore]);

  const constitutionKey = careContext?.constitution || "unknown";
  const constitutionMeta = CONSTITUTION_META[constitutionKey] || CONSTITUTION_META.unknown;
  const tendencyKey = constitutionToTendencyKey(constitutionKey);
  const accentBg = tendencyKey ? FORCE_NARRATIVE[tendencyKey].accentBg : "bg-primary-light/30";
  const hasSymptomRecords = stats.total > 0;
  const hasSymptomSignal = elementBarSegments.some((segment) => segment.value > 0);
  const displayElementSegments = hasSymptomSignal ? elementBarSegments : null;
  const displayLeadingElement = useMemo(
    () =>
      displayElementSegments
        ? getLeadingElement({
            waterScore: displayElementSegments.find((segment) => segment.key === "water")?.value || 0,
            windScore: displayElementSegments.find((segment) => segment.key === "wind")?.value || 0,
            thunderScore: displayElementSegments.find((segment) => segment.key === "thunder")?.value || 0,
          })
        : null,
    [displayElementSegments],
  );
  const symptomActionLabel =
    dashboardSymptomGroups.length > previewSymptoms.length ? `查看全部 (${dashboardSymptomGroups.length})` : "管理";

  function openResolveModal(symptom: SymptomItem) {
    setResolveTarget(symptom);
    setResolveSaving(false);
    setResolveError("");
    setResolveForm({
      endedAt: todayInHongKongDate(),
      resolutionMethod: RESOLUTION_METHOD_OPTIONS[0],
      customMethod: "",
      resolutionNote: "",
    });
  }

  function openSymptomDrawer(groupKey?: string | null) {
    setShowSymptomDrawer(true);
    if (typeof groupKey === "string") {
      setExpandedSymptomId(groupKey);
    }
  }

  function closeSymptomDrawer() {
    setShowSymptomDrawer(false);
    setEditTargetId(null);
    setEditError("");
  }

  function closeResolveModal() {
    if (resolveSaving) return;
    setResolveTarget(null);
    setResolveError("");
  }

  function toggleSymptomExpand(groupKey: string) {
    setExpandedSymptomId((prev) => (prev === groupKey ? null : groupKey));
    setEditTargetId(null);
    setEditError("");
  }

  function startEditSymptom(symptom: SymptomItem) {
    setEditTargetId(symptom.id);
    setEditSaving(false);
    setEditError("");
    setEditForm({
      description: symptom.description || "",
      severity: symptom.severity ? String(symptom.severity) : "",
    });
  }

  function cancelEditSymptom() {
    if (editSaving) return;
    setEditTargetId(null);
    setEditError("");
  }

  async function submitEditSymptom(e: FormEvent<HTMLFormElement>, symptom: SymptomItem) {
    e.preventDefault();
    if (editSaving) return;

    const description = editForm.description.trim();
    const severityRaw = editForm.severity.trim();

    let severity: number | null = null;
    if (severityRaw) {
      const parsed = Number.parseInt(severityRaw, 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        setEditError("嚴重程度要填 1 至 5。");
        return;
      }
      severity = parsed;
    }

    try {
      setEditSaving(true);
      setEditError("");

      const response = await fetch(`/api/me/symptoms/${symptom.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description || null,
          severity,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "更新症狀失敗");
      }

      setEditTargetId(null);
      await loadSymptoms();
      setExpandedSymptomId(toSymptomGroupKey(getSymptomLabel(symptom)));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "更新症狀失敗");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitResolveForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resolveTarget) return;

    const normalizedMethod =
      resolveForm.resolutionMethod === "其他" ? resolveForm.customMethod.trim() : resolveForm.resolutionMethod;

    if (!resolveForm.endedAt) {
      setResolveError("請輸入好返日期");
      return;
    }

    if (resolveForm.resolutionMethod === "其他" && !normalizedMethod) {
      setResolveError("請補充好返方式");
      return;
    }

    let normalizedDays: number | null = null;
    if (resolveTarget.startedAt && resolveForm.endedAt) {
      const start = toSafeDate(resolveTarget.startedAt);
      const end = toSafeDate(resolveForm.endedAt);
      if (start && end) {
        const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 365) normalizedDays = diff;
      }
    }

    try {
      setResolveSaving(true);
      setResolveError("");

      const response = await fetch(`/api/me/symptoms/${resolveTarget.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "resolved",
          endedAt: resolveForm.endedAt,
          resolutionMethod: normalizedMethod || null,
          resolutionNote: resolveForm.resolutionNote.trim() || null,
          resolutionDays: normalizedDays,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "更新症狀失敗");
      }

      setResolveTarget(null);
      await loadSymptoms();
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : "更新症狀失敗");
    } finally {
      setResolveSaving(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col overflow-hidden p-4 sm:p-6">
      <div className="flex h-full flex-col gap-3">
        <section className={`rounded-[28px] border border-primary/10 p-4 shadow-sm ${accentBg}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-600">身體狀態</p>
              {displayLeadingElement ? (
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-5xl font-semibold leading-none text-slate-900">
                    {ELEMENT_META[displayLeadingElement].shortLabel}
                  </span>
                  <p className="pb-1 text-sm font-semibold text-slate-900">
                    {ELEMENT_META[displayLeadingElement].label}較明顯
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">未有足夠資料。</p>
              )}
            </div>
            {!careLoading && !careError ? (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${constitutionMeta.badgeClass}`}
              >
                {constitutionMeta.label}
              </span>
            ) : null}
          </div>

          {displayElementSegments ? (
            <>
              <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-3 w-full">
                  {displayElementSegments.map((segment) => (
                    <div
                      key={segment.key}
                      className={`h-full transition-all ${segment.barClass}`}
                      style={{ width: `${segment.width}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600">
                {displayElementSegments.map((segment) => (
                  <span key={segment.key} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${segment.barClass}`} />
                    <span>{segment.label}</span>
                    <span className="text-slate-500">{segment.width}%</span>
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-primary/10 bg-white/95 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">症狀</h2>
            </div>
            <button
              type="button"
              onClick={() => openSymptomDrawer()}
              className="inline-flex items-center rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
            >
              {symptomActionLabel}
            </button>
          </div>

          {loading ? (
            <div className="mt-3 rounded-2xl border border-primary/10 bg-primary-light/20 px-3 py-4 text-sm text-slate-500">
              載入症狀中...
            </div>
          ) : error ? (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50/70 px-3 py-4 text-sm text-red-700">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadSymptoms()}
                className="mt-3 inline-flex rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200"
              >
                重試
              </button>
            </div>
          ) : previewSymptoms.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-primary/10 bg-primary-light/20 px-3 py-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">暫時未有症狀紀錄</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {previewSymptoms.map((group) => {
                const latest = group.latest;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => openSymptomDrawer(group.key)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary-light/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{group.label}</p>
                        {group.count > 1 ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                            {group.count}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${getStatusPillClass(latest.status)}`}>
                          {getStatusLabel(latest.status)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          更新於 {formatDate(latest.updatedAt || latest.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {showSymptomDrawer ? (
        <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[30px] bg-white shadow-xl sm:h-[82vh] sm:rounded-[30px]">
            <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">全部症狀</h2>
                </div>
                <button
                  type="button"
                  onClick={closeSymptomDrawer}
                  className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label="關閉症狀明細"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max items-center gap-2 rounded-2xl border border-primary/10 bg-white p-2">
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
                        className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
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
                      {groupedSymptoms.map((group) => {
                        const latest = group.latest;
                        const isExpanded = expandedSymptomId === group.key;
                        const isEditing = editTargetId === latest.id;
                        const canResolve = latest.status === "active" || latest.status === "recurring";

                        return (
                          <article key={group.key} className="px-4 py-3 sm:px-5">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSymptomExpand(group.key)}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <h3 className="truncate text-base font-semibold text-gray-900">{group.label}</h3>
                                {group.count > 1 ? (
                                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                    {group.count}
                                  </span>
                                ) : null}
                                <span className="text-xs text-gray-400">{isExpanded ? "收起" : "展開"}</span>
                              </button>

                              {canResolve ? (
                                <button
                                  type="button"
                                  onClick={() => openResolveModal(latest)}
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                  aria-label={`標記「${group.label}」為好轉`}
                                  title="標記好轉"
                                >
                                  <ArrowUpCircle className="h-4.5 w-4.5" />
                                </button>
                              ) : null}
                            </div>

                            {isExpanded ? (
                              <div className="mt-3 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${getStatusPillClass(
                                      latest.status,
                                    )}`}
                                  >
                                    {getStatusLabel(latest.status)}
                                  </span>
                                  <span className="text-gray-500">
                                    嚴重程度：{latest.severity ? `${latest.severity}/5` : "未填"}
                                  </span>
                                  <span className="text-gray-400">
                                    更新於 {formatDateTime(latest.updatedAt || latest.createdAt)}
                                  </span>
                                  {group.count > 1 ? <span className="text-gray-500">共 {group.count} 次</span> : null}
                                </div>

                                {latest.description?.trim() ? (
                                  <p className="text-sm leading-relaxed text-gray-700">{latest.description.trim()}</p>
                                ) : (
                                  <p className="text-sm text-gray-400">未有補充描述</p>
                                )}

                                {(latest.resolutionMethod ||
                                  (latest.resolutionDays !== null && latest.resolutionDays !== undefined) ||
                                  latest.resolutionNote) ? (
                                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
                                    {latest.resolutionMethod ? <p>點樣好返：{latest.resolutionMethod}</p> : null}
                                    {latest.resolutionDays !== null && latest.resolutionDays !== undefined ? (
                                      <p>幾耐好返：約 {latest.resolutionDays} 日</p>
                                    ) : null}
                                    {latest.resolutionNote ? (
                                      <p className="whitespace-pre-wrap">補充：{latest.resolutionNote}</p>
                                    ) : null}
                                  </div>
                                ) : null}

                                <p className="text-xs text-gray-400">
                                  {formatDate(latest.startedAt)}
                                  {latest.endedAt ? ` → ${formatDate(latest.endedAt)}` : ""}
                                  {!latest.endedAt && latest.status === "active" ? " → 進行中" : ""}
                                </p>

                                {!isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => startEditSymptom(latest)}
                                      className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                                    >
                                      修改
                                    </button>
                                  </div>
                                ) : (
                                  <form
                                    onSubmit={(event) => void submitEditSymptom(event, latest)}
                                    className="space-y-2 rounded-lg border border-gray-200 bg-white p-3"
                                  >
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <label className="text-xs text-gray-600">
                                        嚴重程度 (1-5)
                                        <input
                                          type="number"
                                          min={1}
                                          max={5}
                                          value={editForm.severity}
                                          onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, severity: event.target.value }))
                                          }
                                          className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                      </label>
                                    </div>
                                    <label className="block text-xs text-gray-600">
                                      描述
                                      <textarea
                                        rows={3}
                                        value={editForm.description}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({ ...prev, description: event.target.value }))
                                        }
                                        className="mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                    </label>
                                    {editError ? <p className="text-xs font-medium text-red-600">{editError}</p> : null}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="submit"
                                        disabled={editSaving}
                                        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
                                      >
                                        {editSaving ? "儲存中..." : "儲存修改"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditSymptom}
                                        disabled={editSaving}
                                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!loading && !error && filteredSymptoms.length > 0 ? (
                  <div className="rounded-xl border border-primary/10 bg-primary-light/30 px-4 py-3 text-xs text-gray-600">
                    提示：點症狀先展開詳細；需要更新時可按右側圖示標記好轉，或在展開後修改。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resolveTarget ? (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                標記好轉：{resolveTarget.category?.trim() || "症狀"}
              </h2>
              <button
                type="button"
                onClick={closeResolveModal}
                className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                disabled={resolveSaving}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitResolveForm} className="flex flex-col">
              <div className="space-y-4 px-4 py-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">好返日期</label>
                  <input
                    type="date"
                    value={resolveForm.endedAt}
                    onChange={(e) => setResolveForm((prev) => ({ ...prev, endedAt: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">點樣好返</label>
                  <div className="flex flex-wrap gap-2">
                    {RESOLUTION_METHOD_OPTIONS.map((option) => {
                      const selected = resolveForm.resolutionMethod === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setResolveForm((prev) => ({ ...prev, resolutionMethod: option, customMethod: "" }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  {resolveForm.resolutionMethod === "其他" ? (
                    <input
                      type="text"
                      value={resolveForm.customMethod}
                      onChange={(e) => setResolveForm((prev) => ({ ...prev, customMethod: e.target.value }))}
                      placeholder="自行填寫方式"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    備注 <span className="font-normal text-gray-400">（可留空）</span>
                  </label>
                  <input
                    type="text"
                    value={resolveForm.resolutionNote}
                    onChange={(e) => setResolveForm((prev) => ({ ...prev, resolutionNote: e.target.value }))}
                    placeholder="有咩想補充？"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {resolveError ? <p className="text-sm text-red-600">{resolveError}</p> : null}
              </div>

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  disabled={resolveSaving}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={resolveSaving}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-50 sm:w-auto"
                >
                  {resolveSaving ? "儲存中..." : "確認好轉"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
