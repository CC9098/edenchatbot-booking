'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  UserRound,
} from 'lucide-react';
import {
  buildBookingContactPrefill,
  normalizePhoneForSearch,
  normalizePhoneForStorage,
} from '@/lib/contact-utils';
import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';
import { type ClinicId, type DoctorId } from '@/shared/clinic-data';
import type { TimeRange, WeeklySchedule } from '@/shared/schedule-config';

type BookingStep = 'setup' | 'timeslot' | 'details' | 'success';
type FlowVariant = 'booking' | 'whatsapp';
type VisitType = 'first' | 'followup';
type ReceiptType = 'no' | 'yes_insurance' | 'yes_not_insurance';
type PickupType = 'none' | 'lalamove' | 'sfexpress' | 'clinic_pickup';
type GenderType = '' | 'male' | 'female' | 'other';

type BookingFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  needReceipt: ReceiptType;
  medicationPickup: PickupType;
  idCard: string;
  dateOfBirth: string;
  gender: GenderType;
  allergies: string;
  medications: string;
  symptoms: string;
  referralSource: string;
};

type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

type BookingTabFlowProps = {
  doctors: BookableDoctorSchedule[];
  initialContact?: {
    displayName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  initialSelection?: {
    doctorId?: DoctorId;
    clinicId?: ClinicId;
    visitType?: VisitType;
  };
  embedMode?: boolean;
  flowVariant?: FlowVariant;
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const SLOT_INTERVAL_MINUTES = 15;
const MAX_BOOKING_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const WEEKDAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

const PICKUP_LABELS: Record<PickupType, string> = {
  none: '不需要',
  lalamove: '即日配送（Lalamove）',
  sfexpress: '順豐速運',
  clinic_pickup: '診所自取',
};

const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  first: '首診',
  followup: '覆診',
};

const RECEIPT_LABELS: Record<ReceiptType, string> = {
  no: '不需要',
  yes_insurance: '需要，用作保險索償',
  yes_not_insurance: '需要，非保險用途',
};

const GENDER_LABELS: Record<Exclude<GenderType, ''>, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  google: 'Google 搜尋',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  friend: '朋友介紹',
  doctor: '醫師介紹',
  walk_in: '路過',
  other: '其他',
};

const INITIAL_FORM_VALUES: BookingFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  needReceipt: 'no',
  medicationPickup: 'none',
  idCard: '',
  dateOfBirth: '',
  gender: '',
  allergies: '',
  medications: '',
  symptoms: '',
  referralSource: '',
};

function buildInitialFormValues(
  initialContact?: BookingTabFlowProps['initialContact']
): BookingFormValues {
  if (!initialContact) {
    return { ...INITIAL_FORM_VALUES };
  }

  const contactPrefill = buildBookingContactPrefill(initialContact);

  return {
    ...INITIAL_FORM_VALUES,
    firstName: contactPrefill.firstName,
    lastName: contactPrefill.lastName,
    phone: contactPrefill.phone,
    email: contactPrefill.email,
  };
}

