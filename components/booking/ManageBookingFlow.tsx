'use client';

import { bookingFeedback, bookingText, type BookingLocale } from '@/shared/booking-locale';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';

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
  locale?: BookingLocale;
  action: ManageAction | null;
  manageAccessToken?: string | null;
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const MAX_RESCHEDULE_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const UNAVAILABLE_DOT_CLASS_NAME = 'bg-slate-300';
const SUPPORT_CLINIC_IDS: ClinicId[] = ['jordan', 'tsuenwan', 'central'];
const DEFAULT_CLINIC_AVAILABILITY_STYLE = {
  dotClassName: 'bg-primary',
  badgeClassName: 'border-primary/15 bg-primary-light text-primary',
  selectedButtonClassName: 'border-primary/25 bg-primary-light text-primary',
};
const CLINIC_AVAILABILITY_STYLES: Record<
  ClinicId,
  {
    dotClassName: string;
    badgeClassName: string;
    selectedButtonClassName: string;
  }
> = {
  central: {
    dotClassName: 'bg-sky-500',
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-800',
    selectedButtonClassName: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  jordan: {
    dotClassName: 'bg-emerald-500',
    badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    selectedButtonClassName: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  tsuenwan: {
    dotClassName: 'bg-amber-500',
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
    selectedButtonClassName: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  online: {
    dotClassName: 'bg-rose-500',
    badgeClassName: 'border-rose-200 bg-rose-50 text-rose-800',
    selectedButtonClassName: 'border-rose-300 bg-rose-50 text-rose-900',
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

function getActionLabel(action: ManageAction | null, locale: BookingLocale = 'zh') {
  if (!action) return bookingText("管理預約", locale);
  return action === 'reschedule' ? bookingText("更改預約", locale) : bookingText("取消預約", locale);
}

function digitsOnly(value: string, locale: BookingLocale = 'zh') {
  return value.replace(/\D/g, '');
}

function getWhatsappPhoneDigits(clinicId: ClinicId, locale: BookingLocale = 'zh') {
  const whatsappUrl = CLINIC_BY_ID[clinicId]?.whatsappUrl;
  return whatsappUrl ? digitsOnly(whatsappUrl, locale) : '';
}

function buildSupportWhatsappMessage({
  action,
  booking,
  clinicId,
}: {
  action: ManageAction | null;
  booking?: VerifiedBooking | null;
  clinicId: ClinicId;
}, locale: BookingLocale = 'zh') {
  const clinicName = locale === 'en' ? CLINIC_BY_ID[clinicId]?.nameEn : CLINIC_BY_ID[clinicId]?.nameZh || bookingText("診所", locale);
  const lines = [bookingText("你好，我想聯絡{0}診所姑娘協助處理預約。", locale, [clinicName])];

  lines.push(bookingText("需要協助項目：{0}", locale, [getActionLabel(action, locale)]));

  if (booking) {
    lines.push(bookingText("病人姓名：{0}", locale, [booking.patientName]));
    lines.push(bookingText("預約編號：{0}", locale, [booking.bookingId]));
    lines.push(bookingText("醫師：{0}", locale, [bookingText(booking.doctorNameZh, locale)]));
    lines.push(bookingText("原預約診所：{0}", locale, [bookingText(booking.clinicNameZh, locale)]));
    lines.push(
      bookingText("原預約時間：{0}", locale, [formatBookingDateTime(booking.appointmentDate, booking.appointmentTime, locale)]),
    );
  }

  lines.push(bookingText("麻煩姑娘跟進，謝謝。", locale));
  return lines.join('\n');
}

function buildSupportWhatsappHref({
  action,
  booking,
  clinicId,
}: {
  action: ManageAction | null;
  booking?: VerifiedBooking | null;
  clinicId: ClinicId;
}, locale: BookingLocale = 'zh') {
  const phoneDigits = getWhatsappPhoneDigits(clinicId, locale);
  if (!phoneDigits) {
    return null;
  }

  const params = new URLSearchParams({
    phone: phoneDigits,
    text: buildSupportWhatsappMessage({ action, booking, clinicId }, locale),
    type: 'phone_number',
    app_absent: '0',
  });

  return `https://api.whatsapp.com/send/?${params.toString()}`;
}

function toIsoDateInHongKong(date: Date, locale: BookingLocale = 'zh'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayIsoInHongKong(locale: BookingLocale = 'zh') {
  return toIsoDateInHongKong(new Date(), locale);
}

function getMaxDateIsoInHongKong(daysAhead: number, locale: BookingLocale = 'zh') {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toIsoDateInHongKong(date, locale);
}

function padTwo(value: number, locale: BookingLocale = 'zh'): string {
  return String(value).padStart(2, '0');
}

function toMonthKeyInHongKong(date: Date, locale: BookingLocale = 'zh'): string {
  return toIsoDateInHongKong(date, locale).slice(0, 7);
}

function parseMonthKey(monthKey: string, locale: BookingLocale = 'zh'): { year: number; month: number } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function shiftMonthKey(monthKey: string, deltaMonths: number, locale: BookingLocale = 'zh'): string {
  const parsed = parseMonthKey(monthKey, locale);
  if (!parsed) return monthKey;

  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1 + deltaMonths, 1));
  return `${shifted.getUTCFullYear()}-${padTwo(shifted.getUTCMonth() + 1, locale)}`;
}

function getDaysInMonth(monthKey: string, locale: BookingLocale = 'zh'): number {
  const parsed = parseMonthKey(monthKey, locale);
  if (!parsed) return 30;

  return new Date(Date.UTC(parsed.year, parsed.month, 0)).getUTCDate();
}

function isoDateFromMonthDay(monthKey: string, day: number, locale: BookingLocale = 'zh'): string {
  return `${monthKey}-${padTwo(day, locale)}`;
}

function getWeekdayIndexMondayFirst(dateIso: string, locale: BookingLocale = 'zh'): number {
  const [yearStr, monthStr, dayStr] = dateIso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return 0;

  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

function formatMonthLabel(monthKey: string, locale: BookingLocale = 'zh'): string {
  const parsed = parseMonthKey(monthKey, locale);
  if (!parsed) return monthKey;

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  return new Intl.DateTimeFormat((locale === 'en' ? 'en-HK' : 'zh-HK'), {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function monthHasSelectableDate(monthKey: string, minDate: string, maxDate: string, locale: BookingLocale = 'zh'): boolean {
  const daysInMonth = getDaysInMonth(monthKey, locale);
  const firstDate = isoDateFromMonthDay(monthKey, 1, locale);
  const lastDate = isoDateFromMonthDay(monthKey, daysInMonth, locale);
  return !(lastDate < minDate || firstDate > maxDate);
}

function formatDateForDisplay(dateIso: string, locale: BookingLocale = 'zh'): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat((locale === 'en' ? 'en-HK' : 'zh-HK'), {
    timeZone: HONG_KONG_TIMEZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function getClinicAvailabilityStyle(clinicId: string, locale: BookingLocale = 'zh') {
  return isClinicId(clinicId)
    ? CLINIC_AVAILABILITY_STYLES[clinicId]
    : DEFAULT_CLINIC_AVAILABILITY_STYLE;
}

async function requestAvailabilityForBooking(
  booking: Pick<VerifiedBooking, 'doctorId' | 'clinicId' | 'durationMinutes'>,
  clinicId: string,
  date: string, locale: BookingLocale = 'zh'
): Promise<AvailabilityRequestResult> {
  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId: booking.doctorId,
        clinicId,
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
          errorMessage: bookingText("暫時未能讀取預約日曆，請稍後再試。", locale),
        };
      }

      return {
        slots: [],
        isClosedDay: false,
        status: 'unknown',
        errorMessage: data?.error || bookingText("暫時未能讀取可預約時段。", locale),
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
      errorMessage: bookingText("載入可預約時段時發生錯誤。", locale),
    };
  }
}

function formatBookingDateTime(date: string, time: string, locale: BookingLocale = 'zh') {
  const value = new Date(`${date}T${time}:00+08:00`);
  const dateLabel = new Intl.DateTimeFormat(locale === 'en' ? 'en-HK' : 'zh-HK', { timeZone: HONG_KONG_TIMEZONE, month: 'long', day: 'numeric', weekday: 'short' }).format(value);
  return `${dateLabel} ${time}`;
}

function visitTypeLabel(value: VerifiedBooking['visitType'], locale: BookingLocale = 'zh') {
  return value === 'followup' ? bookingText("覆診", locale) : bookingText("初診", locale);
}

function FeedbackBanner({ locale = 'zh', 
  type,
  text,
}: { locale?: BookingLocale; 
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
      {bookingFeedback(text, locale)}
    </div>
  );
}

function BookingSummaryCard({ locale = 'zh', 
  booking,
  selected,
  onSelect,
}: { locale?: BookingLocale; 
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
            {visitTypeLabel(booking.visitType, locale)}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">{bookingText(booking.doctorNameZh, locale)}</h3>
          <p className="mt-1 truncate text-sm text-slate-600">{bookingText(booking.clinicNameZh, locale)}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">{bookingText("病人：", locale)}{booking.patientName}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            disabled ? 'bg-amber-100 text-amber-800' : 'bg-primary-light text-primary'
          }`}
        >
          {disabled ? bookingText("需姑娘協助", locale) : selected ? bookingText("已選擇", locale) : bookingText("可自助處理", locale)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span>{formatBookingDateTime(booking.appointmentDate, booking.appointmentTime, locale)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="truncate">{bookingText("預約編號：", locale)}{booking.bookingId}</span>
        </div>
      </div>

      <p className={`mt-3 text-sm leading-relaxed ${disabled ? 'text-amber-800' : 'text-slate-500'}`}>
        {bookingFeedback(booking.message, locale)}
      </p>
    </button>
  );
}

function SupportClinicButtons({ locale = 'zh', 
  action,
  booking,
}: { locale?: BookingLocale; 
  action: ManageAction | null;
  booking?: VerifiedBooking | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SUPPORT_CLINIC_IDS.map((clinicId) => {
        const clinic = CLINIC_BY_ID[clinicId];
        const href = buildSupportWhatsappHref({ action, booking, clinicId }, locale);
        if (!clinic || !href) {
          return null;
        }

        const style = CLINIC_AVAILABILITY_STYLES[clinicId];

        return (
          <a
            key={clinicId}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center justify-center rounded-[18px] border px-4 py-3 text-sm font-semibold transition hover:brightness-[0.98] ${style.selectedButtonClassName}`}
          >
            WhatsApp {bookingText(clinic.nameZh, locale)}
          </a>
        );
      })}
    </div>
  );
}

export function ManageBookingFlow({ locale = 'zh',  action, manageAccessToken }: ManageBookingFlowProps) {
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
  const [doctorSchedules, setDoctorSchedules] = useState<BookableDoctorSchedule[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [rescheduleClinicId, setRescheduleClinicId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotError, setSlotError] = useState('');
  const [supportWhatsappUrl, setSupportWhatsappUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKeyInHongKong(new Date(), locale));
  const [monthAvailability, setMonthAvailability] = useState<MonthAvailabilityMap>({});
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false);
  const [bookableDatesError, setBookableDatesError] = useState('');
  const minDate = getTodayIsoInHongKong(locale);
  const maxDate = getMaxDateIsoInHongKong(MAX_RESCHEDULE_WINDOW_DAYS, locale);

  const selectedBooking = bookings.find((booking) => booking.bookingId === selectedBookingId) || null;
  const calendarMonthLabel = formatMonthLabel(calendarMonthKey, locale);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1, locale);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1, locale);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate, locale);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate, locale);
  const selectedDoctorSchedule = useMemo(
    () => doctorSchedules.find((doctor) => doctor.doctorId === selectedBooking?.doctorId) || null,
    [doctorSchedules, selectedBooking?.doctorId],
  );
  const doctorClinicOptions = selectedDoctorSchedule?.clinics || [];
  const activeRescheduleClinicId = rescheduleClinicId || selectedBooking?.clinicId || '';
  const selectedClinicStyle = getClinicAvailabilityStyle(activeRescheduleClinicId, locale);
  const selectedClinicProfile =
    activeRescheduleClinicId && isClinicId(activeRescheduleClinicId)
      ? CLINIC_BY_ID[activeRescheduleClinicId]
      : null;
  const calendarCells = Array.from(
    {
      length:
        Math.ceil(
          (getWeekdayIndexMondayFirst(isoDateFromMonthDay(calendarMonthKey, 1, locale), locale) +
            getDaysInMonth(calendarMonthKey, locale)) /
            7,
        ) * 7,
    },
    (_, index) => {
      const leadingEmptyCellCount = getWeekdayIndexMondayFirst(isoDateFromMonthDay(calendarMonthKey, 1, locale), locale);
      const day = index - leadingEmptyCellCount + 1;
      const daysInMonth = getDaysInMonth(calendarMonthKey, locale);

      if (day < 1 || day > daysInMonth) return null;

      const dateIso = isoDateFromMonthDay(calendarMonthKey, day, locale);
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
            ? bookingText("{0}有位", locale, [bookingText(selectedClinicProfile?.nameZh || selectedBooking?.clinicNameZh || '診所', locale)])
            : availability === 'unavailable'
              ? bookingText("{0}暫滿", locale, [bookingText(selectedClinicProfile?.nameZh || selectedBooking?.clinicNameZh || '診所', locale)])
              : bookingText("正在掃描 availability", locale),
      };
    },
  );

  useEffect(() => {
    let cancelled = false;

    const loadDoctorSchedules = async () => {
      try {
        const response = await fetch('/api/public/bookable-schedules');
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled || !Array.isArray(data?.doctors)) return;
        setDoctorSchedules(data.doctors as BookableDoctorSchedule[]);
      } catch {
        if (!cancelled) {
          setDoctorSchedules([]);
        }
      }
    };

    void loadDoctorSchedules();

    return () => {
      cancelled = true;
    };
  }, []);

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
          body: JSON.stringify({ token: manageAccessToken, locale }),
        });
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          setFeedback({ type: 'error', text: data.error || bookingText("管理連結已失效，請使用電話驗證。", locale) });
          return;
        }

        const nextBookings = Array.isArray(data.bookings) ? (data.bookings as VerifiedBooking[]) : [];
        setBookings(nextBookings);
        setSelectedBookingId(nextBookings.length === 1 ? nextBookings[0].bookingId : '');
        setMaskedPhone(data.maskedPhone || '');
        setTokenVerified(true);
        setRequestSucceeded(true);
        setFeedback({ type: 'success', text: data.message || bookingText("已驗證，請繼續管理你的預約。", locale) });
      } catch {
        if (!cancelled) {
          setFeedback({ type: 'error', text: bookingText("驗證管理連結時發生錯誤，請使用電話驗證。", locale) });
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
  }, [manageAccessToken, locale]);

  useEffect(() => {
    setRescheduleClinicId(selectedBooking?.clinicId || '');
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotError('');
    setResult(null);
    setCalendarMonthKey(toMonthKeyInHongKong(new Date(), locale));
    setMonthAvailability({});
    setBookableDatesLoading(false);
    setBookableDatesError('');
  }, [selectedBookingId, action, locale]);

  useEffect(() => {
    if (action !== 'reschedule' || !selectedBooking || !selectedBooking.canSelfManage) {
      setMonthAvailability({});
      setBookableDatesLoading(false);
      setBookableDatesError('');
      return;
    }

    const daysInMonth = getDaysInMonth(calendarMonthKey, locale);
    const datesToScan: string[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateIso = isoDateFromMonthDay(calendarMonthKey, day, locale);
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

            const result = await requestAvailabilityForBooking(
              selectedBooking,
              activeRescheduleClinicId || selectedBooking.clinicId,
              nextDate, locale
            );
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
        hasPartialRead ? bookingText("暫時未能完整讀取預約日曆，灰色日期可能仍在更新。", locale) : '',
      );
    };

    void scanMonthAvailability();

    return () => {
      cancelled = true;
    };
  }, [action, activeRescheduleClinicId, calendarMonthKey, maxDate, minDate, selectedBooking, locale]);

  async function requestMagicLink() {
    if (!phone.trim()) {
      setFeedback({ type: 'error', text: bookingText("請輸入預約時使用的 WhatsApp 電話號碼。", locale) });
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
        body: JSON.stringify({ phone, action: action || undefined, locale }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || bookingText("暫時未能發送登入連結。", locale) });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || null);
        return;
      }

      setMaskedPhone(data.maskedPhone || '');
      setRequestSucceeded(true);
      setFeedback({ type: 'success', text: data.message || bookingText("登入連結已發送。", locale) });
    } catch {
      setFeedback({ type: 'error', text: bookingText("發送登入連結時發生錯誤，請稍後再試。", locale) });
    } finally {
      setRequestingLink(false);
    }
  }

  async function handleRequestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestMagicLink();
  }

  async function loadSlots(date: string, clinicId: string = activeRescheduleClinicId || selectedBooking?.clinicId || '') {
    if (!selectedBooking) return;
    if (!clinicId) {
      setSlotError(bookingText("請先選擇想改去的診所。", locale));
      return;
    }

    setSelectedDate(date);
    setSelectedTime('');
    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setFeedback(null);

    try {
      const result = await requestAvailabilityForBooking(selectedBooking, clinicId, date, locale);
      setMonthAvailability((previous) => ({
        ...previous,
        [date]: result.status,
      }));

      if (result.status === 'unknown') {
        setSlotError(result.errorMessage || bookingText("暫時未能讀取可預約時段。", locale));
        return;
      }

      if (result.slots.length > 0) {
        setAvailableSlots(result.slots);
        return;
      }

      if (result.isClosedDay) {
        setSlotError(bookingText("該日未有門診時段可供更改。", locale));
        return;
      }

      setSlotError(bookingText("該日暫時未有可更改時段。", locale));
    } catch {
      setSlotError(bookingText("載入時段時發生錯誤，請稍後再試。", locale));
    } finally {
      setSlotsLoading(false);
    }
  }

  function handleRescheduleClinicChange(nextClinicId: string) {
    setRescheduleClinicId(nextClinicId);
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotError('');
    setResult(null);

    if (!selectedDate) {
      return;
    }

    void loadSlots(selectedDate, nextClinicId);
  }

  async function handleConfirmAction() {
    if (!selectedBooking?.manageToken) {
      setFeedback({ type: 'error', text: bookingText("管理憑證已失效，請重新驗證。", locale) });
      return;
    }

    if (action === 'reschedule' && (!selectedDate || !selectedTime)) {
      setFeedback({ type: 'error', text: bookingText("請先選擇新的日期和時段。", locale) });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    setSupportWhatsappUrl(selectedClinicProfile?.whatsappUrl || selectedBooking.clinicWhatsappUrl || null);

    try {
      const response = await fetch(
        action === 'reschedule' ? '/api/widget-booking/reschedule' : '/api/widget-booking/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'reschedule'
              ? {
                  manageToken: selectedBooking.manageToken,
                  locale,
                  clinicId: activeRescheduleClinicId || selectedBooking.clinicId,
                  date: selectedDate,
                  time: selectedTime,
                }
              : { manageToken: selectedBooking.manageToken, locale },
          ),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error || bookingText("{0}失敗，請稍後再試。", locale, [getActionLabel(action, locale)]) });
        setSupportWhatsappUrl(data.clinicWhatsappUrl || selectedBooking.clinicWhatsappUrl || null);
        return;
      }

      setResult(data as ActionResult);
      setFeedback({ type: 'success', text: data.message || bookingText("{0}成功。", locale, [getActionLabel(action, locale)]) });
      setSupportWhatsappUrl(null);
    } catch {
      setFeedback({ type: 'error', text: bookingText("{0}時發生錯誤，請稍後再試。", locale, [getActionLabel(action, locale)]) });
    } finally {
      setActionLoading(false);
    }
  }

  function buildActionHref(nextAction: ManageAction) {
    const params = new URLSearchParams({ action: nextAction });
    if (manageAccessToken) {
      params.set('token', manageAccessToken);
    }
    return `${locale === 'en' ? '/en/manage-booking' : '/manage-booking'}?${params.toString()}`;
  }

  return (
    <div className="patient-card mx-auto max-w-5xl overflow-hidden p-5 sm:p-6 lg:p-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">
            {getActionLabel(action, locale)}
          </h1>
          <div className="rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
            {bookingText("步驟：", locale)}{tokenVerified ? bookingText(" 1. 已驗證", locale) : bookingText(" 1. 驗證電話", locale)}
            {bookings.length > 0 || requestSucceeded ? bookingText("  2. 選擇預約", locale) : bookingText("  2. 預約卡片", locale)}
            {!action ? bookingText("  3. 選擇操作", locale) : action === 'reschedule' ? bookingText("  3. 更改預約", locale) : bookingText("  3. 取消預約", locale)}
          </div>
        </div>

        {feedback ? <FeedbackBanner type={feedback.type} text={feedback.text} locale={locale} /> : null}

        {tokenVerifying ? (
          <div className="flex items-center justify-center gap-3 rounded-[24px] border border-primary/10 bg-white p-8 shadow-sm sm:p-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-base text-slate-600">{bookingText("正在驗證管理連結⋯", locale)}</span>
          </div>
        ) : null}

        <section
          className={`grid gap-5 sm:gap-6 ${tokenVerified ? '' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}`}
          style={tokenVerifying ? { display: 'none' } : undefined}
        >
          {!tokenVerified ? (
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900">{bookingText("WhatsApp 登入連結", locale)}</h2>

              <div className="mt-4 space-y-5">
                <p className="text-sm leading-relaxed text-slate-600">
                  {bookingText("輸入預約時使用的 WhatsApp 電話號碼，我們會把登入連結發送到你的 WhatsApp。", locale)}</p>

                <form className="space-y-4" onSubmit={handleRequestLink}>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="manage-booking-phone">
                      {bookingText("WhatsApp 電話號碼", locale)}</label>
                    <input
                      id="manage-booking-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder={bookingText("例如 9123 4567 / +852 9123 4567", locale)}
                      className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={requestingLink}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {requestingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : requestSucceeded ? bookingText("重新發送登入連結", locale) : bookingText("發送登入連結", locale)}
                  </button>
                </form>

                <div className="rounded-2xl border border-primary/10 bg-primary-light/35 p-4 text-sm leading-relaxed text-slate-600">
                  {requestSucceeded
                    ? bookingText("登入連結已送往 {0}。請返回 WhatsApp 打開連結，系統會直接帶你回到這頁。", locale, [maskedPhone || '你的 WhatsApp'])
                    : bookingText("你不需要再抄寫驗證碼；只要在 WhatsApp 打開登入連結即可。", locale)}
                </div>
              </div>
            </div>
          ) : null}

          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div className="min-w-0 rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">{bookingText("選擇預約", locale)}</h2>
                {bookings.length > 0 ? (
                  <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                    {bookings.length} {bookingText("筆", locale)}</span>
                ) : null}
              </div>

              {bookings.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {bookings.map((booking) => (
                    <BookingSummaryCard
                      key={booking.bookingId}
                      booking={booking}
                      selected={selectedBookingId === booking.bookingId}
                      onSelect={() => setSelectedBookingId(booking.bookingId)} locale={locale}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm leading-relaxed text-slate-500">
                  {tokenVerified
                    ? bookingText("暫時沒有可處理預約。", locale)
                    : requestSucceeded
                      ? bookingText("登入連結已發出，請返回 WhatsApp 打開後再回來。", locale)
                      : bookingText("完成驗證後顯示在這裡。", locale)}
                </div>
              )}
            </div>

            {selectedBooking && selectedBooking.canSelfManage && !action && !result ? (
              <div className="rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900">{bookingText("選擇要處理的操作", locale)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {bookingText("你已經完成驗證。先選擇預約，再決定要更改時間或取消預約。", locale)}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={buildActionHref('reschedule')}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
                  >
                    {bookingText("更改預約", locale)}</Link>
                  <Link
                    href={buildActionHref('cancel')}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[18px] border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    {bookingText("取消預約", locale)}</Link>
                </div>
              </div>
            ) : null}

            {selectedBooking && !selectedBooking.canSelfManage ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-amber-900">{bookingText("此預約需由姑娘協助", locale)}</h3>
                    <p className="text-sm leading-relaxed text-amber-800">{bookingFeedback(selectedBooking.message, locale)}</p>
                    <SupportClinicButtons action={action} booking={selectedBooking} locale={locale} />
                  </div>
                </div>
              </div>
            ) : (
              null
            )}

            {selectedBooking && selectedBooking.canSelfManage && action === 'reschedule' && !result ? (
              <div className="space-y-5 sm:space-y-6">
                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">{bookingText("新診所", locale)}</h3>
                    <p className="text-sm leading-relaxed text-slate-500">
                      {bookingText("你可以保留原本診所，亦可以改去同一醫師其他應診地點。", locale)}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {doctorClinicOptions.length > 0 ? doctorClinicOptions.map((clinic) => {
                      const clinicStyle = getClinicAvailabilityStyle(clinic.clinicId, locale);
                      const isSelectedClinic = clinic.clinicId === activeRescheduleClinicId;

                      return (
                        <button
                          key={`reschedule-clinic-${clinic.clinicId}`}
                          type="button"
                          onClick={() => handleRescheduleClinicChange(clinic.clinicId)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            isSelectedClinic
                              ? clinicStyle.selectedButtonClassName
                              : 'border-slate-200 bg-white text-slate-700 hover:border-primary/30'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${clinicStyle.dotClassName}`} />
                          {bookingText(clinic.clinicNameZh, locale)}
                          {clinic.clinicId === selectedBooking.clinicId ? (
                            <span className="text-[11px] font-medium text-slate-500">{bookingText("原預約", locale)}</span>
                          ) : null}
                        </button>
                      );
                    }) : (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                        <span className={`h-2 w-2 rounded-full ${selectedClinicStyle.dotClassName}`} />
                        {bookingText(selectedBooking.clinicNameZh, locale)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-slate-900">{bookingText("新日期", locale)}</h3>
                      <p className="text-sm leading-relaxed text-slate-500">
                        {bookingText("已改用同新增預約一致的月曆式選擇，方便直接看整月可改期日子。", locale)}</p>
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
                          aria-label={bookingText("上一個月", locale)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarMonthKey(nextMonthKey)}
                          disabled={!canGoToNextMonth || bookableDatesLoading}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={bookingText("下一個月", locale)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                      {WEEKDAY_LABELS.map((weekday) => (
                        <span key={bookingText(weekday, locale)} className="py-1">
                          {bookingText(weekday, locale)}
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
                        <span>{bookingText(selectedClinicProfile?.nameZh, locale) || bookingText(selectedBooking.clinicNameZh, locale)}{bookingText("有位", locale)}</span>
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${UNAVAILABLE_DOT_CLASS_NAME}`} />
                        <span>{bookingText(selectedClinicProfile?.nameZh, locale) || bookingText(selectedBooking.clinicNameZh, locale)}{bookingText("暫滿", locale)}</span>
                      </span>
                    </div>
                  </div>

                  {bookableDatesLoading ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {bookingText("正在掃描本月可改期日子...", locale)}</div>
                  ) : null}

                  {!bookableDatesLoading && bookableDatesError ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {bookingFeedback(bookableDatesError, locale)}
                    </div>
                  ) : null}

                  {selectedDate ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-slate-600">
                        {bookingText("已選日期：", locale)}<span className="font-semibold text-slate-900">{formatDateForDisplay(selectedDate, locale)}</span>
                      </p>
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${selectedClinicStyle.badgeClassName}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${selectedClinicStyle.dotClassName}`} />
                        {bookingText(selectedClinicProfile?.nameZh, locale) || bookingText(selectedBooking.clinicNameZh, locale)}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">{bookingText("請先在月曆選擇日期，再查看可更改時段。", locale)}</p>
                  )}
                </div>

                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-slate-900">{bookingText("新時段", locale)}</h3>
                  </div>

                  {slotsLoading ? (
                    <div className="mt-6 flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : slotError ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {bookingFeedback(slotError, locale)}
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
                      {bookingText("選擇診所及日期後，這裡會顯示可更改的時段。", locale)}</div>
                  )}
                </div>

                <div className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-lg font-semibold text-slate-900">{bookingText("確認", locale)}</h3>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{bookingText("目前預約", locale)}</p>
                      <p className="mt-3 text-base font-semibold text-slate-900">{bookingText(selectedBooking.doctorNameZh, locale)}</p>
                      <p className="mt-1 text-sm text-slate-500">{bookingText(selectedBooking.clinicNameZh, locale)}</p>
                      <p className="mt-3 text-sm text-slate-700">
                        {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime, locale)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/15 bg-primary-light p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">{bookingText("新預約", locale)}</p>
                      <p className="mt-3 text-base font-semibold text-slate-900">{bookingText(selectedBooking.doctorNameZh, locale)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {bookingText(selectedClinicProfile?.nameZh, locale) || bookingText(selectedBooking.clinicNameZh, locale)}
                      </p>
                      <p className="mt-3 text-sm text-slate-700">
                        {selectedDate && selectedTime ? formatBookingDateTime(selectedDate, selectedTime, locale) : bookingText("請先選擇日期和時段", locale)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleConfirmAction()}
                    disabled={actionLoading || !selectedDate || !selectedTime}
                    className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : bookingText("確認更改預約", locale)}
                  </button>
                </div>
              </div>
            ) : null}

            {selectedBooking && selectedBooking.canSelfManage && action === 'cancel' && !result ? (
              <div className="rounded-[24px] border border-red-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-lg font-semibold text-slate-900">{bookingText("確認取消預約", locale)}</h3>
                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50/80 p-5">
                  <p className="text-base font-semibold text-slate-900">{bookingText(selectedBooking.doctorNameZh, locale)}</p>
                  <p className="mt-1 text-sm text-slate-500">{bookingText(selectedBooking.clinicNameZh, locale)}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    {formatBookingDateTime(selectedBooking.appointmentDate, selectedBooking.appointmentTime, locale)}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-red-700">
                    {bookingText("取消後，此預約時段會立即釋出。如需重新安排，需要重新預約。", locale)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConfirmAction()}
                  disabled={actionLoading}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[18px] bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : bookingText("確認取消預約", locale)}
                </button>
              </div>
            ) : null}

            {result ? (
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-emerald-900">
                      {action === 'reschedule' ? bookingText("已成功更改預約", locale) : bookingText("已成功取消預約", locale)}
                    </h3>
                    <p className="text-sm leading-relaxed text-emerald-800">{bookingFeedback(result.message, locale)}</p>
                    <div className="rounded-2xl border border-emerald-200 bg-white/70 p-4 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">{bookingText(result.booking.doctorNameZh, locale)}</p>
                      <p className="mt-1">{bookingText(result.booking.clinicNameZh, locale)}</p>
                      {action === 'reschedule' ? (
                        <p className="mt-3">
                          {bookingText("新時間：", locale)}{formatBookingDateTime(result.booking.appointmentDate, result.booking.appointmentTime, locale)}
                        </p>
                      ) : (
                        <p className="mt-3">
                          {bookingText("已取消時間：", locale)}{formatBookingDateTime(selectedBooking!.appointmentDate, selectedBooking!.appointmentTime, locale)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={locale === 'en' ? '/en/booking' : '/booking-whatsapp'}
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
                      >
                        {bookingText("重新預約", locale)}</Link>
                      <Link
                        href={locale === 'en' ? '/en/manage-booking' : '/manage-booking'}
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
                      >
                        {bookingText("返回預約管理", locale)}</Link>
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
                    <h3 className="text-lg font-semibold text-slate-900">{bookingText("需要人工協助？", locale)}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      {bookingText("如果目前未能自助處理，你可以直接選擇診所 WhatsApp 聯絡姑娘跟進。", locale)}</p>
                    <SupportClinicButtons action={action} booking={selectedBooking} locale={locale} />
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
