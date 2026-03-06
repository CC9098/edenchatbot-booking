'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
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
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const SLOT_INTERVAL_MINUTES = 15;
const MAX_BOOKING_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const WEEKDAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

const PICKUP_LABELS: Record<PickupType, string> = {
  none: '不需要 None',
  lalamove: 'Lalamove',
  sfexpress: '順豐 SF Express',
  clinic_pickup: '診所自取 Clinic Pickup',
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
  return new Intl.DateTimeFormat('en-US', {
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

export function BookingTabFlow({ doctors, initialContact }: BookingTabFlowProps) {
  const [step, setStep] = useState<BookingStep>('setup');
  const [visitType, setVisitType] = useState<VisitType>('first');
  const [doctorId, setDoctorId] = useState<DoctorId | ''>('');
  const [clinicId, setClinicId] = useState<ClinicId | ''>('');

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

  const canContinueSetup = Boolean(doctorId && clinicId && visitType);
  const canContinueTimeslot = Boolean(selectedDate && selectedTime);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate);
  const hasAutofilledContact = Boolean(
    initialContact?.displayName || initialContact?.email || initialContact?.phone
  );

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
        `ID: ${values.idCard.trim() || 'N/A'}`,
        `DOB: ${values.dateOfBirth.trim() || 'N/A'}`,
        `Gender: ${values.gender || 'N/A'}`,
        `Allergies: ${values.allergies.trim() || 'None'}`,
        `Medications: ${values.medications.trim() || 'None'}`,
        `Symptoms: ${values.symptoms.trim() || 'N/A'}`,
        `Referral: ${values.referralSource.trim() || 'N/A'}`,
        `Receipt: ${values.needReceipt}`,
        `取藥方法: ${PICKUP_LABELS[values.medicationPickup]}`,
      ].join(' | ');
    }

    return [
      '[覆診]',
      `Receipt: ${values.needReceipt}`,
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

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSubmitError(data?.error || '預約失敗，請稍後再試。');
        return;
      }

      setBookingId(data.bookingId || '');
      setStep('success');
    } catch {
      setSubmitError('預約時發生錯誤，請稍後再試。');
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
        <h1 className="text-2xl font-semibold text-primary">預約服務</h1>
        <p className="mt-3 text-sm text-slate-600">
          目前未有可用的醫師時段，請稍後再試或於聊天頁聯絡我們。
        </p>
        <Link
          href="/chat"
          className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          返回聊天頁
        </Link>
      </div>
    );
  }

  return (
    <div className="patient-card mx-auto max-w-2xl p-6 sm:p-8">
      <div className="mb-8 space-y-3">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">預約服務</h1>
        <p
          className="text-sm leading-relaxed text-slate-400"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          「每一次預約，都是照顧自己的開始。」
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
            <section className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary-light/60 via-white to-primary-light/20 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">
                    Doctor Schedule
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {selectedDoctor.doctorNameZh}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    揀好醫師後可即時睇到固定應診時間，實際可預約日期會喺下一步顯示。
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
                <p className="font-semibold">首診 First Visit</p>
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
                <p className="font-semibold">覆診 Follow-up</p>
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {selectedDoctor?.doctorNameZh} @ {selectedClinic?.clinicNameZh}
            </p>
            <p className="mt-1">{visitType === 'first' ? '首診 First Visit' : '覆診 Follow-up Visit'}</p>
          </div>

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

          <div className="rounded-2xl border border-primary/15 bg-primary-light/40 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {selectedDoctor?.doctorNameZh} @ {selectedClinic?.clinicNameZh}
            </p>
            <p className="mt-1">
              {formatDateForDisplay(selectedDate)} {selectedTime}
            </p>
            <p className="mt-1">{visitType === 'first' ? '首診 First Visit' : '覆診 Follow-up Visit'}</p>
          </div>

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
                  placeholder="Tai Man"
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
                  placeholder="Chan"
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
                placeholder="98765432"
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
                placeholder="email@example.com"
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
                  <option value="no">不用 No</option>
                  <option value="yes_insurance">是，保險索償 Yes for insurance</option>
                  <option value="yes_not_insurance">是，但非保險 Yes not for insurance</option>
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
                  <option value="none">不需要 None</option>
                  <option value="lalamove">Lalamove</option>
                  <option value="sfexpress">順豐 SF Express</option>
                  <option value="clinic_pickup">診所自取 Clinic Pickup</option>
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
                    <option value="male">男 Male</option>
                    <option value="female">女 Female</option>
                    <option value="other">其他 Other</option>
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
              成功預約後會收到確認電郵通知；更改或取消可使用電郵內連結。
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
                  預約處理中...
                </>
              ) : (
                '確認預約'
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
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-800">預約成功</h2>
            <p className="text-sm text-slate-500">確認電郵將發送到你提供的信箱。</p>
            <p
              className="mt-4 text-[14px] leading-[1.8] text-slate-400"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              「每一次回來，身體都記得。」
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p>
              <strong>醫師：</strong> {selectedDoctor?.doctorNameZh}
            </p>
            <p>
              <strong>診所：</strong> {selectedClinic?.clinicNameZh}
            </p>
            <p>
              <strong>時間：</strong> {formatDateForDisplay(selectedDate)} {selectedTime}
            </p>
            {bookingId ? (
              <p>
                <strong>預約編號：</strong> {bookingId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startAnotherBooking}
              className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              再預約一個時段
            </button>

            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              返回聊天頁
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
