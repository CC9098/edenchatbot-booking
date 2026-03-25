'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Ticket,
} from 'lucide-react';

import { CLINIC_BY_ID, isClinicId, type ClinicId } from '@/shared/clinic-data';

type ManageAction = 'reschedule' | 'cancel';

type VerifiedBooking = {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  patientName: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitType: 'first' | 'followup';
  clinicWhatsappUrl: string | null;
  canSelfManage: boolean;
  message: string;
  manageToken?: string;
};

type ActionResult = {
  message: string;
  booking: {
    bookingId: string;
    doctorId: string;
    doctorNameZh: string;
    clinicId: string;
    clinicNameZh: string;
    appointmentDate: string;
    appointmentTime: string;
    clinicWhatsappUrl: string | null;
  };
};

type ManageBookingFlowProps = {
  action: ManageAction | null;
  manageAccessToken?: string | null;
};

const HK_DATE_LABEL = new Intl.DateTimeFormat('zh-HK', {
  timeZone: 'Asia/Hong_Kong',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const MAX_RESCHEDULE_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const UNAVAILABLE_DOT_CLASS_NAME = 'bg-slate-300';
const DEFAULT_CLINIC_AVAILABILITY_STYLE = {
  dotClassName: 'bg-primary',
  badgeClassName: 'border-primary/15 bg-primary-light text-primary',
};
const CLINIC_AVAILABILITY_STYLES: Record<
  ClinicId,
  {
    dotClassName: string;
    badgeClassName: string;
  }
> = {
  central: {
    dotClassName: 'bg-sky-500',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  jordan: {
    dotClassName: 'bg-emerald-500',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  tsuenwan: {
    dotClassName: 'bg-amber-500',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  online: {
    dotClassName: 'bg-rose-500',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-800',
  },
};

type DayAvailabilityState = 'available' | 'unavailable' | 'unknown';
type MonthAvailabilityMap = Record<string, DayAvailabilityState>;
type AvailabilityRequestResult = {
  slots: string[];
  isClosedDay: boolean;
  status: DayAvailabilityState;
  errorMessage?: string;
  calendarUnavailable?: boolean;
};

function getActionLabel(action: ManageAction | null) {
  if (!action) return '管理預約';
  return action === 'reschedule' ? '更改預約' : '取消預約';
}

function toIsoDateInHongKong(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayIsoInHongKong() {
  return toIsoDateInHongKong(new Date());
}

function getMaxDateIsoInHongKong(daysAhead: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toIsoDateInHongKong(date);
}

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function toMonthKeyInHongKong(date: Date): string {
  return toIsoDateInHongKong(date).slice(0, 7);
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;

  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + deltaMonths, 1));
  return `${shifted.getUTCFullYear()}-${padTwo(shifted.getUTCMonth() + 1)}`;
}

function getDaysInMonth(monthKey: string): number {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return 30;

  return new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
}

function isoDateFromMonthDay(monthKey: string, day: number): string {
  return `${monthKey}-${padTwo(day)}`;
}

function getWeekdayIndexMondayFirst(dateIso: string): number {
  const [yearStr, monthStr, dayStr] = dateIso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return 0;

  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

function formatMonthLabel(monthKey: string): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function monthHasSelectableDate(monthKey: string, minDate: string, maxDate: string): boolean {
  const daysInMonth = getDaysInMonth(monthKey);
  const firstDate = isoDateFromMonthDay(monthKey, 1);
  const lastDate = isoDateFromMonthDay(monthKey, daysInMonth);
  return !(lastDate < minDate || firstDate > maxDate);
}

function formatDateForDisplay(dateIso: string): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG_TIMEZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function getClinicAvailabilityStyle(clinicId: string) {
  return isClinicId(clinicId)
    ? CLINIC_AVAILABILITY_STYLES[clinicId]
    : DEFAULT_CLINIC_AVAILABILITY_STYLE;
}

async function requestAvailabilityForBooking(
  booking: Pick<VerifiedBooking, 'doctorId' | 'clinicId' | 'durationMinutes'>,
  date: string,
): Promise<AvailabilityRequestResult> {
  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: booking.doctorId,
        clinicId: booking.clinicId,
        date,
        durationMinutes: booking.durationMinutes,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      if (data?.errorCode === 'CALENDAR_UNAVAILABLE') {
        return {
          slots: [],
          isClosedDay: false,
          status: 'unknown',
          calendarUnavailable: true,
          errorMessage: '暫時未能讀取預約日曆，請稍後再試。',
        };
      }

      return {
        slots: [],
        isClosedDay: false,
        status: 'unknown',
        errorMessage: data?.error || '暫時未能讀取可預約時段。',
      };
    }

    const slots = Array.isArray(data?.slots) ? data.slots : [];
    const isClosedDay = Boolean(data?.isClosed || data?.isHoliday);

    return {
      slots,
      isClosedDay,
      status: !isClosedDay && slots.length > 0 ? 'available' : 'unavailable',
    };
  } catch {
    return {
      slots: [],
      isClosedDay: false,
      status: 'unknown',
      errorMessage: '載入可預約時段時發生錯誤。',
    };
  }
}

function formatBookingDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00+08:00`);
  const dateLabel = HK_DATE_LABEL.format(value);
  return `${dateLabel} ${time}`;
}

function visitTypeLabel(value: VerifiedBooking['visitType']) {
  return value === 'followup' ? '覆診' : '初診';
}

function FeedbackBanner({
  type,
  text,
}: {
  type: 'error' | 'success' | 'info';
  text: string;
}) {
  const styles =
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-primary/15 bg-primary-light text-primary';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {text}
    </div>
  );
}

function BookingSummaryCard({
  booking,
  selected,
  onSelect,
}: {
  booking: VerifiedBooking;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !booking.canSelfManage;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-full overflow-hidden rounded-[24px] border p-4 text-left transition sm:p-5 ${
        disabled
          ? 'cursor-not-allowed border-amber-200 bg-amber-50/90 text-amber-900'
          : selected
            ? 'border-primary bg-white shadow-[0_18px_40px_rgba(53,96,32,0.12)]'
            : 'border-primary/10 bg-white hover:border-primary/30 hover:shadow-[0_16px_32px_rgba(53,96,32,0.08)]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
            {visitTypeLabel(booking.visitType)}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">{booking.doctorNameZh}</h3>
          <p className="mt-1 truncate text-sm text-slate-600">{booking.clinicNameZh}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">病人：{booking.patientName}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            disabled ? 'bg-amber-100 text-amber-800' : 'bg-primary-light text-primary'
          }`}
        >
          {disabled ? '需姑娘協助' : selected ? '已選擇' : '可自助處理'}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{formatBookingDateTime(booking.appointmentDate, booking.appointmentTime)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="truncate">預約編號：{booking.bookingId}</span>
        </div>
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${disabled ? 'text-amber-800' : 'text-slate-500'}`}>
        {booking.message}
      </p>
    </button>
  );
}

export function ManageBookingFlow({ action, manageAccessToken }: ManageBookingFlowProps) {
  const [phone, setPhone] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [requestingLink, setRequestingLink] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [requestSucceeded, setRequestSucceeded] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [bookings, setBookings] = useState<VerifiedBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState('');
  const [supportWhatsappUrl, setSupportWhatsappUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKeyInHongKong(new Date()));
  const [monthAvailability, setMonthAvailability] = useState<MonthAvailabilityMap>({});
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false);
  const [bookableDatesError, setBookableDatesError] = useState('');
  const minDate = getTodayIsoInHongKong();
  const maxDate = getMaxDateIsoInHongKong(MAX_RESCHEDULE_WINDOW_DAYS);

  const selectedBooking = bookings.find((booking) => booking.bookingId === selectedBookingId) || null;
  const calendarMonthLabel = formatMonthLabel(calendarMonthKey);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate);
  const selectedClinicStyle = getClinicAvailabilityStyle(selectedBooking?.clinicId || '');
  const selectedClinicProfile =
    selectedBooking && isClinicId(selectedBooking.clinicId) ? CLINIC_BY_ID[selectedBooking.clinicId] : null;
  const calendarCells = Array.from(
    {
      length:
        Math.ceil(
          (getWeekdayIndexMondayFirst(isoDateFromMonthDay(calendarMonthKey, 1)) +
            getDaysInMonth(calendarMonthKey)) /
            7,
        ) * 7,
    },
    (_, index) => {
      const leadingEmptyCellCount = getWeekdayIndexMondayFirst(isoDateFromMonthDay(calendarMonthKey, 1));
      const day = index - leadingEmptyCellCount + 1;
      const daysInMonth = getDaysInMonth(calendarMonthKey);

      if (day < 1 || day > daysInMonth) return null;

      const dateIso = isoDateFromMonthDay(calendarMonthKey, day);
      const availability = monthAvailability[dateIso];
      const isSelected = selectedDate === dateIso;

      return {
        dateIso,
        day,
        isSelected,
        isSelectable: dateIso >= minDate && dateIso <= maxDate,
        availability,
        availabilityLabel:
          availability === 'available'
            ? `${selectedBooking?.clinicNameZh || '診所'}有位`
            : availability === 'unavailable'
              ? `${selectedBooking?.clinicNameZh || '診所'}暫滿`
              : '正在掃描 availability',
      };
    },
  );

  // Auto-verify manage access token from WhatsApp link (zero-OTP path)
  useEffect(() => {
    if (!manageAccessToken) return;

    let cancelled = false;
    setTokenVerifying(true);
    setFeedback(null);

    (async () => {
      try {
        const response = await fetch('/api/widget-booking/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: manageAccessToken }),
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setFeedback({ type: 'error', text: data.error || '管理連結已失效，請使用電話驗證。' });
          return;
        }

        const nextBookings = Array.isArray(data.bookings) ? (data.bookings as VerifiedBooking[]) : [];
        setBookings(nextBookings);
        setSelectedBookingId(nextBookings.length === 1 ? nextBookings[0].bookingId : '');
        setMaskedPhone(data.maskedPhone || '');
        setTokenVerified(true);
        setRequestSucceeded(true);
        setFeedback({ type: 'success', text: data.message || '已驗證，請繼續管理你的預約。' });
      } catch {
        if (!cancelled) {
          setFeedback({ type: 'error', text: '驗證管理連結時發生錯誤，請使用電話驗證。' });
        }
      } finally {
        if (!cancelled) {
          setTokenVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manageAccessToken]);

  useEffect(() => {
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotError('');
    setResult(null);
    setCalendarMonthKey(toMonthKeyInHongKong(new Date()));
    setMonthAvailability({});
    setBookableDatesLoading(false);
    setBookableDatesError('');
  }, [selectedBookingId, action]);

  useEffect(() => {
    if (action !== 'reschedule' || !selectedBooking || !selectedBooking.canSelfManage) {
      setMonthAvailability({});
      setBookableDatesLoading(false);
      setBookableDatesError('');
      return;
    }

    const daysInMonth = getDaysInMonth(calendarMonthKey);
    const datesToScan: string[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateIso = isoDateFromMonthDay(calendarMonthKey, day);
      if (dateIso >= minDate && dateIso <= maxDate) {
        datesToScan.push(dateIso);
      }
    }

    setMonthAvailability({});
    setBookableDatesError('');

    if (datesToScan.length === 0) {
      setBookableDatesLoading(false);
      return;
    }

    let cancelled = false;
    setBookableDatesLoading(true);

    const scanMonthAvailability = async () => {
      const queue = [...datesToScan];
      const nextAvailability: MonthAvailabilityMap = {};
      let hasPartialRead = false;
      const workerCount = Math.min(6, queue.length);

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (queue.length > 0 && !cancelled) {
            const nextDate = queue.shift();
            if (!nextDate) break;

            const result = await requestAvailabilityForBooking(selectedBooking, nextDate);
            nextAvailability[nextDate] = result.status;

            if (result.status === 'unknown' || result.calendarUnavailable) {
              hasPartialRead = true;
            }
          }
        }),
      );

      if (cancelled) return;

      setMonthAvailability(nextAvailability);
      setBookableDatesLoading(false);
      setBookableDatesError(
        hasPartialRead ? '暫時未能完整讀取預約日曆，灰色日期可能仍在更新。' : '',
      );
    };

    void scanMonthAvailability();

    return () => {
      cancelled = true;
    };
  }, [action, calendarMonthKey, maxDate, minDate, selectedBooking]);

  async function requestMagicLink() {
    if (!phone.trim()) {
      setFeedback({ type: 'error', text: '請輸入預約時使用的 WhatsApp 電話號碼。' });
      return;
    }

    setRequestingLink(true);
    setRequestSucceeded(false);
    setFeedback(null);
    setSupportWhatsappUrl(null);
    setMaskedPhone('');
    setBookings([]);
    setSelectedBookingId('');
    setResult(null);

    try {
      const response = await fetch('/api/widget-booking/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, action: action || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || '暫時未能發送登入連結。' });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || null);
        return;
      }

      setMaskedPhone(data.maskedPhone || '');
      setRequestSucceeded(true);
      setFeedback({ type: 'success', text: data.message || '登入連結已發送。' });
    } catch {
      setFeedback({ type: 'error', text: '發送登入連結時發生錯誤，請稍後再試。' });
    } finally {
      setRequestingLink(false);
    }
  }

  async function handleRequestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestMagicLink();
  }

  async function loadSlots(date: string) {
    if (!selectedBooking) return;

    setSelectedDate(date);
    setSelectedTime('');
    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setFeedback(null);

    try {
      const result = await requestAvailabilityForBooking(selectedBooking, date);
      setMonthAvailability((previous) => ({
        ...previous,
        [date]: result.status,
      }));

      if (result.status === 'unknown') {
        setSlotError(result.errorMessage || '暫時未能讀取可預約時段。');
        return;
      }

      if (result.slots.length > 0) {
        setAvailableSlots(result.slots);
        return;
      }

      if (result.isClosedDay) {
        setSlotError('該日未有門診時段可供更改。');
        return;
      }

      setSlotError('該日暫時未有可更改時段。');
    } catch {
      setSlotError('載入時段時發生錯誤，請稍後再試。');
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!selectedBooking?.manageToken) {
      setFeedback({ type: 'error', text: '管理憑證已失效，請重新驗證。' });
      return;
    }

    if (action === 'reschedule' && (!selectedDate || !selectedTime)) {
      setFeedback({ type: 'error', text: '請先選擇新的日期和時段。' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    setSupportWhatsappUrl(selectedBooking.clinicWhatsappUrl || null);

    try {
      const response = await fetch(
        action === 'reschedule' ? '/api/widget-booking/reschedule' : '/api/widget-booking/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'reschedule'
              ? { manageToken: selectedBooking.manageToken, date: selectedDate, time: selectedTime }
              : { manageToken: selectedBooking.manageToken },
          ),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || `${getActionLabel(action)}失敗，請稍後再試。` });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || selectedBooking.clinicWhatsappUrl || null);
        return;
      }

      setResult(data as ActionResult);
      setFeedback({ type: 'success', text: data.message || `${getActionLabel(action)}成功。` });
      setSupportWhatsappUrl(null);
    } catch {
      setFeedback({ type: 'error', text: `${getActionLabel(action)}時發生錯誤，請稍後再試。` });
    } finally {
      setActionLoading(false);
    }
  }

  function buildActionHref(nextAction: ManageAction) {
    const params = new URLSearchParams({ action: nextAction });
    if (manageAccessToken) {
      params.set('token', manageAccessToken);
    }
    return `/manage-booking?${params.toString()}`;
  }

  return (
    <div className="patient-card mx-auto max-w-5xl overflow-hidden p-5 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">
            {getActionLabel(action)}
          </h1>
          <div className="rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
            步驟：
            {tokenVerified ? ' 1. 已驗證' : ' 1. 驗證電話'}
            {bookings.length > 0 || requestSucceeded ? '  2. 選擇預約' : '  2. 預約卡片'}
            {!action ? '  3. 選擇操作' : action === 'reschedule' ? '  3. 更改預約' : '  3. 取消預約'}
          </div>
        </div>

        {feedback ? <FeedbackBanner type={feedback.type} text={feedback.text} /> : null}

        {tokenVerifying ? (
          <div className="flex items-center justify-center gap-3 rounded-[24px] border border-primary/10 bg-white p-8 shadow-sm sm:p-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-base text-slate-600">正在驗證管理連結⋯</span>
          </div>
        ) : null}

        <section
          className={`grid gap-5 sm:gap-6 ${tokenVerified ? '' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}
          style={tokenVerifying ? { display: 'none' } : undefined}
        >
          {!tokenVerified ? (
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900">WhatsApp 登入連結</h2>

              <div className="mt-4 space-y-5">
                <p className="text-sm leading-relaxed text-slate-600">
                  輸入預約時使用的 WhatsApp 電話號碼，我們會把登入連結發送到你的 WhatsApp。
                </p>

                <form className="space-y-4" onSubmit={handleRequestLink}>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="manage-booking-phone">
                      WhatsApp 電話號碼
                    </label>
                    <input
                      id="manage-booking-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="例如 9123 4567 / +852 9123 4567"
                      className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={requestingLink}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {requestingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : requestSucceeded ? '重新發送登入連結' : '發送登入連結'}
                  </button>
                </form>

                <div className="rounded-2xl border border-primary/10 bg-primary-light/35 p-4 text-sm leading-relaxed text-slate-600">
                  {requestSucceeded
                    ? `登入連結已送往 ${maskedPhone || '你的 WhatsApp'}。請返回 WhatsApp 打開連結，系統會直接帶你回到這頁。`
                    : '你不需要再抄寫驗證碼；只要在 WhatsApp 打開登入連結即可。'}
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">選擇預約</h2>
                {bookings.length > 0 ? (
                  <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                    {bookings.length} 筆
                  </span>
                ) : null}
              </div>

              {bookings.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {bookings.map((booking) => (
                    <BookingSummaryCard
                      key={booking.bookingId}
                      booking={booking}
                      selected={selectedBookingId === booking.bookingId}
                      onSelect={() => setSelectedBookingId(booking.bookingId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm leading-relaxed text-slate-500">
                  {tokenVerified
                    ? '暫時沒有可處理預約。'
                    : requestSucceeded
                      ? '登入連結已發出，請返回 WhatsApp 打開後再回來。'
                      : '完成驗證後顯示在這裡。'}
                </div>
              )}
            </div>

            {selectedBooking && selectedBooking.canSelfManage && !action && !result ? (
              <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900">選擇要處理的操作</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  你已經完成驗證。先選擇預約，再決定要更改時間或取消預約。
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={buildActionHref('reschedule')}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    更改預約
                  </Link>
                  <Link
                    href={buildActionHref('cancel')}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[18px] border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    取消預約
                  </Link>
                </div>
              </div>
            ) : null}

            {selectedBooking && !selectedBooking.canSelfManage ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-amber-900">此預約需由姑娘協助</h3>
                    <p className="text-sm leading-relaxed text-amber-800">{selectedBooking.message}</p>
                    {selectedBooking.clinicWhatsappUrl ? (
                      <a
                        href={selectedBooking.clinicWhatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover sm:w-auto"
                      >
                        WhatsApp 聯絡姑娘
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              null
            )}

            {selectedBooking && selectedBooking.canSelfManage && action === 'reschedule' && !result ? (
              <div className="space-y-5 sm:space-y-6">
                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">新日期</h3>
                      <p className="text-sm leading-relaxed text-slate-500">
                        已改用同新增預約一致的月曆式選擇，方便直接看整月可改期日子。
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-base font-semibold text-slate-900">{calendarMonthLabel}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCalendarMonthKey(previousMonthKey)}
                          disabled={!canGoToPreviousMonth || bookableDatesLoading}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="上一個月"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarMonthKey(nextMonthKey)}
                          disabled={!canGoToNextMonth || bookableDatesLoading}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="下一個月"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                      {WEEKDAY_LABELS.map((weekday) => (
                        <span key={weekday} className="py-1">
                          {weekday}
                        </span>
                      ))}
                    </div>

                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {calendarCells.map((cell, index) => {
                        if (!cell) {
                          return <div key={`empty-${index}`} className="h-12 rounded-lg" aria-hidden="true" />;
                        }

                        return (
                          <button
                            key={cell.dateIso}
                            type="button"
                            onClick={() => void loadSlots(cell.dateIso)}
                            disabled={!cell.isSelectable}
                            aria-label={`${cell.dateIso}，${cell.availabilityLabel}`}
                            className={`h-12 rounded-lg border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                              !cell.isSelectable
                                ? 'cursor-not-allowed border-transparent text-slate-300'
                                : cell.isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : cell.availability === 'available'
                                    ? 'border-slate-200 bg-white text-slate-900 hover:border-primary/40 hover:bg-primary-light/20'
                                    : cell.availability === 'unavailable'
                                      ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cell.day}</span>
                            <span className="mt-1 flex min-h-[8px] items-center justify-center gap-1">
                              {cell.isSelected ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                              ) : cell.availability === 'available' ? (
                                <span className={`h-1.5 w-1.5 rounded-full ${selectedClinicStyle.dotClassName}`} />
                              ) : cell.availability === 'unavailable' ? (
                                <span className={`h-1.5 w-1.5 rounded-full ${UNAVAILABLE_DOT_CLASS_NAME}`} />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${selectedClinicStyle.dotClassName}`} />
                        <span>{selectedClinicProfile?.nameZh || selectedBooking.clinicNameZh}有位</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${UNAVAILABLE_DOT_CLASS_NAME}`} />
                        <span>{selectedClinicProfile?.nameZh || selectedBooking.clinicNameZh}暫滿</span>
                      </span>
                    </div>
                  </div>

                  {bookableDatesLoading ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      正在掃描本月可改期日子...
                    </div>
                  ) : null}

                  {!bookableDatesLoading && bookableDatesError ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {bookableDatesError}
                    </div>
                  ) : null}

                  {selectedDate ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-slate-600">
                        已選日期：<span className="font-semibold text-slate-900">{formatDateForDisplay(selectedDate)}</span>
                      </p>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${selectedClinicStyle.badgeClassName}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${selectedClinicStyle.dotClassName}`} />
                        {selectedBooking.clinicNameZh}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">請先在月曆選擇日期，再查看可更改時段。</p>
                  )}
                </div>

                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-slate-900">新時段</h3>
                  </div>

                  {slotsLoading ? (
                    <div className="mt-6 flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : slotError ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {slotError}
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setSelectedTime(time)}
                          className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                            selectedTime === time
                              ? 'border-primary bg-primary text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                      選擇日期後，這裡會顯示可更改的時段。
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-lg font-semibold text-slate-900">確認</h3>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">目前預約</p>
                      <p className="mt-3 text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                      <p className="mt-3 text-sm text-slate-700">
                        {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/15 bg-primary-light p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">新預約</p>
                      <p className="mt-3 text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                      <p className="mt-3 text-sm text-slate-700">
                        {selectedDate && selectedTime ? formatBookingDateTime(selectedDate, selectedTime) : '請先選擇日期和時段'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleConfirmAction()}
                    disabled={actionLoading || !selectedDate || !selectedTime}
                    className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認更改預約'}
                  </button>
                </div>
              </div>
            ) : null}

            {selectedBooking && selectedBooking.canSelfManage && action === 'cancel' && !result ? (
              <div className="rounded-[24px] border border-red-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900">確認取消預約</h3>
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50/80 p-5">
                  <p className="text-base font-semibold text-slate-900">{selectedBooking.doctorNameZh}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedBooking.clinicNameZh}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime)}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-red-700">
                    取消後，此預約時段會立即釋出。如需重新安排，需要重新預約。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConfirmAction()}
                  disabled={actionLoading}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '確認取消預約'}
                </button>
              </div>
            ) : null}

            {result ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-emerald-900">
                      {action === 'reschedule' ? '已成功更改預約' : '已成功取消預約'}
                    </h3>
                    <p className="text-sm leading-relaxed text-emerald-800">{result.message}</p>
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{result.booking.doctorNameZh}</p>
                      <p className="mt-1">{result.booking.clinicNameZh}</p>
                      {action === 'reschedule' ? (
                        <p className="mt-3">
                          新時間：{formatBookingDateTime(result.booking.appointmentDate, result.booking.appointmentTime)}
                        </p>
                      ) : (
                        <p className="mt-3">
                          已取消時間：{formatBookingDateTime(selectedBooking!.appointmentDate, selectedBooking!.appointmentTime)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/booking-whatsapp"
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
                      >
                        重新預約
                      </Link>
                      <Link
                        href="/manage-booking"
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
                      >
                        返回預約管理
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {supportWhatsappUrl ? (
              <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900">需要人工協助？</h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      如果目前未能自助處理，你可以直接 WhatsApp 聯絡姑娘跟進。
                    </p>
                    <a
                      href={supportWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover sm:w-auto"
                    >
                      WhatsApp 聯絡姑娘
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
