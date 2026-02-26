"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpCircle } from "lucide-react";
import { TendencyQuizPanel } from "@/components/patient/TendencyQuizPanel";

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
};

type SymptomApiResponse = {
  symptoms?: SymptomItem[];
  error?: string;
};

type CareContextResponse = {
  userId?: string;
  constitution: string;
  constitutionSource?: "patient_care_profile" | "profiles" | "chat_sessions" | "default";
  constitutionNote: string | null;
  error?: string;
};

type StatusFilter = "all" | "active" | "resolved" | "recurring";
type RootSection = "symptoms" | "force";
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
  items: SymptomItem[];
};

type ConstitutionMeta = {
  label: string;
  badgeClass: string;
  summary: string;
};

const CONSTITUTION_META: Record<string, ConstitutionMeta> = {
  depleting: {
    label: "虛耗型",
    badgeClass: "bg-emerald-100 text-emerald-800",
    summary: "重點是補氣養血、減少過度勞累，飲食以溫和、易消化為主。",
  },
  crossing: {
    label: "交錯型",
    badgeClass: "bg-blue-100 text-blue-800",
    summary: "重點是疏導壓力、調節作息，飲食避免過度刺激與偏性太強。",
  },
  hoarding: {
    label: "屯積型",
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

function constitutionSourceLabel(source: CareContextResponse["constitutionSource"]): string {
  if (source === "patient_care_profile") return "來源：醫師評估";
  if (source === "profiles") return "來源：帳號體質檔案";
  if (source === "chat_sessions") return "來源：登入帳號對話紀錄";
  return "來源：未有完整資料";
}

function getSymptomLabel(symptom: SymptomItem): string {
  return symptom.category?.trim() || "未命名症狀";
}

function toSymptomGroupKey(label: string): string {
  return label.toLowerCase();
}

export default function MySymptomsPage() {
  const [symptoms, setSymptoms] = useState<SymptomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [careContext, setCareContext] = useState<CareContextResponse | null>(null);
  const [careLoading, setCareLoading] = useState(true);
  const [careError, setCareError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [rootSection, setRootSection] = useState<RootSection>("symptoms");
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

  const groupedSymptoms = useMemo<SymptomGroup[]>(() => {
    const groups = new Map<string, SymptomGroup>();

    for (const symptom of filteredSymptoms) {
      const label = getSymptomLabel(symptom);
      const key = toSymptomGroupKey(label);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          key,
          label,
          count: 1,
          latest: symptom,
          items: [symptom],
        });
        continue;
      }

      existing.count += 1;
      existing.items.push(symptom);
    }

    return Array.from(groups.values());
  }, [filteredSymptoms]);

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

    return {
      total: sortedSymptoms.length,
      activeCount,
      resolvedCount,
      recurringCount,
      improvedThisMonthCount,
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

  const constitutionKey = careContext?.constitution || "unknown";
  const constitutionMeta = CONSTITUTION_META[constitutionKey] || CONSTITUTION_META.unknown;

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
      resolveForm.resolutionMethod === "其他"
        ? resolveForm.customMethod.trim()
        : resolveForm.resolutionMethod;

    if (!resolveForm.endedAt) {
      setResolveError("請輸入好返日期");
      return;
    }

    if (resolveForm.resolutionMethod === "其他" && !normalizedMethod) {
      setResolveError("請補充好返方式");
      return;
    }

    // Auto-calculate recovery days from start date → end date
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
    <div className="mx-auto h-full w-full max-w-4xl flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="space-y-4">
        <section className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">根源</h1>
              <p className="mt-1 text-xs text-gray-500">
                先睇症狀，再按需要切去原力圖與問卷，手機會更清晰。
              </p>
            </div>
            <Link
              href="/chat"
              className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
            >
              去問問 AI
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-primary/10 bg-primary-light/35 px-3 py-2">
              <p className="text-[11px] text-slate-500">症狀總數</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/70 px-3 py-2">
              <p className="text-[11px] text-red-600">進行中</p>
              <p className="mt-1 text-base font-semibold text-red-700">{stats.activeCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
              <p className="text-[11px] text-emerald-700">本月已好返</p>
              <p className="mt-1 text-base font-semibold text-emerald-700">{stats.improvedThisMonthCount}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-primary/10 bg-primary-light/40 p-1">
            <button
              type="button"
              onClick={() => setRootSection("symptoms")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                rootSection === "symptoms" ? "bg-white text-primary shadow-sm" : "text-slate-600"
              }`}
              aria-pressed={rootSection === "symptoms"}
            >
              我的症狀
            </button>
            <button
              type="button"
              onClick={() => setRootSection("force")}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                rootSection === "force" ? "bg-white text-primary shadow-sm" : "text-slate-600"
              }`}
              aria-pressed={rootSection === "force"}
            >
              原力圖・問卷
            </button>
          </div>
        </section>

        {rootSection === "symptoms" ? (
          <>
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
                            <h2 className="truncate text-base font-semibold text-gray-900">
                              {group.label}
                            </h2>
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
                              {group.count > 1 ? (
                                <span className="text-gray-500">共 {group.count} 次</span>
                              ) : null}
                            </div>

                            {latest.description?.trim() ? (
                              <p className="text-sm leading-relaxed text-gray-700">
                                {latest.description.trim()}
                              </p>
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
                                {editError ? (
                                  <p className="text-xs font-medium text-red-600">{editError}</p>
                                ) : null}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="submit"
                                    disabled={editSaving}
                                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3d6b20] disabled:opacity-50"
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
                提示：列表已簡化，點症狀先展開詳細；需要更新時可按右側圖示標記好轉，或在展開後修改。
              </div>
            ) : null}
          </>
        ) : (
          <section className="rounded-2xl border border-primary/10 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">SOUL 原力圖・問卷</p>
                <p className="mt-1 text-xs text-gray-500">
                  問卷同原力圖會留喺呢一層，避免同症狀清單爭首屏位置。
                </p>
              </div>
              <Link
                href="/chat/symptoms/tendency-quiz"
                className="rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
              >
                專注模式
              </Link>
            </div>

            {careLoading ? (
              <div className="mb-4 rounded-xl border border-primary/10 bg-primary-light/30 px-3 py-2 text-xs text-slate-600">
                載入體質資料...
              </div>
            ) : careError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">
                {careError}
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-primary/10 bg-primary-light/35 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${constitutionMeta.badgeClass}`}>
                    {constitutionMeta.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{constitutionSourceLabel(careContext?.constitutionSource)}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  {careContext?.constitutionNote?.trim() || constitutionMeta.summary}
                </p>
              </div>
            )}

            <TendencyQuizPanel userId={careContext?.userId} />
          </section>
        )}
      </div>

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
                {/* 好返日期 */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">好返日期</label>
                  <input
                    type="date"
                    value={resolveForm.endedAt}
                    onChange={(e) =>
                      setResolveForm((prev) => ({ ...prev, endedAt: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>

                {/* 點樣好返 — chip selection */}
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
                      onChange={(e) =>
                        setResolveForm((prev) => ({ ...prev, customMethod: e.target.value }))
                      }
                      placeholder="自行填寫方式"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : null}
                </div>

                {/* 備注（可選） */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    備注 <span className="font-normal text-gray-400">（可留空）</span>
                  </label>
                  <input
                    type="text"
                    value={resolveForm.resolutionNote}
                    onChange={(e) =>
                      setResolveForm((prev) => ({ ...prev, resolutionNote: e.target.value }))
                    }
                    placeholder="有咩想補充？"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {resolveError ? <p className="text-sm text-red-600">{resolveError}</p> : null}
              </div>

              {/* Sticky action buttons */}
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
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3d6b20] disabled:opacity-50 sm:w-auto"
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
