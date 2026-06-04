"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Save, Search } from "lucide-react";

import {
  OVERSEAS_CONSULTATION_STATUS_LABELS,
  OVERSEAS_CONSULTATION_STATUSES,
  type OverseasConsultationStatus,
  type OverseasConsultationSubmission,
} from "@/lib/overseas-consultation";

type StaffRow = OverseasConsultationSubmission & {
  payment_proof_url: string | null;
};

type Draft = {
  status: OverseasConsultationStatus;
  basic_fee_status: "pending" | "uploaded" | "confirmed";
  suggested_herbal_days: string;
  quoted_herbal_fee: string;
  herbal_fee_paid: boolean;
  admin_fee_paid: boolean;
  dispensing_completed: boolean;
  actual_postage: string;
  tracking_number: string;
  postage_reimbursed: boolean;
  staff_notes: string;
};

function toDraft(row: StaffRow): Draft {
  return {
    status: row.status,
    basic_fee_status: row.basic_fee_status,
    suggested_herbal_days: row.suggested_herbal_days?.toString() || "",
    quoted_herbal_fee: row.quoted_herbal_fee?.toString() || "",
    herbal_fee_paid: row.herbal_fee_paid,
    admin_fee_paid: row.admin_fee_paid,
    dispensing_completed: row.dispensing_completed,
    actual_postage: row.actual_postage?.toString() || "",
    tracking_number: row.tracking_number || "",
    postage_reimbursed: row.postage_reimbursed,
    staff_notes: row.staff_notes || "",
  };
}

function parseNullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-HK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OverseasConsultationsClient() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.emergency_flags.length) acc.emergency += 1;
        if (row.basic_fee_status === "confirmed") acc.confirmed += 1;
        if (row.status === "completed") acc.completed += 1;
        return acc;
      },
      { total: 0, emergency: 0, confirmed: 0, completed: 0 },
    );
  }, [rows]);

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      const response = await fetch(`/api/staff/overseas-consultations?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "載入海外申請失敗");
      }
      const nextRows = (payload.rows || []) as StaffRow[];
      setRows(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row) => [row.id, toDraft(row)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "載入海外申請失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  async function saveRow(id: string) {
    const draft = drafts[id];
    if (!draft) return;

    setSavingId(id);
    setError(null);
    try {
      const response = await fetch("/api/staff/overseas-consultations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: draft.status,
          basic_fee_status: draft.basic_fee_status,
          suggested_herbal_days: parseNullableNumber(draft.suggested_herbal_days),
          quoted_herbal_fee: parseNullableNumber(draft.quoted_herbal_fee),
          herbal_fee_paid: draft.herbal_fee_paid,
          admin_fee_paid: draft.admin_fee_paid,
          dispensing_completed: draft.dispensing_completed,
          actual_postage: parseNullableNumber(draft.actual_postage),
          tracking_number: draft.tracking_number.trim() || null,
          postage_reimbursed: draft.postage_reimbursed,
          staff_notes: draft.staff_notes.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "儲存失敗");
      }
      await loadRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存失敗");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">海外網診</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">海外寄藥申請</h1>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">總數 {summary.total}</span>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">急症 {summary.emergency}</span>
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">已收 HKD400 {summary.confirmed}</span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">完成 {summary.completed}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadRows();
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
            placeholder="搜尋姓名、電話、Email、國家"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        >
          <option value="all">全部狀態</option>
          {OVERSEAS_CONSULTATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {OVERSEAS_CONSULTATION_STATUS_LABELS[item]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadRows()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          更新
        </button>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      {loading ? (
        <div className="flex min-h-60 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.id];
            if (!draft) return null;
            return (
              <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{row.patient_chinese_name}</h2>
                      {row.patient_english_name ? <span className="text-sm text-slate-500">{row.patient_english_name}</span> : null}
                      {row.emergency_flags.length ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">急症篩查有是</span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <p>WhatsApp：{row.whatsapp}</p>
                      <p>Email：{row.email}</p>
                      <p>所在地：{row.country} {row.city}</p>
                      <p>時區：{row.timezone}</p>
                      <p>首選：{row.preferred_date} {row.preferred_time}</p>
                      <p>提交：{formatDateTime(row.created_at)}</p>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      <p className="font-semibold text-slate-950">主要調理問題</p>
                      <p>{typeof row.health_data.mainConcern === "string" ? row.health_data.mainConcern : "-"}</p>
                    </div>
                    {row.emergency_flags.length ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900">
                        {row.emergency_flags.join("、")}
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                      <p>收件人：{row.recipient_name} / {row.recipient_phone}</p>
                      <p>地址：{row.address_line1} {row.address_line2 || ""} {row.shipping_city} {row.shipping_country}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-semibold text-slate-600">
                      流程狀態
                      <select
                        value={draft.status}
                        onChange={(event) => updateDraft(row.id, { status: event.target.value as OverseasConsultationStatus })}
                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        {OVERSEAS_CONSULTATION_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {OVERSEAS_CONSULTATION_STATUS_LABELS[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      基本網診費
                      <select
                        value={draft.basic_fee_status}
                        onChange={(event) => updateDraft(row.id, { basic_fee_status: event.target.value as Draft["basic_fee_status"] })}
                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      >
                        <option value="pending">未確認</option>
                        <option value="uploaded">已上載證明</option>
                        <option value="confirmed">已確認</option>
                      </select>
                    </label>
                    {row.payment_proof_url ? (
                      <a
                        href={row.payment_proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline"
                      >
                        查看付款證明
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-sm" placeholder="藥日數" value={draft.suggested_herbal_days} onChange={(event) => updateDraft(row.id, { suggested_herbal_days: event.target.value })} />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-sm" placeholder="藥費" value={draft.quoted_herbal_fee} onChange={(event) => updateDraft(row.id, { quoted_herbal_fee: event.target.value })} />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-sm" placeholder="實際郵費" value={draft.actual_postage} onChange={(event) => updateDraft(row.id, { actual_postage: event.target.value })} />
                      <input className="h-9 rounded-md border border-slate-300 px-2 text-sm" placeholder="tracking number" value={draft.tracking_number} onChange={(event) => updateDraft(row.id, { tracking_number: event.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                      {[
                        ["herbal_fee_paid", "藥費已付"],
                        ["admin_fee_paid", "行政費已付"],
                        ["dispensing_completed", "已配藥"],
                        ["postage_reimbursed", "郵費已補"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(draft[key as keyof Draft])}
                            onChange={(event) => updateDraft(row.id, { [key]: event.target.checked } as Partial<Draft>)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={draft.staff_notes}
                      onChange={(event) => updateDraft(row.id, { staff_notes: event.target.value })}
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                      placeholder="備註"
                    />
                    <button
                      type="button"
                      onClick={() => void saveRow(row.id)}
                      disabled={savingId === row.id}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-400"
                    >
                      {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      儲存
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!rows.length ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">暫時沒有海外網診申請</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
