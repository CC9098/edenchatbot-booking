"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  CalendarDays,
  ClipboardCopy,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";

import { CLINICS, DOCTORS } from "@/shared/clinic-data";
import { BOOKING_PICKUP_LABELS } from "@/shared/booking-pickup";

type StaffBookingStatus = "pending" | "confirmed" | "cancelled" | "failed";

type StaffBookingListItem = {
  id: string;
  source: string;
  status: StaffBookingStatus;
  patientUserId: string | null;
  patientName: string;
  phone: string;
  email: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitType: "first" | "followup";
  needReceipt: string;
  medicationPickup: string;
  failureReason: string | null;
  notes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  lastRescheduledAt: string | null;
  rescheduleCount: number;
  createdAt: string;
  updatedAt: string;
  canStaffCancel: boolean;
  canStaffReschedule: boolean;
};

type StaffBookingDetail = StaffBookingListItem & {
  googleEventId: string | null;
  calendarId: string | null;
  idCard: string | null;
  dob: string | null;
  gender: string | null;
  allergies: string | null;
  medications: string | null;
  symptoms: string | null;
  referralSource: string | null;
  bookingPayload: Record<string, unknown> | null;
  manageUrl: string;
  manageRescheduleUrl: string;
  manageCancelUrl: string;
  clinicWhatsappPhone: string | null;
};

type StaffBookingListStats = {
  total: number;
  today: number;
  upcoming: number;
  attention: number;
  rescheduled: number;
};

type FiltersState = {
  q: string;
  status: string;
  doctorId: string;
  clinicId: string;
  source: string;
  dateFrom: string;
  dateTo: string;
};

type NoticeState = {
  tone: "success" | "warning" | "error";
  text: string;
} | null;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部狀態" },
  { value: "pending", label: "待確認" },
  { value: "confirmed", label: "已確認" },
  { value: "cancelled", label: "已取消" },
  { value: "failed", label: "失敗" },
];

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部來源" },
  { value: "staff_console", label: "姑娘代約" },
  { value: "booking_whatsapp", label: "WhatsApp 表單" },
  { value: "chat_v2", label: "養生bot" },
  { value: "chat_v2_b_mode", label: "養生bot B mode" },
  { value: "widget_v1", label: "客服 Widget" },
];

const STATUS_STYLES: Record<StaffBookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 border-emerald-200",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
  failed: "bg-rose-100 text-rose-900 border-rose-200",
};

const SOURCE_LABELS: Record<string, string> = {
  staff_console: "姑娘代約",
  booking_whatsapp: "WhatsApp 表單",
  chat_v2: "養生bot",
  chat_v2_b_mode: "養生bot B mode",
  widget_v1: "客服 Widget",
};

const VISIT_TYPE_LABELS: Record<"first" | "followup", string> = {
  first: "初診",
  followup: "覆診",
};

const RECEIPT_LABELS: Record<string, string> = {
  no: "不需要",
  yes_insurance: "要保險收據",
  yes_not_insurance: "要普通收據",
};

const GENDER_LABELS: Record<string, string> = {
  male: "男",
  female: "女",
  other: "其他",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, days: number) {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sourceLabel(value: string) {
  return SOURCE_LABELS[value] || value;
}

function statusLabel(value: StaffBookingStatus) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
}

