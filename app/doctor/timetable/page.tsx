"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, RefreshCcw, Save, Trash2 } from "lucide-react";

import {
  DAY_FIELD_ORDER,
  DAY_LABELS_ZH,
  createEmptyDayInputs,
  normalizeDbTime,
  type DayFieldKey,
  type DayInputMap,
} from "@/lib/timetable-admin-utils";
import { getWorkspaceFromPath } from "@/lib/staff-console-workspace";
import { CLINICS, DOCTORS, type ClinicId, type DoctorId } from "@/shared/clinic-data";

type ScheduleItem = {
  id: string | null;
  doctorId: DoctorId;
  clinicId: ClinicId;
  calendarId: string;
  isActive: boolean;
  dayInputs: DayInputMap;
};

type HolidayItem = {
  id: string;
  doctorId: DoctorId | null;
  clinicId: ClinicId | null;
  holidayDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
  createdAt: string;
};

type StaffRole = "doctor" | "assistant" | "admin";

type TimetablePayload = {
  role: StaffRole;
  schedules: Array<{
    id: string;
    doctorId: DoctorId;
    clinicId: ClinicId;
    calendarId: string;
    isActive: boolean;
    dayInputs: DayInputMap;
  }>;
  holidays: HolidayItem[];
};

type HolidayFormState = {
  id: string | null;
  doctorId: DoctorId | "";
  clinicId: ClinicId | "";
  holidayDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

const CLINIC_LABELS = Object.fromEntries(CLINICS.map((clinic) => [clinic.id, clinic.nameZh])) as Record<ClinicId, string>;
const DOCTOR_LABELS = Object.fromEntries(DOCTORS.map((doctor) => [doctor.id, doctor.nameZh])) as Record<DoctorId, string>;

const EMPTY_HOLIDAY_FORM: HolidayFormState = {
  id: null,
  doctorId: "",
  clinicId: "",
  holidayDate: "",
  startTime: "",
  endTime: "",
  reason: "",
};

function buildScheduleMatrix(existing: TimetablePayload["schedules"]): ScheduleItem[] {
  const byKey = new Map(existing.map((item) => [`${item.doctorId}:${item.clinicId}`, item]));

  return CLINICS.map((clinic) =>
    DOCTORS.map((doctor) => {
      const existingItem = byKey.get(`${doctor.id}:${clinic.id}`);

      return {
        id: existingItem?.id ?? null,
        doctorId: doctor.id,
        clinicId: clinic.id,
        calendarId: existingItem?.calendarId ?? "",
        isActive: existingItem?.isActive ?? false,
        dayInputs: existingItem?.dayInputs ?? createEmptyDayInputs(),
      };
    })
  ).flat();
}

function isHolidayFormValid(form: HolidayFormState): boolean {
  if (!form.holidayDate) return false;
  if ((form.startTime && !form.endTime) || (!form.startTime && form.endTime)) return false;
  if (form.startTime && form.endTime && form.startTime >= form.endTime) return false;
  return true;
}

function formatHolidayScope(item: HolidayItem): string {
  const doctor = item.doctorId ? DOCTOR_LABELS[item.doctorId] : "全部醫師";
  const clinic = item.clinicId ? CLINIC_LABELS[item.clinicId] : "全部診所";
  return `${doctor} / ${clinic}`;
}

function formatHolidayDateLabel(dateIso: string): string {
  if (!dateIso) return "未設定日期";

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatHolidayTimeLabel(item: HolidayItem): string {
  if (!item.startTime || !item.endTime) return "全日";
  return `${normalizeDbTime(item.startTime)}-${normalizeDbTime(item.endTime)}`;
}

export default function DoctorTimetablePage() {
  const pathname = usePathname();
  const workspace = getWorkspaceFromPath(pathname);
  const isDoctorWorkspace = workspace === "doctor";
  const [role, setRole] = useState<StaffRole>("assistant");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleRows, setScheduleRows] = useState<ScheduleItem[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [holidayForm, setHolidayForm] = useState<HolidayFormState>(EMPTY_HOLIDAY_FORM);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayDeletingId, setHolidayDeletingId] = useState<string | null>(null);

  async function loadTimetable() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/doctor/timetable", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const payload = data as TimetablePayload;
      setRole(payload.role);
      setScheduleRows(buildScheduleMatrix(payload.schedules));
      setHolidays(payload.holidays);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "載入時間表失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTimetable();
  }, []);

  const scheduleRowsByClinic = useMemo(() => {
    return CLINICS.map((clinic) => ({
      clinic,
      rows: scheduleRows.filter((row) => row.clinicId === clinic.id),
    }));
  }, [scheduleRows]);

  const activeScheduleCount = useMemo(
    () => scheduleRows.filter((row) => row.isActive).length,
    [scheduleRows]
  );

  const inactiveScheduleCount = scheduleRows.length - activeScheduleCount;
  const allDayHolidayCount = useMemo(
    () => holidays.filter((item) => !item.startTime || !item.endTime).length,
    [holidays]
  );
  const scopedHolidayCount = useMemo(
    () => holidays.filter((item) => Boolean(item.doctorId || item.clinicId)).length,
    [holidays]
  );

  function updateScheduleRow(
    doctorId: DoctorId,
    clinicId: ClinicId,
    updater: (row: ScheduleItem) => ScheduleItem
  ) {
    setScheduleRows((prev) =>
      prev.map((row) =>
        row.doctorId === doctorId && row.clinicId === clinicId ? updater(row) : row
      )
    );
  }

  async function handleSaveRow(row: ScheduleItem) {
    const key = `${row.doctorId}:${row.clinicId}`;
    setSavingKey(key);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/doctor/timetable/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const savedId = typeof data.id === "string" ? data.id : row.id;
      if (savedId) {
        updateScheduleRow(row.doctorId, row.clinicId, (current) => ({ ...current, id: savedId }));
      }
      setNotice(`${DOCTOR_LABELS[row.doctorId]} @ ${CLINIC_LABELS[row.clinicId]} 已儲存`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "儲存排班失敗");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleHolidaySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHolidaySaving(true);
    setNotice(null);
    setError(null);

    try {
      const endpoint = holidayForm.id
        ? `/api/doctor/timetable/holidays/${holidayForm.id}`
        : "/api/doctor/timetable/holidays";
      const method = holidayForm.id ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: holidayForm.doctorId || null,
          clinicId: holidayForm.clinicId || null,
          holidayDate: holidayForm.holidayDate,
          startTime: holidayForm.startTime || null,
          endTime: holidayForm.endTime || null,
          reason: holidayForm.reason,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setHolidayForm(EMPTY_HOLIDAY_FORM);
      setNotice(holidayForm.id ? "休診資料已更新" : "休診資料已新增");
      startTransition(() => {
        void loadTimetable();
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "儲存休診資料失敗");
    } finally {
      setHolidaySaving(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    setHolidayDeletingId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/doctor/timetable/holidays/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setNotice("休診資料已刪除");
      setHolidays((prev) => prev.filter((item) => item.id !== id));
      if (holidayForm.id === id) {
        setHolidayForm(EMPTY_HOLIDAY_FORM);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "刪除休診資料失敗");
    } finally {
      setHolidayDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/10 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              Schedule Console
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">時間表管理</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              呢個控制台會直接影響 WordPress 嵌入時間表、Chatbot、預約頁、改期頁，同埋 reminder cron 用緊嘅日曆清單。
              姑娘修改後會即時生效。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              目前角色：<span className="font-semibold text-slate-900">{role === "assistant" ? "姑娘" : role === "admin" ? "管理員" : "醫師"}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadTimetable()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              <RefreshCcw className="h-4 w-4" />
              重新載入
            </button>
            <Link
              href="/embed/timetable"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              預覽 WordPress 時間表
            </Link>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-3xl border border-primary/10 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
          載入時間表中...
        </div>
      ) : (
        <>
          {isDoctorWorkspace ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">醫師固定排班</h2>
                <p className="mt-1 text-sm text-slate-600">
                  每格請輸入 `HH:mm-HH:mm`，多段時段可用逗號分隔，例如 `11:00-14:00, 15:30-19:30`。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">已啟用排班</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{activeScheduleCount}</p>
                  <p className="mt-1 text-sm text-slate-500">會同步到預約頁與 timetable embed。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">未啟用排班</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{inactiveScheduleCount}</p>
                  <p className="mt-1 text-sm text-slate-500">通常代表未開診或未設定 Google Calendar。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">姑娘公告</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{holidays.length}</p>
                  <p className="mt-1 text-sm text-slate-500">需要改休診或 booking 提示可切去姑娘頁面。</p>
                </div>
              </div>

              {scheduleRowsByClinic.map(({ clinic, rows }) => (
                <section
                  key={clinic.id}
                  className="overflow-hidden rounded-3xl border border-primary/10 bg-white shadow-sm"
                >
                  <div className="border-b border-primary/10 bg-primary/5 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{clinic.nameZh} 時間表</h3>
                        <p className="mt-1 text-sm text-slate-600">{clinic.hoursText}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                          啟用 {rows.filter((row) => row.isActive).length} 位醫師
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                          共 {rows.length} 個排班卡
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-4 xl:grid-cols-2">
                    {rows.map((row) => {
                      const saveKey = `${row.doctorId}:${row.clinicId}`;
                      const isSaving = savingKey === saveKey;

                      return (
                        <article
                          key={saveKey}
                          className={`rounded-2xl border px-4 py-4 transition ${
                            row.isActive
                              ? "border-primary/15 bg-white shadow-sm"
                              : "border-slate-200 bg-slate-50/70"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-slate-900">
                                {DOCTOR_LABELS[row.doctorId]}
                              </p>
                              <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                {clinic.nameZh}
                              </p>
                            </div>

                            <label className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={row.isActive}
                                onChange={(event) =>
                                  updateScheduleRow(row.doctorId, row.clinicId, (current) => ({
                                    ...current,
                                    isActive: event.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              {row.isActive ? "已啟用" : "未啟用"}
                            </label>
                          </div>

                          <label className="mt-4 block space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Google Calendar ID
                            </span>
                            <input
                              value={row.calendarId}
                              onChange={(event) =>
                                updateScheduleRow(row.doctorId, row.clinicId, (current) => ({
                                  ...current,
                                  calendarId: event.target.value,
                                }))
                              }
                              placeholder="Google Calendar ID"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </label>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {DAY_FIELD_ORDER.map((dayKey) => (
                              <label key={`${saveKey}-${dayKey}`} className="space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  {DAY_LABELS_ZH[dayKey]}
                                </span>
                                <input
                                  value={row.dayInputs[dayKey]}
                                  onChange={(event) =>
                                    updateScheduleRow(row.doctorId, row.clinicId, (current) => ({
                                      ...current,
                                      dayInputs: {
                                        ...current.dayInputs,
                                        [dayKey]: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="11:00-14:00"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </label>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs leading-5 text-slate-500">
                              留空代表該日唔應診；多段時段可用逗號分隔。
                            </p>
                            <button
                              type="button"
                              onClick={() => void handleSaveRow(row)}
                              disabled={isSaving}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Save className="h-4 w-4" />
                              {isSaving ? "儲存中..." : "儲存排班"}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </section>
          ) : (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">姑娘休診 / 公告</h2>
                <p className="mt-1 text-sm text-slate-600">
                  集中處理全線休息、指定醫師休診、員工活動日等安排。原因文案會同步顯示喺 booking 頁黃色提示。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">公告總數</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{holidays.length}</p>
                  <p className="mt-1 text-sm text-slate-500">所有未來休診 / 公告資料。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">全日安排</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{allDayHolidayCount}</p>
                  <p className="mt-1 text-sm text-slate-500">留空開始/結束時間就會計入呢類。</p>
                </div>
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">指定範圍公告</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{scopedHolidayCount}</p>
                  <p className="mt-1 text-sm text-slate-500">只對某醫師或某診所生效。</p>
                </div>
              </div>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                <div className="rounded-3xl border border-primary/10 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {holidayForm.id ? "編輯休診資料" : "新增休診資料"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    不填開始／結束時間即代表全日休診。`doctor` 或 `clinic` 留空可作用於全體。原因會同步顯示喺 booking 頁黃色提示。
                  </p>

                  <form className="mt-5 space-y-4" onSubmit={handleHolidaySubmit}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">醫師</label>
                        <select
                          value={holidayForm.doctorId}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, doctorId: event.target.value as DoctorId | "" }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">全部醫師</option>
                          {DOCTORS.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              {doctor.nameZh}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">診所</label>
                        <select
                          value={holidayForm.clinicId}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, clinicId: event.target.value as ClinicId | "" }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="">全部診所</option>
                          {CLINICS.map((clinic) => (
                            <option key={clinic.id} value={clinic.id}>
                              {clinic.nameZh}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-1">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">日期</label>
                        <input
                          type="date"
                          value={holidayForm.holidayDate}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, holidayDate: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">開始時間</label>
                        <input
                          type="time"
                          value={holidayForm.startTime}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, startTime: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">結束時間</label>
                        <input
                          type="time"
                          value={holidayForm.endTime}
                          onChange={(event) =>
                            setHolidayForm((prev) => ({ ...prev, endTime: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">原因</label>
                      <textarea
                        value={holidayForm.reason}
                        onChange={(event) =>
                          setHolidayForm((prev) => ({ ...prev, reason: event.target.value }))
                        }
                        rows={3}
                        placeholder="例如：23/4(四)員工活動日，全線休息一日"
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={holidaySaving || !isHolidayFormValid(holidayForm)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" />
                        {holidaySaving ? "儲存中..." : holidayForm.id ? "更新休診" : "新增休診"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHolidayForm(EMPTY_HOLIDAY_FORM)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        重設
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-3xl border border-primary/10 bg-white shadow-sm">
                  <div className="border-b border-primary/10 px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">現有休診資料</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      點一下「編輯」可載入左邊表單，或者直接刪除。
                    </p>
                  </div>

                  <div className="space-y-3 p-4">
                    {holidays.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
                                {formatHolidayScope(item)}
                              </span>
                              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                                {formatHolidayDateLabel(item.holidayDate)}
                              </span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                                {formatHolidayTimeLabel(item)}
                              </span>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                原因
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-800">
                                {item.reason || "—"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setHolidayForm({
                                  id: item.id,
                                  doctorId: item.doctorId ?? "",
                                  clinicId: item.clinicId ?? "",
                                  holidayDate: item.holidayDate,
                                  startTime: normalizeDbTime(item.startTime) ?? "",
                                  endTime: normalizeDbTime(item.endTime) ?? "",
                                  reason: item.reason,
                                })
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteHoliday(item.id)}
                              disabled={holidayDeletingId === item.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {holidayDeletingId === item.id ? "刪除中..." : "刪除"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}

                    {holidays.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        暫時未有休診資料
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </section>
          )}
        </>
      )}
    </div>
  );
}