function toIsoDateInHongKong(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayIsoInHongKong(): string {
  return toIsoDateInHongKong(new Date());
}

function getMaxDateIsoInHongKong(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toIsoDateInHongKong(date);
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

function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

function toMonthKeyInHongKong(date: Date): string {
  return toIsoDateInHongKong(date).slice(0, 7);
}

function toMonthKeyFromIsoDate(dateIso: string): string {
  return dateIso.slice(0, 7);
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

function formatTimeRanges(ranges: TimeRange[]): string {
  return ranges.map((range) => `${range.start}-${range.end}`).join('，');
}

function formatScheduleLines(schedule: WeeklySchedule): string[] {
  const lines: string[] = [];

  for (let day = 0; day <= 6; day += 1) {
    const ranges = schedule[day];
    if (!ranges || ranges.length === 0) continue;
    lines.push(`${WEEKDAY_LABELS_ZH[day]}：${formatTimeRanges(ranges)}`);
  }

  return lines;
}

function getDoctorAvatarFallback(nameZh?: string): string {
  return nameZh?.trim().slice(0, 1) || '醫';
}

function DoctorAvatar({
  doctor,
  size = 'sm',
}: {
  doctor?: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'avatarSrc'>;
  size?: 'sm' | 'lg';
}) {
  const isLarge = size === 'lg';
  const frameClassName = isLarge ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-14 w-14';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-4 border-[#71a97a] bg-[#edf7ef] shadow-[0_18px_40px_-28px_rgba(31,74,44,0.55)] ${frameClassName}`}
    >
      {doctor?.avatarSrc ? (
        <Image
          src={doctor.avatarSrc}
          alt={`${doctor.doctorNameZh}頭像`}
          fill
          sizes={isLarge ? '112px' : '56px'}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#eaf8ed_0%,#cfe8d6_100%)] text-lg font-semibold text-[#2b5d38]">
          {getDoctorAvatarFallback(doctor?.doctorNameZh)}
        </div>
      )}
    </div>
  );
}

function DoctorBookingSummary({
  doctor,
  clinicNameZh,
  eyebrow,
  details,
}: {
  doctor?: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'avatarSrc'>;
  clinicNameZh?: string;
  eyebrow: string;
  details: string[];
}) {
  return (
    <div className="rounded-[24px] border border-[#d5e4d8] bg-[linear-gradient(135deg,#f8fcf8_0%,#eef8f0_55%,#ffffff_100%)] p-4 text-left shadow-[0_16px_36px_-30px_rgba(31,74,44,0.45)]">
      <div className="flex items-center gap-3">
        <DoctorAvatar doctor={doctor} size="sm" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#5d8c67]">{eyebrow}</p>
          <p className="mt-1 truncate text-base font-semibold text-[#254430]">{doctor?.doctorNameZh || '已選醫師'}</p>
          <p className="truncate text-xs text-slate-500">{clinicNameZh || '請選擇診所'}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        {details.map((detail) => (
          <p key={detail}>{detail}</p>
        ))}
      </div>
    </div>
  );
}

export function BookingTabFlow({
  doctors,
  initialContact,
  initialSelection,
  embedMode = false,
  flowVariant = 'booking',
}: BookingTabFlowProps) {
  const isWhatsappFlow = flowVariant === 'whatsapp';
  const [step, setStep] = useState<BookingStep>('setup');
  const [visitType, setVisitType] = useState<VisitType>(initialSelection?.visitType ?? 'first');
  const [doctorId, setDoctorId] = useState<DoctorId | ''>(initialSelection?.doctorId ?? '');
  const [clinicId, setClinicId] = useState<ClinicId | ''>(initialSelection?.clinicId ?? '');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKeyInHongKong(new Date()));
  const [bookableDatesInMonth, setBookableDatesInMonth] = useState<Record<string, boolean>>({});
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false);
  const [bookableDatesError, setBookableDatesError] = useState('');

  const [formValues, setFormValues] = useState<BookingFormValues>(() =>
    buildInitialFormValues(initialContact)
  );
  const [formErrors, setFormErrors] = useState<BookingFormErrors>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [whatsappLabel, setWhatsappLabel] = useState('');
  const [intakeSaved, setIntakeSaved] = useState(true);
  const [whatsappRedirectAttempted, setWhatsappRedirectAttempted] = useState(false);

  const minDate = getTodayIsoInHongKong();
  const maxDate = getMaxDateIsoInHongKong(MAX_BOOKING_WINDOW_DAYS);

  const doctorOptions = useMemo(
    () => doctors,
    [doctors]
  );

  const clinicOptions = useMemo(() => {
    if (!doctorId) return [];
    return doctorOptions.find((doctor) => doctor.doctorId === doctorId)?.clinics ?? [];
  }, [doctorId, doctorOptions]);

  const selectedDoctor = useMemo(
    () => doctorOptions.find((doctor) => doctor.doctorId === doctorId),
    [doctorId, doctorOptions]
  );

  const selectedClinic = useMemo(
    () => clinicOptions.find((clinic) => clinic.clinicId === clinicId),
    [clinicId, clinicOptions]
  );
  const pageTitle = isWhatsappFlow ? 'WhatsApp 預約' : '預約服務';
  const pageSubtitle = isWhatsappFlow
    ? '先選好醫師、時段同資料，再由姑娘透過 WhatsApp 跟進確認。'
    : '「每一次預約，都是照顧自己的開始。」';
  const submitButtonLabel = isWhatsappFlow ? '前往 WhatsApp 確認' : '確認預約';
  const submitLoadingLabel = isWhatsappFlow ? '正在準備 WhatsApp...' : '預約處理中...';
  const detailNotice = isWhatsappFlow
    ? '提交後會自動開啟 WhatsApp 並預填預約資料；最終預約以姑娘確認為準。'
    : '成功預約後會收到確認電郵通知；更改或取消可使用電郵內連結。';
  const successTitle = isWhatsappFlow ? '已準備 WhatsApp 訊息' : '預約成功';
  const successDescription = isWhatsappFlow
    ? `系統已整理好預約資料，將會開啟 WhatsApp 交由${whatsappLabel || '姑娘'}跟進。`
    : '確認電郵將發送到你提供的信箱。';
  const successQuote = isWhatsappFlow
    ? '「一步一步，安心安排。」'
    : '「每一次回來，身體都記得。」';
  const referenceLabel = isWhatsappFlow ? '查詢編號' : '預約編號';

  const canContinueSetup = Boolean(doctorId && clinicId && visitType);
  const canContinueTimeslot = Boolean(selectedDate && selectedTime);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate);
  const hasAutofilledContact = Boolean(
    initialContact?.displayName || initialContact?.email || initialContact?.phone
  );

  useEffect(() => {
    if (!doctorId) {
      if (clinicId) {
        setClinicId('');
      }
      return;
    }

    const doctorExists = doctorOptions.some((doctor) => doctor.doctorId === doctorId);
    if (!doctorExists) {
      setDoctorId('');
      setClinicId('');
      return;
    }

    if (!clinicId) return;

    const clinicExists = clinicOptions.some((clinic) => clinic.clinicId === clinicId);
    if (!clinicExists) {
      setClinicId('');
    }
  }, [clinicId, clinicOptions, doctorId, doctorOptions]);

  const calendarMonthLabel = useMemo(
    () => formatMonthLabel(calendarMonthKey),
    [calendarMonthKey]
  );

  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarMonthKey);
    const leadingEmptyCellCount = getWeekdayIndexMondayFirst(
      isoDateFromMonthDay(calendarMonthKey, 1)
    );
    const totalCellCount = Math.ceil((leadingEmptyCellCount + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCellCount }, (_, index) => {
      const day = index - leadingEmptyCellCount + 1;
      if (day < 1 || day > daysInMonth) return null;

      const dateIso = isoDateFromMonthDay(calendarMonthKey, day);
      return {
        dateIso,
        day,
        isSelectable: dateIso >= minDate && dateIso <= maxDate,
        hasAvailability: bookableDatesInMonth[dateIso] === true,
      };
    });
  }, [bookableDatesInMonth, calendarMonthKey, maxDate, minDate]);

  useEffect(() => {
    if (step !== 'timeslot' || !doctorId || !clinicId) return;

    const daysInMonth = getDaysInMonth(calendarMonthKey);
    const datesToScan: string[] = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateIso = isoDateFromMonthDay(calendarMonthKey, day);
      if (dateIso >= minDate && dateIso <= maxDate) {
        datesToScan.push(dateIso);
      }
    }

    setBookableDatesInMonth({});
    setBookableDatesError('');

    if (datesToScan.length === 0) {
      setBookableDatesLoading(false);
      return;
    }

    let isCancelled = false;
    setBookableDatesLoading(true);

    const scanBookableDates = async () => {
      const dateQueue = [...datesToScan];
      const nextBookableDates: Record<string, boolean> = {};
      let hasCalendarUnavailable = false;
      const workerCount = Math.min(4, dateQueue.length);

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (dateQueue.length > 0 && !isCancelled) {
            const dateIso = dateQueue.shift();
            if (!dateIso) break;

            try {
              const response = await fetch('/api/availability', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  doctorId,
                  clinicId,
                  date: dateIso,
                  durationMinutes: SLOT_INTERVAL_MINUTES,
                }),
              });

              const data = await response.json();
              if (!response.ok) {
                if (data?.errorCode === 'CALENDAR_UNAVAILABLE') {
                  hasCalendarUnavailable = true;
                }
                nextBookableDates[dateIso] = false;
                continue;
              }

              const slots = Array.isArray(data?.slots) ? data.slots : [];
              const isClosedDay = Boolean(data?.isClosed || data?.isHoliday);
              nextBookableDates[dateIso] = !isClosedDay && slots.length > 0;
            } catch {
              nextBookableDates[dateIso] = false;
            }
          }
        })
      );

      if (isCancelled) return;

      setBookableDatesInMonth(nextBookableDates);
      setBookableDatesLoading(false);
      setBookableDatesError(
        hasCalendarUnavailable
          ? '暫時未能完整讀取預約日曆，綠點可能未完全顯示。'
          : ''
      );
    };

    void scanBookableDates();

    return () => {
      isCancelled = true;
    };
  }, [calendarMonthKey, clinicId, doctorId, maxDate, minDate, step]);

  useEffect(() => {
    if (!isWhatsappFlow || step !== 'success' || !whatsappUrl || whatsappRedirectAttempted) return;

    const timeoutId = window.setTimeout(() => {
      setWhatsappRedirectAttempted(true);
      window.location.href = whatsappUrl;
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [isWhatsappFlow, step, whatsappRedirectAttempted, whatsappUrl]);

  function resetSlotState() {
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotsLoading(false);
    setSlotError('');
    setCalendarMonthKey(toMonthKeyInHongKong(new Date()));
    setBookableDatesInMonth({});
    setBookableDatesLoading(false);
    setBookableDatesError('');
  }

  function resetSubmissionState() {
    setSubmitError('');
    setIsSubmitting(false);
    setBookingId('');
    setWhatsappUrl('');
    setWhatsappLabel('');
    setIntakeSaved(true);
    setWhatsappRedirectAttempted(false);
  }

  function handleDoctorChange(nextDoctorId: string) {
    setDoctorId(nextDoctorId as DoctorId);
    setClinicId('');
    setStep('setup');
    resetSlotState();
    resetSubmissionState();
  }

  function handleClinicChange(nextClinicId: string) {
    setClinicId(nextClinicId as ClinicId);
    setStep('setup');
    resetSlotState();
    resetSubmissionState();
  }

  function handleVisitTypeChange(nextVisitType: VisitType) {
    setVisitType(nextVisitType);
    setStep('setup');
    setFormErrors({});
    setSubmitError('');
  }

  async function fetchAvailability(dateIso: string) {
    if (!doctorId || !clinicId) return;

    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setSelectedTime('');

    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId,
          clinicId,
          date: dateIso,
          durationMinutes: SLOT_INTERVAL_MINUTES,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.errorCode === 'CALENDAR_UNAVAILABLE') {
          setSlotError('暫時未能連接預約日曆，請稍後再試或在聊天頁由姑娘協助安排。');
          return;
        }

        setSlotError(data?.error || '暫時未能讀取可預約時段，請稍後再試。');
        return;
      }

      const slots = Array.isArray(data?.slots) ? data.slots : [];
      const isClosedDay = Boolean(data?.isClosed || data?.isHoliday);
      const hasBookableSlots = !isClosedDay && slots.length > 0;

      setAvailableSlots(slots);
      setBookableDatesInMonth((prev) => ({
        ...prev,
        [dateIso]: hasBookableSlots,
      }));

      if (isClosedDay) {
        setSlotError('當日休診或公眾假期，請選擇其他日期。');
        return;
      }

      if (slots.length === 0) {
        setSlotError('當日暫無可預約時段。');
      }
    } catch {
      setSlotError('載入時段失敗，請稍後再試。');
    } finally {
      setSlotsLoading(false);
    }
  }

  function handleDateChange(dateIso: string) {
    setSelectedDate(dateIso);
    setCalendarMonthKey(toMonthKeyFromIsoDate(dateIso));
    void fetchAvailability(dateIso);
  }

  function updateFormField<Key extends keyof BookingFormValues>(
    key: Key,
    value: BookingFormValues[Key]
  ) {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (formErrors[key]) {
      setFormErrors((prev) => ({
        ...prev,
        [key]: undefined,
      }));
    }
  }

  function validateForm(values: BookingFormValues): BookingFormErrors {
    const nextErrors: BookingFormErrors = {};

    if (!values.firstName.trim()) {
      nextErrors.firstName = '請輸入名字';
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = '請輸入姓氏';
    }

    const normalizedPhone = normalizePhoneForSearch(values.phone);
    if (normalizedPhone.length < 8) {
      nextErrors.phone = '請輸入有效電話（至少 8 位數字）';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim().toLowerCase())) {
      nextErrors.email = '請輸入有效電郵地址';
    }

    if (visitType === 'first') {
      if (values.idCard.trim().length < 5) {
        nextErrors.idCard = '首診需要身份證資料';
      }

      if (!values.dateOfBirth.trim()) {
        nextErrors.dateOfBirth = '首診需要出生日期';
      }

      if (!values.gender) {
        nextErrors.gender = '首診需要性別資料';
      }

      if (!values.allergies.trim()) {
        nextErrors.allergies = '首診需要過敏史資料';
      }

      if (!values.medications.trim()) {
        nextErrors.medications = '首診需要現正服用藥物資料';
      }

      if (!values.symptoms.trim()) {
        nextErrors.symptoms = '首診需要主要症狀資料';
      }

      if (!values.referralSource.trim()) {
        nextErrors.referralSource = '首診需要得知來源資料';
      }
    }

    return nextErrors;
  }

  function buildBookingNotes(values: BookingFormValues): string {
    if (visitType === 'first') {
      return [
        '[首診]',
        `身份證號碼: ${values.idCard.trim() || '未提供'}`,
        `出生日期: ${values.dateOfBirth.trim() || '未提供'}`,
        `性別: ${values.gender ? GENDER_LABELS[values.gender] : '未提供'}`,
        `過敏史: ${values.allergies.trim() || '沒有'}`,
        `正服用藥物／保健品: ${values.medications.trim() || '沒有'}`,
        `主要症狀: ${values.symptoms.trim() || '未提供'}`,
        `得知來源: ${REFERRAL_SOURCE_LABELS[values.referralSource.trim()] || '未提供'}`,
        `收據需求: ${RECEIPT_LABELS[values.needReceipt]}`,
        `取藥方法: ${PICKUP_LABELS[values.medicationPickup]}`,
      ].join(' | ');
    }

    return [
      '[覆診]',
      `收據需求: ${RECEIPT_LABELS[values.needReceipt]}`,
      `取藥方法: ${PICKUP_LABELS[values.medicationPickup]}`,
    ].join(' | ');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDoctor || !selectedClinic || !doctorId || !clinicId) {
      setSubmitError('請先選擇醫師與診所。');
      setStep('setup');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setSubmitError('請先選擇日期與時間。');
      setStep('timeslot');
      return;
    }

    const validationErrors = validateForm(formValues);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('資料未填完整，請檢查必填欄位。');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      doctorId,
      clinicId,
      doctorName: selectedDoctor.doctorNameEn,
      doctorNameZh: selectedDoctor.doctorNameZh,
      clinicName: selectedClinic.clinicNameEn,
      clinicNameZh: selectedClinic.clinicNameZh,
      date: selectedDate,
      time: selectedTime,
      durationMinutes: SLOT_INTERVAL_MINUTES,
      patientName: `${formValues.lastName.trim()} ${formValues.firstName.trim()}`.trim(),
      phone: normalizePhoneForStorage(formValues.phone),
      email: formValues.email.trim().toLowerCase(),
      notes: buildBookingNotes(formValues),
    };
    const submitEndpoint = isWhatsappFlow ? '/api/booking-whatsapp' : '/api/booking';
    const requestBody = isWhatsappFlow
      ? {
          ...payload,
          visitType,
          needReceipt: formValues.needReceipt,
          medicationPickup: formValues.medicationPickup,
          idCard: formValues.idCard.trim(),
          dateOfBirth: formValues.dateOfBirth.trim(),
          gender: formValues.gender || undefined,
          allergies: formValues.allergies.trim(),
          medications: formValues.medications.trim(),
          symptoms: formValues.symptoms.trim(),
          referralSource: formValues.referralSource.trim(),
        }
      : payload;

    try {
      const response = await fetch(submitEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSubmitError(data?.error || '預約失敗，請稍後再試。');
        return;
      }

      if (isWhatsappFlow) {
        setBookingId(data.intakeId || '');
        setWhatsappUrl(data.whatsappUrl || '');
        setWhatsappLabel(data.whatsappLabel || '');
        setIntakeSaved(data.intakeSaved !== false);
      } else {
        setBookingId(data.bookingId || '');
      }
      setStep('success');
    } catch {
      setSubmitError(
        isWhatsappFlow ? '未能準備 WhatsApp 訊息，請稍後再試。' : '預約時發生錯誤，請稍後再試。'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startAnotherBooking() {
    setStep('timeslot');
    resetSlotState();
    setSubmitError('');
    setFormErrors({});
  }

  if (doctorOptions.length === 0) {
      return (
        <div className="patient-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-primary">{pageTitle}</h1>
        <p className="mt-3 text-sm text-slate-600">
          目前未有可用的醫師時段，請稍後再試或於聊天頁聯絡我們。
        </p>
        {!embedMode ? (
          <Link
            href="/chat"
            className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            返回聊天頁
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`patient-card mx-auto p-6 sm:p-8 ${embedMode ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <div className="mb-8 space-y-3">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">{pageTitle}</h1>
        <p
          className="text-sm leading-relaxed text-slate-400"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {pageSubtitle}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
        步驟：{step === 'setup' && '1. 醫師與診所'}{step === 'timeslot' && '2. 日期與時間'}
        {step === 'details' && '3. 填寫資料'}{step === 'success' && '完成'}
      </div>

      {step === 'setup' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">選擇醫師</span>
              <select
                value={doctorId}
                onChange={(event) => handleDoctorChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
              >
                <option value="">請選擇醫師</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.doctorId} value={doctor.doctorId}>
                    {doctor.doctorNameZh} ({doctor.doctorNameEn})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">選擇診所</span>
              <select
                value={clinicId}
                onChange={(event) => handleClinicChange(event.target.value)}
                disabled={!doctorId}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">{doctorId ? '請選擇診所' : '請先選擇醫師'}</option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic.clinicId} value={clinic.clinicId}>
                    {clinic.clinicNameZh} ({clinic.clinicNameEn})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedDoctor && (
            <section className="rounded-[30px] border border-[#cfe1d3] bg-[linear-gradient(135deg,#f8fcf8_0%,#edf7f0_52%,#ffffff_100%)] p-4 shadow-[0_22px_56px_-42px_rgba(31,74,44,0.42)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <DoctorAvatar doctor={selectedDoctor} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.28em] text-[#5d8c67]">
                      醫師應診時間
                    </p>
                    <h2 className="mt-2 text-[1.35rem] font-semibold text-[#234230] sm:text-[1.5rem]">
                      {selectedDoctor.doctorNameZh}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      揀好醫師後可即時睇到固定應診時間，實際可預約日期會喺下一步顯示。
                    </p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#d5e7d8] bg-white/85 px-4 py-3 text-sm shadow-[0_12px_30px_-26px_rgba(31,74,44,0.4)] sm:max-w-[240px]">
                  <p className="text-[11px] font-semibold tracking-[0.24em] text-[#5d8c67]">
                    醫師卡片
                  </p>
                  <p className="mt-1 font-semibold text-[#254430]">
                    {selectedDoctor.doctorNameZh}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {selectedClinic
                      ? `${selectedClinic.clinicNameZh} 已預選，可直接去下一步揀日期。`
                      : '請再選擇診所，之後即可查看固定應診時間。'}
                  </p>
                </div>
              </div>

              {selectedDoctor.scheduleNote && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{selectedDoctor.scheduleNote}</p>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {selectedDoctor.clinics.map((clinic) => {
                  const scheduleLines = formatScheduleLines(clinic.schedule);
                  const isChosenClinic = clinic.clinicId === clinicId;

                  return (
                    <div
                      key={clinic.clinicId}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        isChosenClinic
                          ? 'border-primary/40 bg-white shadow-[0_12px_30px_rgba(31,95,63,0.08)]'
                          : 'border-white/80 bg-white/80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {clinic.clinicNameZh}
                            <span className="ml-2 text-sm font-medium text-slate-400">
                              {clinic.clinicNameEn}
                            </span>
                          </p>
                        </div>
                        {isChosenClinic && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            已選診所
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2">
                        {scheduleLines.map((line) => (
                          <p key={`${clinic.clinicId}-${line}`} className="text-sm text-slate-600">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">診症類型</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleVisitTypeChange('first')}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  visitType === 'first'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                }`}
              >
                <p className="font-semibold">{VISIT_TYPE_LABELS.first}</p>
                <p className="mt-1 text-xs text-slate-500">第一次到診所就診</p>
              </button>

              <button
                type="button"
                onClick={() => handleVisitTypeChange('followup')}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  visitType === 'followup'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                }`}
              >
                <p className="font-semibold">{VISIT_TYPE_LABELS.followup}</p>
                <p className="mt-1 text-xs text-slate-500">曾經到診所就診</p>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('timeslot')}
            disabled={!canContinueSetup}
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步：選擇日期與時間
          </button>
        </div>
      )}

      {step === 'timeslot' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('setup')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> 返回上一頁
          </button>

          <DoctorBookingSummary
            doctor={selectedDoctor}
            clinicNameZh={selectedClinic?.clinicNameZh}
            eyebrow="已選醫師"
            details={[VISIT_TYPE_LABELS[visitType], '揀好日期後即可查看可預約時段。']}
          />

          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4" />
              選擇日期
            </span>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
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

                  const isSelected = selectedDate === cell.dateIso;

                  return (
                    <button
                      key={cell.dateIso}
                      type="button"
                      onClick={() => handleDateChange(cell.dateIso)}
                      disabled={!cell.isSelectable}
                      aria-label={`${cell.dateIso}${cell.hasAvailability ? '，可預約' : ''}`}
                      className={`h-12 rounded-lg border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        !cell.isSelectable
                          ? 'cursor-not-allowed border-transparent text-slate-300'
                          : isSelected
                            ? 'border-primary bg-primary text-white'
                            : cell.hasAvailability
                              ? 'border-emerald-300 bg-emerald-50 text-slate-900 hover:bg-emerald-100'
                              : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cell.day}</span>
                      <span
                        className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${
                          isSelected
                            ? 'bg-white/90'
                            : cell.hasAvailability
                              ? 'bg-emerald-500'
                              : 'bg-transparent'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>綠點代表該日目前有可預約時段</span>
              </div>
            </div>

            {bookableDatesLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在掃描本月可預約日子...
              </div>
            ) : null}

            {!bookableDatesLoading && bookableDatesError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bookableDatesError}
              </div>
            ) : null}

            {selectedDate ? (
              <p className="text-sm text-slate-600">
                已選日期：<span className="font-semibold text-slate-900">{formatDateForDisplay(selectedDate)}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">請先在日曆選擇日期，再選擇時段。</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">可預約時段</p>

            {slotsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在查詢可預約時段...
              </div>
            ) : null}

            {!slotsLoading && slotError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {slotError}
              </div>
            ) : null}

            {!slotsLoading && availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                      selectedTime === slot
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setStep('details')}
            disabled={!canContinueTimeslot}
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步：填寫個人資料
          </button>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('timeslot')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> 返回選擇時段
          </button>

          <DoctorBookingSummary
            doctor={selectedDoctor}
            clinicNameZh={selectedClinic?.clinicNameZh}
            eyebrow="預約摘要"
            details={[
              `${formatDateForDisplay(selectedDate)} ${selectedTime}`,
              VISIT_TYPE_LABELS[visitType],
            ]}
          />

          <form className="space-y-5" onSubmit={handleSubmit}>
            {hasAutofilledContact ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                已從登入帳戶帶入可用聯絡資料，你可按需要修改。
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">名字 *</span>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={formValues.firstName}
                  onChange={(event) => updateFormField('firstName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="例如：大文"
                />
                {formErrors.firstName ? <p className="text-xs text-red-600">{formErrors.firstName}</p> : null}
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">姓氏 *</span>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={formValues.lastName}
                  onChange={(event) => updateFormField('lastName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="例如：陳"
                />
                {formErrors.lastName ? <p className="text-xs text-red-600">{formErrors.lastName}</p> : null}
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">電話 *</span>
              <input
                type="tel"
                autoComplete="tel"
                value={formValues.phone}
                onChange={(event) => updateFormField('phone', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder="例如：98765432"
              />
              {formErrors.phone ? <p className="text-xs text-red-600">{formErrors.phone}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">電郵 *</span>
              <input
                type="email"
                autoComplete="email"
                value={formValues.email}
                onChange={(event) => updateFormField('email', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder="例如：name@example.com"
              />
              {formErrors.email ? <p className="text-xs text-red-600">{formErrors.email}</p> : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">收據需求 *</span>
                <select
                  value={formValues.needReceipt}
                  onChange={(event) => updateFormField('needReceipt', event.target.value as ReceiptType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="no">不需要</option>
                  <option value="yes_insurance">需要，用作保險索償</option>
                  <option value="yes_not_insurance">需要，非保險用途</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">取藥方法 *</span>
                <select
                  value={formValues.medicationPickup}
                  onChange={(event) =>
                    updateFormField('medicationPickup', event.target.value as PickupType)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="none">不需要</option>
                  <option value="lalamove">即日配送（Lalamove）</option>
                  <option value="sfexpress">順豐速運</option>
                  <option value="clinic_pickup">診所自取</option>
                </select>
              </label>
            </div>

            {visitType === 'first' ? (
              <div className="space-y-4 rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
                  <UserRound className="h-4 w-4" />
                  首診資料（必填）
                </p>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">身份證號碼 *</span>
                  <input
                    value={formValues.idCard}
                    onChange={(event) => updateFormField('idCard', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="例如：A123456(7)"
                  />
                  {formErrors.idCard ? <p className="text-xs text-red-600">{formErrors.idCard}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">出生日期 *</span>
                  <input
                    value={formValues.dateOfBirth}
                    onChange={(event) => updateFormField('dateOfBirth', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="例如：1990/01/15"
                  />
                  {formErrors.dateOfBirth ? (
                    <p className="text-xs text-red-600">{formErrors.dateOfBirth}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">性別 *</span>
                  <select
                    value={formValues.gender}
                    onChange={(event) => updateFormField('gender', event.target.value as GenderType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">請選擇</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                    <option value="other">其他</option>
                  </select>
                  {formErrors.gender ? <p className="text-xs text-red-600">{formErrors.gender}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">過敏史 *</span>
                  <textarea
                    value={formValues.allergies}
                    onChange={(event) => updateFormField('allergies', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="如沒有請填「沒有」"
                  />
                  {formErrors.allergies ? <p className="text-xs text-red-600">{formErrors.allergies}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">正服用藥物／保健品 *</span>
                  <textarea
                    value={formValues.medications}
                    onChange={(event) => updateFormField('medications', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="如沒有請填「沒有」"
                  />
                  {formErrors.medications ? (
                    <p className="text-xs text-red-600">{formErrors.medications}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">主要症狀 *</span>
                  <textarea
                    value={formValues.symptoms}
                    onChange={(event) => updateFormField('symptoms', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="請簡述主要問題"
                  />
                  {formErrors.symptoms ? <p className="text-xs text-red-600">{formErrors.symptoms}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">得知來源 *</span>
                  <select
                    value={formValues.referralSource}
                    onChange={(event) => updateFormField('referralSource', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">請選擇</option>
                    <option value="google">Google 搜尋</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="friend">朋友介紹</option>
                    <option value="doctor">醫師介紹</option>
                    <option value="walk_in">路過</option>
                    <option value="other">其他</option>
                  </select>
                  {formErrors.referralSource ? (
                    <p className="text-xs text-red-600">{formErrors.referralSource}</p>
                  ) : null}
                </label>
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
              {detailNotice}
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {submitLoadingLabel}
                </>
              ) : (
                submitButtonLabel
              )}
            </button>
          </form>
        </div>
      )}

      {step === 'success' && (
        <div className="animate-eden-enter space-y-8 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary/70" strokeWidth={1.5} />
          </div>

          <div className="space-y-3">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-800">{successTitle}</h2>
            <p className="text-sm text-slate-500">{successDescription}</p>
            {isWhatsappFlow ? (
              <p className="text-xs text-slate-400">如未自動開啟 WhatsApp，可使用下方按鈕繼續。</p>
            ) : null}
            {isWhatsappFlow && !intakeSaved ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                已準備 WhatsApp 訊息，但系統未能同步保存查詢紀錄。
              </p>
            ) : null}
            <p
              className="mt-4 text-[14px] leading-[1.8] text-slate-400"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {successQuote}
            </p>
          </div>

          <DoctorBookingSummary
            doctor={selectedDoctor}
            clinicNameZh={selectedClinic?.clinicNameZh}
            eyebrow="完成摘要"
            details={[
              `${formatDateForDisplay(selectedDate)} ${selectedTime}`,
              bookingId ? `${referenceLabel}：${bookingId}` : '確認資料已準備完成',
            ]}
          />

          <div className={`grid gap-3 ${embedMode ? '' : isWhatsappFlow && whatsappUrl ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            {isWhatsappFlow && whatsappUrl ? (
              <a
                href={whatsappUrl}
                className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                打開 WhatsApp
              </a>
            ) : null}
            <button
              type="button"
              onClick={startAnotherBooking}
              className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              再預約一個時段
            </button>

            {!embedMode ? (
              <Link
                href="/chat"
                className={`inline-flex items-center justify-center rounded-[18px] px-4 py-3 text-sm font-semibold transition ${
                  isWhatsappFlow && whatsappUrl
                    ? 'border border-primary/20 bg-white text-primary hover:bg-primary-light'
                    : 'bg-primary text-white hover:bg-primary-hover'
                }`}
              >
                返回聊天頁
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