function bookingPickupLabel(value: string) {
  return BOOKING_PICKUP_LABELS[value as keyof typeof BOOKING_PICKUP_LABELS] || value || "--";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBookingDateTime(date: string, time: string) {
  return `${formatDate(date)} ${time}`;
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  accentClass,
  monoClassName,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  accentClass: string;
  monoClassName: string;
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/85 p-4 shadow-[0_12px_40px_rgba(8,145,178,0.08)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</p>
          <p className={`mt-3 text-3xl font-semibold text-slate-900 ${monoClassName}`}>{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accentClass}`}>
          {icon}
        </div>
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</dt>
      <dd className={`max-w-[70%] text-right text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function DrawerShell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="關閉營運台詳情"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col border-l border-cyan-100 bg-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        {children}
      </aside>
    </div>
  );
}

export function StaffOperationsConsole({
  sansClassName,
  monoClassName,
}: {
  sansClassName: string;
  monoClassName: string;
}) {
  const [filters, setFilters] = useState<FiltersState>({
    q: "",
    status: "all",
    doctorId: "",
    clinicId: "",
    source: "all",
    dateFrom: todayStr(),
    dateTo: "",
  });
  const deferredQuery = useDeferredValue(filters.q.trim());

  const [bookings, setBookings] = useState<StaffBookingListItem[]>([]);
  const [stats, setStats] = useState<StaffBookingListStats>({
    total: 0,
    today: 0,
    upcoming: 0,
    attention: 0,
    rescheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<StaffBookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"cancel" | "reschedule" | null>(null);

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleClinicId, setRescheduleClinicId] = useState("");

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      q: deferredQuery,
    }),
    [deferredQuery, filters],
  );

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (effectiveFilters.q) params.set("q", effectiveFilters.q);
      if (effectiveFilters.status && effectiveFilters.status !== "all") params.set("status", effectiveFilters.status);
      if (effectiveFilters.doctorId) params.set("doctorId", effectiveFilters.doctorId);
      if (effectiveFilters.clinicId) params.set("clinicId", effectiveFilters.clinicId);
      if (effectiveFilters.source && effectiveFilters.source !== "all") params.set("source", effectiveFilters.source);
      if (effectiveFilters.dateFrom) params.set("dateFrom", effectiveFilters.dateFrom);
      if (effectiveFilters.dateTo) params.set("dateTo", effectiveFilters.dateTo);
      params.set("limit", "120");

      const response = await fetch(`/api/doctor/operations/bookings?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setBookings(Array.isArray(payload.items) ? payload.items : []);
      setStats(payload.stats || {
        total: 0,
        today: 0,
        upcoming: 0,
        attention: 0,
        rescheduled: 0,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "載入營運台資料失敗");
      setBookings([]);
      setStats({
        total: 0,
        today: 0,
        upcoming: 0,
        attention: 0,
        rescheduled: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveFilters]);

  const loadBookingDetail = useCallback(async (bookingId: string) => {
    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(`/api/doctor/operations/bookings/${encodeURIComponent(bookingId)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setSelectedBooking(payload.booking || null);
    } catch (nextError) {
      setDetailError(nextError instanceof Error ? nextError.message : "載入預約詳情失敗");
      setSelectedBooking(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    if (!selectedBookingId) return;
    void loadBookingDetail(selectedBookingId);
  }, [loadBookingDetail, selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedBookingId(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedBookingId]);

  useEffect(() => {
    if (!selectedBooking) return;
    setRescheduleDate(selectedBooking.appointmentDate);
    setRescheduleTime(selectedBooking.appointmentTime);
    setRescheduleClinicId(selectedBooking.clinicId);
  }, [selectedBooking]);

  async function handleCopy(value: string, successText: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ tone: "success", text: successText });
    } catch {
      setNotice({ tone: "error", text: "未能複製到剪貼簿。" });
    }
  }

  async function handleRefresh() {
    await loadBookings();
    if (selectedBookingId) {
      await loadBookingDetail(selectedBookingId);
    }
    setNotice({ tone: "success", text: "營運台已重新整理。" });
  }

  async function handleCancelBooking() {
    if (!selectedBooking) return;
    const confirmed = window.confirm(`確認取消 ${selectedBooking.patientName} 這個預約？`);
    if (!confirmed) return;

    setActionLoading("cancel");
    setDetailError(null);

    try {
      const response = await fetch(
        `/api/doctor/operations/bookings/${encodeURIComponent(selectedBooking.id)}/cancel`,
        { method: "POST" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setSelectedBooking(payload.booking || null);
      await loadBookings();
      setNotice({
        tone: payload.warnings?.length ? "warning" : "success",
        text: payload.warnings?.length
          ? `預約已取消。${payload.warnings.join("；")}`
          : "預約已取消，系統資料已同步。",
      });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "取消預約失敗";
      setDetailError(message);
      setNotice({ tone: "error", text: message });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRescheduleBooking() {
    if (!selectedBooking) return;
    if (!rescheduleDate || !rescheduleTime) {
      setDetailError("請先選擇新日期及時間。");
      return;
    }

    setActionLoading("reschedule");
    setDetailError(null);

    try {
      const response = await fetch(
        `/api/doctor/operations/bookings/${encodeURIComponent(selectedBooking.id)}/reschedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: rescheduleDate,
            time: rescheduleTime,
            clinicId: rescheduleClinicId || undefined,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setSelectedBooking(payload.booking || null);
      await loadBookings();
      setNotice({
        tone: payload.warnings?.length ? "warning" : "success",
        text: payload.warnings?.length
          ? `預約已改期。${payload.warnings.join("；")}`
          : "預約已改期，病人通知已按系統流程處理。",
      });
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "改期失敗";
      setDetailError(message);
      setNotice({ tone: "error", text: message });
    } finally {
      setActionLoading(null);
    }
  }

  function applyPreset(mode: "today" | "week" | "pending" | "default") {
    const today = todayStr();

    if (mode === "today") {
      setFilters((previous) => ({
        ...previous,
        status: "all",
        dateFrom: today,
        dateTo: today,
      }));
      return;
    }

    if (mode === "week") {
      setFilters((previous) => ({
        ...previous,
        status: "all",
        dateFrom: today,
        dateTo: addDays(today, 6),
      }));
      return;
    }

    if (mode === "pending") {
      setFilters((previous) => ({
        ...previous,
        status: "pending",
        dateFrom: today,
        dateTo: "",
      }));
      return;
    }

    setFilters({
      q: "",
      status: "all",
      doctorId: "",
      clinicId: "",
      source: "all",
      dateFrom: today,
      dateTo: "",
    });
  }

  const selectedBookingHeading = selectedBooking
    ? `${selectedBooking.patientName} · ${formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}`
    : "預約詳情";

  return (
    <div className={`${sansClassName} space-y-6 text-slate-900`}>
      <section className="relative overflow-hidden rounded-[32px] border border-cyan-100 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_40%),linear-gradient(135deg,_rgba(236,254,255,0.98),_rgba(240,253,250,0.96))] p-5 shadow-[0_24px_80px_rgba(8,145,178,0.12)] sm:p-7">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(8,145,178,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,145,178,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-40" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Staff Ops Console
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">姑娘營運台</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                用 structured booking data 管預約，不再靠姑娘自己入 Google Calendar 搵資料。呢度集中做列表、搜尋、改期、取消，同病人自助管理連結。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/nurse/booking"
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white/85 px-4 py-3 text-sm font-semibold text-cyan-900 transition hover:border-cyan-300 hover:bg-white"
            >
              前往姑娘代約
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <RefreshCcw className="h-4 w-4" />
              重新整理
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notice.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="今日預約"
          value={stats.today}
          description="當日即場要處理的 booking。"
          icon={<CalendarDays className="h-5 w-5 text-cyan-900" />}
          accentClass="bg-cyan-100 text-cyan-900"
          monoClassName={monoClassName}
        />
        <StatCard
          title="未來已確認"
          value={stats.upcoming}
          description="已經落到行事曆的 upcoming 預約。"
          icon={<CalendarClock className="h-5 w-5 text-emerald-900" />}
          accentClass="bg-emerald-100 text-emerald-900"
          monoClassName={monoClassName}
        />
        <StatCard
          title="待處理"
          value={stats.attention}
          description="失敗、待確認，或已改期多次的項目。"
          icon={<Siren className="h-5 w-5 text-amber-900" />}
          accentClass="bg-amber-100 text-amber-900"
          monoClassName={monoClassName}
        />
        <StatCard
          title="曾改期"
          value={stats.rescheduled}
          description="今次篩選結果中曾經改過期的 booking。"
          icon={<Stethoscope className="h-5 w-5 text-slate-900" />}
          accentClass="bg-slate-200 text-slate-900"
          monoClassName={monoClassName}
        />
      </div>

      <section className="rounded-[28px] border border-cyan-100 bg-white/90 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-900"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => applyPreset("week")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-900"
            >
              未來 7 日
            </button>
            <button
              type="button"
              onClick={() => applyPreset("pending")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-900"
            >
              待確認
            </button>
            <button
              type="button"
              onClick={() => applyPreset("default")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-900"
            >
              重設
            </button>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.q}
                onChange={(event) => setFilters((previous) => ({ ...previous, q: event.target.value }))}
                placeholder="搜尋病人、電話、電郵、booking id"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <select
              value={filters.status}
              onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.doctorId}
              onChange={(event) => setFilters((previous) => ({ ...previous, doctorId: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">全部醫師</option>
              {DOCTORS.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.nameZh}
                </option>
              ))}
            </select>

            <select
              value={filters.clinicId}
              onChange={(event) => setFilters((previous) => ({ ...previous, clinicId: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">全部診所</option>
              {CLINICS.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.nameZh}
                </option>
              ))}
            </select>

            <select
              value={filters.source}
              onChange={(event) => setFilters((previous) => ({ ...previous, source: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((previous) => ({ ...previous, dateFrom: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto]">
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((previous) => ({ ...previous, dateTo: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            />
            <div className="rounded-2xl border border-dashed border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900">
              現時結果：<span className={`font-semibold ${monoClassName}`}>{stats.total}</span> 筆。點列表任何一行即可開詳情 drawer。
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-cyan-100 bg-white/92 shadow-[0_18px_48px_rgba(15,23,42,0.07)]">
        <div className="border-b border-cyan-50 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">預約列表</h2>
              <p className="mt-1 text-sm text-slate-600">
                以 booking object 為主，不再逐個 calendar event 打開處理。
              </p>
            </div>
            <div className={`rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white ${monoClassName}`}>
              {stats.total} items
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            正在載入姑娘營運台...
          </div>
        ) : error ? (
          <div className="px-6 py-12">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {error}
            </div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <UserRound className="h-5 w-5 text-slate-400" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">呢個篩選暫時無 booking</p>
            <p className="mt-2 text-sm text-slate-500">你可以放寬日期、狀態，或者直接去姑娘代約頁建立新預約。</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-slate-500">
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold">病人</th>
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold">時段</th>
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold">醫師 / 診所</th>
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold">來源</th>
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold">標記</th>
                    <th className="border-b border-slate-200 px-5 py-3 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-cyan-50/70"
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-slate-900">{booking.patientName}</p>
                        <p className="mt-1 text-xs text-slate-500">{booking.phone}</p>
                        <p className="mt-1 text-xs text-slate-400">{booking.email || "未有電郵"}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-slate-900">{formatBookingDateTime(booking.appointmentDate, booking.appointmentTime)}</p>
                        <p className="mt-1 text-xs text-slate-500">{booking.durationMinutes} 分鐘</p>
                        {booking.rescheduleCount > 0 ? (
                          <p className="mt-1 text-xs text-amber-700">已改期 {booking.rescheduleCount} 次</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-slate-900">{booking.doctorNameZh}</p>
                        <p className="mt-1 text-xs text-slate-500">{booking.clinicNameZh}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <Pill className="border-cyan-200 bg-cyan-50 text-cyan-800">{sourceLabel(booking.source)}</Pill>
                      </td>
                      <td className="space-y-2 px-5 py-4 align-top">
                        <div>
                          <Pill className={STATUS_STYLES[booking.status]}>{statusLabel(booking.status)}</Pill>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill className="border-slate-200 bg-slate-100 text-slate-700">{VISIT_TYPE_LABELS[booking.visitType]}</Pill>
                          {booking.needReceipt !== "no" ? (
                            <Pill className="border-emerald-200 bg-emerald-50 text-emerald-800">收據</Pill>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <span className="text-xs font-semibold text-cyan-700">打開詳情</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 xl:hidden">
              {bookings.map((booking) => (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedBookingId(booking.id)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-cyan-200 hover:bg-cyan-50/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{booking.patientName}</p>
                      <p className="mt-1 text-xs text-slate-500">{booking.phone}</p>
                    </div>
                    <Pill className={STATUS_STYLES[booking.status]}>{statusLabel(booking.status)}</Pill>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>{formatBookingDateTime(booking.appointmentDate, booking.appointmentTime)}</p>
                    <p>{booking.doctorNameZh} · {booking.clinicNameZh}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill className="border-cyan-200 bg-cyan-50 text-cyan-800">{sourceLabel(booking.source)}</Pill>
                    {booking.rescheduleCount > 0 ? (
                      <Pill className="border-amber-200 bg-amber-50 text-amber-800">改期 {booking.rescheduleCount} 次</Pill>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <DrawerShell open={Boolean(selectedBookingId)} onClose={() => setSelectedBookingId(null)}>
        <div className="flex items-center justify-between border-b border-cyan-100 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Booking Detail</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">{selectedBookingHeading}</h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBookingId(null)}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {detailLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              載入預約詳情中...
            </div>
          ) : detailError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {detailError}
            </div>
          ) : !selectedBooking ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              找不到預約詳情。
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-[28px] border border-cyan-100 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(236,254,255,0.88))] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Pill className={STATUS_STYLES[selectedBooking.status]}>{statusLabel(selectedBooking.status)}</Pill>
                      <Pill className="border-cyan-200 bg-cyan-50 text-cyan-800">{sourceLabel(selectedBooking.source)}</Pill>
                      <Pill className="border-slate-200 bg-white text-slate-700">{VISIT_TYPE_LABELS[selectedBooking.visitType]}</Pill>
                    </div>
                    <h4 className="mt-4 text-2xl font-semibold text-slate-950">{selectedBooking.patientName}</h4>
                    <p className={`mt-2 text-sm text-slate-600 ${monoClassName}`}>{formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.canStaffReschedule ? (
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => void handleRescheduleBooking()}
                        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === "reschedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                        改期
                      </button>
                    ) : null}
                    {selectedBooking.canStaffCancel ? (
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => void handleCancelBooking()}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                        取消
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedBooking.failureReason ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    失敗原因：{selectedBooking.failureReason}
                  </div>
                ) : null}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">核心資料</h5>
                  <dl className="mt-3">
                    <DetailRow label="病人" value={selectedBooking.patientName} />
                    <DetailRow label="電話" value={selectedBooking.phone} mono />
                    <DetailRow label="電郵" value={selectedBooking.email || "--"} />
                    <DetailRow label="醫師" value={selectedBooking.doctorNameZh} />
                    <DetailRow label="診所" value={selectedBooking.clinicNameZh} />
                    <DetailRow label="時段" value={`${selectedBooking.appointmentDate} ${selectedBooking.appointmentTime}`} mono />
                    <DetailRow label="時長" value={`${selectedBooking.durationMinutes} 分鐘`} />
                  </dl>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">營運標記</h5>
                  <dl className="mt-3">
                    <DetailRow label="來源" value={sourceLabel(selectedBooking.source)} />
                    <DetailRow label="收據" value={RECEIPT_LABELS[selectedBooking.needReceipt] || selectedBooking.needReceipt} />
                    <DetailRow label="取藥" value={bookingPickupLabel(selectedBooking.medicationPickup)} />
                    <DetailRow label="改期次數" value={selectedBooking.rescheduleCount} mono />
                    <DetailRow label="已確認" value={formatDateTime(selectedBooking.confirmedAt)} />
                    <DetailRow label="上次改期" value={formatDateTime(selectedBooking.lastRescheduledAt)} />
                    <DetailRow label="已取消" value={formatDateTime(selectedBooking.cancelledAt)} />
                  </dl>
                </div>
              </section>

              <section className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-800">病人自助連結</h5>
                    <p className="mt-1 text-sm text-cyan-900/80">姑娘可直接 copy 俾病人，做查詢、改期或取消。</p>
                  </div>
                  {selectedBooking.patientUserId ? (
                    <Link
                      href={`/doctor/patients/${selectedBooking.patientUserId}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-3 py-2 text-sm font-semibold text-cyan-900 transition hover:border-cyan-300"
                    >
                      打開病人檔案
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void handleCopy(selectedBooking.manageUrl, "管理連結已複製。")}
                    className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left text-sm font-semibold text-cyan-900 transition hover:border-cyan-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>總管理連結</span>
                      <ClipboardCopy className="h-4 w-4" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(selectedBooking.manageRescheduleUrl, "改期連結已複製。")}
                    className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left text-sm font-semibold text-cyan-900 transition hover:border-cyan-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>改期連結</span>
                      <ClipboardCopy className="h-4 w-4" />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(selectedBooking.manageCancelUrl, "取消連結已複製。")}
                    className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-left text-sm font-semibold text-cyan-900 transition hover:border-cyan-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>取消連結</span>
                      <ClipboardCopy className="h-4 w-4" />
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4">
                <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">改期操作</h5>
                <p className="mt-2 text-sm text-slate-600">第一版支援同一位醫師改日期 / 時間，並可切換診所。</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(event) => setRescheduleTime(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                  <select
                    value={rescheduleClinicId}
                    onChange={(event) => setRescheduleClinicId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  >
                    {CLINICS.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.nameZh}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 text-xs leading-6 text-slate-500">
                  系統會直接同步 Google Calendar、booking 記錄，並按現有通知流程嘗試發 WhatsApp。
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">病人補充資料</h5>
                  <dl className="mt-3">
                    <DetailRow label="身份證" value={selectedBooking.idCard || "--"} mono />
                    <DetailRow label="生日" value={selectedBooking.dob || "--"} />
                    <DetailRow label="性別" value={selectedBooking.gender ? (GENDER_LABELS[selectedBooking.gender] || selectedBooking.gender) : "--"} />
                    <DetailRow label="轉介來源" value={selectedBooking.referralSource || "--"} />
                  </dl>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">系統識別</h5>
                  <dl className="mt-3">
                    <DetailRow label="Booking ID" value={selectedBooking.id} mono />
                    <DetailRow label="Google Event" value={selectedBooking.googleEventId || "--"} mono />
                    <DetailRow label="Calendar ID" value={selectedBooking.calendarId || "--"} mono />
                    <DetailRow label="建立時間" value={formatDateTime(selectedBooking.createdAt)} />
                    <DetailRow label="最後更新" value={formatDateTime(selectedBooking.updatedAt)} />
                  </dl>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">症狀 / 過敏 / 用藥</h5>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900">症狀</p>
                      <p className="mt-1 whitespace-pre-wrap">{selectedBooking.symptoms || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">過敏</p>
                      <p className="mt-1 whitespace-pre-wrap">{selectedBooking.allergies || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">現有用藥</p>
                      <p className="mt-1 whitespace-pre-wrap">{selectedBooking.medications || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <h5 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">姑娘備註</h5>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-900">附註</p>
                      <p className="mt-1 whitespace-pre-wrap">{selectedBooking.notes || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">病人自助管理</p>
                      <p className="mt-1">{selectedBooking.clinicWhatsappPhone || "—"}</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </DrawerShell>
    </div>
  );
}
