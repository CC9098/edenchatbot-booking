'use client';

import { bookingFeedback, bookingText, type BookingLocale } from '@/shared/booking-locale';

import Image from 'next/image';
import { parseBookingDate } from '@/lib/booking-search-params';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  bookingDatesBetween,
  earliestAvailabilitySummary,
  scanBookingOverview,
  type EarliestAvailabilitySummary,
} from '@/lib/booking-availability-overview';
import {
  BOOKING_PICKUP_LABELS,
  getBookingPickupOptions,
  isClinicPickupBookingPickup,
  isShippingBookingPickup,
  type BookingPickupType,
} from '@/shared/booking-pickup';
import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';
import {
  formatBookingTreatmentOptionLabel,
  type BookingTreatmentOption,
  type BookingTreatmentOptionId,
} from '@/shared/booking-treatment-options';
import {
  type BookingVisitOption,
  type ClinicId,
  type DoctorId,
} from '@/shared/clinic-data';
import type { TimeRange, WeeklySchedule } from '@/shared/schedule-config';
import {
  PatientProfileSelector,
  splitHkDisplayName,
} from '@/components/booking/PatientProfileSelector';
import type { PatientProfile } from '@/app/api/patient-profiles/route';
import { trackEvent } from '@/lib/analytics';

type BookingStep = 'setup' | 'timeslot' | 'details' | 'success';
type FlowVariant = 'whatsapp' | 'staff';
type BookingPresentationVariant = 'default' | 'minimalPreview';
type VisitType = 'first' | 'followup';
type ReceiptType = 'no' | 'yes_insurance' | 'yes_not_insurance';
type GenderType = '' | 'male' | 'female' | 'other';
type BookingPickupSelection = '' | BookingPickupType;

type BookingFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  treatmentOtherDetails: string;
  needReceipt: ReceiptType;
  medicationPickup: BookingPickupSelection;
  shippingAddressDetails: string;
  clinicPickupRemarks: string;
  dateOfBirth: string;
  gender: GenderType;
  allergies: string;
  medications: string;
  symptoms: string;
  referralSource: string;
};

type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;
type ClinicAvailabilityState = 'available' | 'unavailable' | 'unknown';
type MonthClinicAvailability = Record<
  string,
  Partial<Record<ClinicId, ClinicAvailabilityState>>
>;
type AvailabilityRequestResult = {
  slots: string[];
  isClosedDay: boolean;
  status: ClinicAvailabilityState;
  errorMessage?: string;
  calendarUnavailable?: boolean;
};

type BookingTabFlowProps = {
  locale?: BookingLocale;
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
    gad7Score?: number;
    source?: string;
    date?: string;
  };
  staffPatientUserId?: string | null;
  initialPatientProfileId?: string | null;
  embedMode?: boolean;
  flowVariant?: FlowVariant;
  presentationVariant?: BookingPresentationVariant;
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_SLOT_DURATION_MINUTES = 15;
const MAX_BOOKING_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const WEEKDAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;
const WEEKDAY_SHORT_LABELS_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const;
const OTHER_TREATMENT_OPTION_ID: BookingTreatmentOptionId = 'other';
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

const UNAVAILABLE_DOT_CLASS_NAME = 'bg-slate-300';

const INITIAL_FORM_VALUES: BookingFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  treatmentOtherDetails: '',
  needReceipt: 'no',
  medicationPickup: '',
  shippingAddressDetails: '',
  clinicPickupRemarks: '',
  dateOfBirth: '',
  gender: '',
  allergies: '',
  medications: '',
  symptoms: '',
  referralSource: '',
};

function buildInitialFormValues(
  initialContact?: BookingTabFlowProps['initialContact'],
  initialSelection?: BookingTabFlowProps['initialSelection'], locale: BookingLocale = 'zh'
): BookingFormValues {
  const gad7Symptoms =
    typeof initialSelection?.gad7Score === 'number'
      ? bookingText("GAD-7 焦慮量表：{0}/21。主要困擾：長期擔心、緊張、失眠或身體繃緊，想由張敏言醫師評估。", locale, [initialSelection.gad7Score])
      : '';

  if (!initialContact) {
    return { ...INITIAL_FORM_VALUES, symptoms: gad7Symptoms };
  }

  const contactPrefill = buildBookingContactPrefill(initialContact);

  return {
    ...INITIAL_FORM_VALUES,
    firstName: contactPrefill.firstName,
    lastName: contactPrefill.lastName,
    phone: contactPrefill.phone,
    email: contactPrefill.email,
    symptoms: gad7Symptoms,
  };
}

function toIsoDateInHongKong(date: Date, locale: BookingLocale = 'zh'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayIsoInHongKong(locale: BookingLocale = 'zh'): string {
  return toIsoDateInHongKong(new Date(), locale);
}

function getMaxDateIsoInHongKong(daysAhead: number, locale: BookingLocale = 'zh'): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toIsoDateInHongKong(date, locale);
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

function formatShortDate(dateIso: string, locale: BookingLocale = 'zh'): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat((locale === 'en' ? 'en-HK' : 'zh-HK'), {
    timeZone: HONG_KONG_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function formatSelectedTreatments(
  treatmentOptions: BookingTreatmentOption[],
  treatmentOtherDetails?: string, locale: BookingLocale = 'zh'
): string {
  const normalizedOtherDetails = treatmentOtherDetails?.trim();

  return treatmentOptions
    .map((option) => {
      const label = (locale === 'en' ? option.labelEn : formatBookingTreatmentOptionLabel(option));
      if (option.id === OTHER_TREATMENT_OPTION_ID && normalizedOtherDetails) {
        return `${label}: ${normalizedOtherDetails}`;
      }
      return label;
    })
    .join(locale === 'en' ? ', ' : '、');
}

async function requestAvailabilityForDoctor(
  targetDoctorId: DoctorId,
  targetClinicId: ClinicId,
  dateIso: string,
  durationMinutes: number,
  targetVisitType: VisitType,
  locale: BookingLocale = 'zh'
): Promise<AvailabilityRequestResult> {
  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doctorId: targetDoctorId,
        clinicId: targetClinicId,
        date: dateIso,
        durationMinutes,
        visitType: targetVisitType,
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
          errorMessage: bookingText("暫時未能連接預約日曆，請稍後再試或在聊天頁由姑娘協助安排。", locale),
        };
      }

      return {
        slots: [],
        isClosedDay: false,
        status: 'unknown',
        errorMessage: data?.error || bookingText("暫時未能讀取可預約時段，請稍後再試。", locale),
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
      errorMessage: bookingText("載入時段失敗，請稍後再試。", locale),
    };
  }
}

function getSlotDurationLabel(durationMinutes: number, locale: BookingLocale = 'zh'): string {
  return bookingText("每個時段 {0} 分鐘", locale, [durationMinutes]);
}

function getVisitOptionDurationLabel(option?: BookingVisitOption, locale: BookingLocale = 'zh'): string | null {
  if (!option || option.hideDurationLabel) return null;
  return getSlotDurationLabel(option.durationMinutes, locale);
}

function formatHkdPrice(price?: number, locale: BookingLocale = 'zh'): string {
  if (typeof price !== 'number') return '';
  return `HK$${price.toLocaleString('en-HK')}`;
}

function hasVisitSpecificServices(
  doctor?: Pick<BookableDoctorSchedule, 'bookingVisitOptions'>, locale: BookingLocale = 'zh'
): boolean {
  return Boolean(doctor?.bookingVisitOptions.length);
}

function getVisitOptionPriceLabel(option?: BookingVisitOption, locale: BookingLocale = 'zh'): string | null {
  if (!option?.priceHkd) return null;

  const priceLabel = formatHkdPrice(option.priceHkd, locale);
  if (option.originalPriceHkd && option.originalPriceHkd > option.priceHkd) {
    return bookingText("{0}（原價 {1}）", locale, [priceLabel, formatHkdPrice(option.originalPriceHkd, locale)]);
  }

  return priceLabel;
}

function formatVisitOptionSummary(option?: BookingVisitOption, locale: BookingLocale = 'zh'): string | null {
  if (!option) return null;

  const serviceLabel = locale === 'en' ? option.serviceNameEn : `${option.serviceNameZh} ${option.serviceNameEn}`;
  const priceLabel = getVisitOptionPriceLabel(option, locale);
  return [serviceLabel, priceLabel, getVisitOptionDurationLabel(option, locale)]
    .filter(Boolean)
    .join('．');
}

function compactDetails(details: Array<string | null | undefined | false>, locale: BookingLocale = 'zh'): string[] {
  return details.filter((detail): detail is string => Boolean(detail));
}

function isSupportBookingDoctor(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>, locale: BookingLocale = 'zh'
): boolean {
  return doctor?.bookingPractitionerGroup === 'support';
}

function formatDoctorOptionLabel(
  doctor: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'doctorNameEn' | 'bookingPractitionerGroup' | 'bookingRoleLabel'>, locale: BookingLocale = 'zh'
): string {
  const suffix = isSupportBookingDoctor(doctor, locale) ? ` - ${bookingText(doctor.bookingRoleLabel, locale)}` : '';
  return locale === 'en' ? `${bookingText(doctor.doctorNameZh, locale)}${bookingText(suffix, locale)}` : `${doctor.doctorNameZh} (${doctor.doctorNameEn})${suffix}`;
}

function getSelectedScheduleEyebrow(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>, locale: BookingLocale = 'zh'
): string {
  return isSupportBookingDoctor(doctor, locale) ? bookingText("協作脊醫時段", locale) : bookingText("醫師應診時間", locale);
}

function getSelectedSummaryEyebrow(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>, locale: BookingLocale = 'zh'
): string {
  return isSupportBookingDoctor(doctor, locale) ? bookingText("已選協作服務", locale) : bookingText("已選醫師", locale);
}

function padTwo(value: number, locale: BookingLocale = 'zh'): string {
  return String(value).padStart(2, '0');
}

function toMonthKeyInHongKong(date: Date, locale: BookingLocale = 'zh'): string {
  return toIsoDateInHongKong(date, locale).slice(0, 7);
}

function toMonthKeyFromIsoDate(dateIso: string, locale: BookingLocale = 'zh'): string {
  return dateIso.slice(0, 7);
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

function formatTimeRanges(ranges: TimeRange[], locale: BookingLocale = 'zh'): string {
  return ranges.map((range) => `${range.start}-${range.end}`).join(locale === 'en' ? ', ' : '，');
}

function formatScheduleLines(schedule: WeeklySchedule, locale: BookingLocale = 'zh'): string[] {
  const lines: string[] = [];

  for (let day = 0; day <= 6; day += 1) {
    const ranges = schedule[day];
    if (!ranges || ranges.length === 0) continue;
    lines.push(`${bookingText(WEEKDAY_LABELS_ZH[day], locale)}：${formatTimeRanges(ranges, locale)}`);
  }

  return lines;
}

function formatCompactTimeRanges(ranges: TimeRange[], locale: BookingLocale = 'zh'): string {
  return ranges.map((range) => `${range.start}-${range.end}`).join(' / ');
}

function formatCompactWeekdays(days: number[], locale: BookingLocale = 'zh'): string {
  if (days.length === 0) return '';

  const sortedDays = [...days].sort((left, right) => left - right);
  const chunks: number[][] = [];
  let currentChunk: number[] = [];

  for (const day of sortedDays) {
    const previousDay = currentChunk[currentChunk.length - 1];
    if (currentChunk.length === 0 || day === previousDay + 1) {
      currentChunk.push(day);
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = [day];
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const labels = chunks.map((chunk) => {
    if (chunk.length >= 3) {
      return bookingText("{0}至{1}", locale, [bookingText(WEEKDAY_SHORT_LABELS_ZH[chunk[0]], locale), bookingText(WEEKDAY_SHORT_LABELS_ZH[chunk[chunk.length - 1]], locale)]);
    }

    return chunk.map((day) => bookingText(WEEKDAY_SHORT_LABELS_ZH[day], locale)).join(locale === 'en' ? ', ' : '、');
  });

  return bookingText("週{0}", locale, [labels.join(locale === 'en' ? ', ' : '、')]);
}

function formatCompactClinicSchedule(
  clinic: BookableDoctorSchedule['clinics'][number], locale: BookingLocale = 'zh'
): string {
  const groupedByTime = new Map<string, number[]>();

  for (let day = 0; day <= 6; day += 1) {
    const ranges = clinic.schedule[day];
    if (!ranges || ranges.length === 0) continue;

    const timeLabel = formatCompactTimeRanges(ranges, locale);
    groupedByTime.set(timeLabel, [...(groupedByTime.get(timeLabel) ?? []), day]);
  }

  return Array.from(groupedByTime.entries())
    .map(([timeLabel, days]) => `${formatCompactWeekdays(days, locale)} ${timeLabel}`)
    .join('；');
}

function getCompactSchedulePreviewClinics(doctor: BookableDoctorSchedule, locale: BookingLocale = 'zh') {
  const physicalClinics = doctor.clinics.filter((clinic) => clinic.clinicId !== 'online');
  return physicalClinics.length > 0 ? physicalClinics : doctor.clinics;
}

function formatNoticeClinicList(notices: Array<{ clinicNameZh?: string }>, locale: BookingLocale = 'zh'): string {
  const clinicNames = Array.from(
    new Set(
      notices
        .map((notice) => bookingText(notice.clinicNameZh?.trim(), locale))
        .filter((clinicName): clinicName is string => Boolean(clinicName))
    )
  );

  if (clinicNames.length === 0) return '';
  if (clinicNames.length <= 3) return clinicNames.join(locale === 'en' ? ', ' : '、');
  return bookingText("{0}等診所", locale, [clinicNames.slice(0, 3).join(locale === 'en' ? ', ' : '、')]);
}

function getDoctorHolidaySummaryLines(
  doctor: Pick<BookableDoctorSchedule, 'doctorNameZh'>,
  notices: Array<{ clinicNameZh?: string }>, locale: BookingLocale = 'zh'
): string[] {
  const clinicList = formatNoticeClinicList(notices, locale);
  const clinicScope = clinicList ? bookingText("於{0}", locale, [clinicList]) : '';

  return [
    bookingText("{0}{1}近日有休診或特別安排，已反映在下方日曆。", locale, [bookingText(doctor.doctorNameZh, locale), clinicScope]),
    bookingText("你只需選可約日子；休診日不會開放預約。", locale),
  ];
}

function CompactScheduleSummaryCard({ locale = 'zh', 
  doctor,
  className = '',
}: { locale?: BookingLocale; 
  doctor: BookableDoctorSchedule;
  className?: string;
}) {
  return (
    <div className={`w-full rounded-xl border border-[#e2efe4] bg-[#f7fbf8] px-3 py-3 text-xs leading-relaxed text-slate-600 sm:max-w-[20rem] sm:shrink-0 ${className}`}>
      <p className="font-semibold text-[#254430]">{bookingText("應診時間", locale)}</p>
      <div className="mt-2 space-y-1.5">
        {getCompactSchedulePreviewClinics(doctor, locale).map((clinic) => (
          <p
            key={`compact-schedule-${doctor.doctorId}-${clinic.clinicId}`}
            className="grid grid-cols-[2.75rem_1fr] gap-2"
          >
            <span className="font-semibold text-[#5d8c67]">{bookingText(clinic.clinicNameZh, locale)}</span>
            <span>{formatCompactClinicSchedule(clinic, locale)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function getDoctorAvatarFallback(nameZh?: string, locale: BookingLocale = 'zh'): string {
  return nameZh?.trim().slice(0, 1) || bookingText("醫", locale);
}

function DoctorAvatar({ locale = 'zh', 
  doctor,
  size = 'sm',
}: { locale?: BookingLocale; 
  doctor?: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'avatarSrc' | 'avatarObjectPosition'>;
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
          alt={bookingText("{0}頭像", locale, [bookingText(doctor.doctorNameZh, locale)])}
          fill
          sizes={isLarge ? '112px' : '56px'}
          className="object-cover"
          style={{ objectPosition: doctor.avatarObjectPosition || 'center' }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#eaf8ed_0%,#cfe8d6_100%)] text-lg font-semibold text-[#2b5d38]">
          {getDoctorAvatarFallback(bookingText(doctor?.doctorNameZh, locale), locale)}
        </div>
      )}
    </div>
  );
}

function DoctorBookingSummary({ locale = 'zh', 
  doctor,
  clinicNameZh,
  eyebrow,
  details,
}: { locale?: BookingLocale; 
  doctor?: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'avatarSrc' | 'avatarObjectPosition'>;
  clinicNameZh?: string;
  eyebrow: string;
  details: string[];
}) {
  return (
    <div className="rounded-[24px] border border-[#d5e4d8] bg-[linear-gradient(135deg,#f8fcf8_0%,#eef8f0_55%,#ffffff_100%)] p-4 text-left shadow-[0_16px_36px_-30px_rgba(31,74,44,0.45)]">
      <div className="flex items-center gap-3">
        <DoctorAvatar doctor={doctor} size="sm" locale={locale} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-[#5d8c67]">{eyebrow}</p>
          <p className="mt-1 truncate text-base font-semibold text-[#254430]">{bookingText(doctor?.doctorNameZh, locale) || bookingText("已選醫師", locale)}</p>
          <p className="truncate text-xs text-slate-500">{clinicNameZh || bookingText("請選擇診所", locale)}</p>
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

export function BookingTabFlow({ locale = 'zh', 
  doctors,
  initialContact,
  initialSelection,
  staffPatientUserId,
  initialPatientProfileId,
  embedMode = false,
  flowVariant = 'whatsapp',
  presentationVariant = 'default',
}: BookingTabFlowProps) {
  const isWhatsappFlow = flowVariant === 'whatsapp';
  const isStaffFlow = flowVariant === 'staff';
  const isMinimalPreview = presentationVariant === 'minimalPreview';
  const [step, setStep] = useState<BookingStep>('setup');
  const [visitType, setVisitType] = useState<VisitType>(initialSelection?.visitType ?? 'first');
  const [doctorId, setDoctorId] = useState<DoctorId | ''>(initialSelection?.doctorId ?? '');
  const [clinicId, setClinicId] = useState<ClinicId | ''>(initialSelection?.clinicId ?? '');
  const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState<BookingTreatmentOptionId[]>([]);

  const [selectedDate, setSelectedDate] = useState('');
  const initialDateConsumedRef = useRef(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKeyInHongKong(new Date(), locale));
  const [monthClinicAvailability, setMonthClinicAvailability] = useState<MonthClinicAvailability>(
    {}
  );
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false);
  const [earliestDatesLoading, setEarliestDatesLoading] = useState(false);
  const [bookableDatesError, setBookableDatesError] = useState('');
  // Availability already read for the current doctor/visit type, reused when switching months.
  const availabilityCacheRef = useRef<{ key: string; data: MonthClinicAvailability }>({
    key: '',
    data: {},
  });

  const [formValues, setFormValues] = useState<BookingFormValues>(() =>
    buildInitialFormValues(initialContact, initialSelection, locale)
  );
  const [formErrors, setFormErrors] = useState<BookingFormErrors>({});
  const previousClinicIdRef = useRef<ClinicId | ''>(initialSelection?.clinicId ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [whatsappSent, setWhatsappSent] = useState<boolean | null>(null);
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<string | null>(
    initialPatientProfileId ?? null,
  );

  const minDate = getTodayIsoInHongKong(locale);
  const maxDate = getMaxDateIsoInHongKong(MAX_BOOKING_WINDOW_DAYS, locale);
  const bookingDates = useMemo(() => bookingDatesBetween(minDate, maxDate), [minDate, maxDate]);

  const doctorOptions = useMemo(
    () => doctors,
    [doctors]
  );
  const primaryDoctorOptions = useMemo(
    () => doctorOptions.filter((doctor) => !isSupportBookingDoctor(doctor, locale)),
    [doctorOptions, locale]
  );
  const supportDoctorOptions = useMemo(
    () => doctorOptions.filter((doctor) => isSupportBookingDoctor(doctor, locale)),
    [doctorOptions, locale]
  );

  const clinicOptions = useMemo(() => {
    if (!doctorId) return [];
    return doctorOptions.find((doctor) => doctor.doctorId === doctorId)?.clinics ?? [];
  }, [doctorId, doctorOptions]);

  const selectedDoctor = useMemo(
    () => doctorOptions.find((doctor) => doctor.doctorId === doctorId),
    [doctorId, doctorOptions]
  );
  const usesVisitBasedServices = hasVisitSpecificServices(selectedDoctor, locale);
  const selectedVisitOption = useMemo(
    () =>
      selectedDoctor?.bookingVisitOptions.find(
        (option) => option.visitType === visitType
      ),
    [selectedDoctor, visitType]
  );
  const firstVisitOption = useMemo(
    () =>
      selectedDoctor?.bookingVisitOptions.find(
        (option) => option.visitType === 'first'
      ),
    [selectedDoctor]
  );
  const followupVisitOption = useMemo(
    () =>
      selectedDoctor?.bookingVisitOptions.find(
        (option) => option.visitType === 'followup'
      ),
    [selectedDoctor]
  );
  const selectedDoctorSummaryEyebrow = getSelectedSummaryEyebrow(selectedDoctor, locale);
  const selectedDoctorNotices = useMemo(() => {
    if (!selectedDoctor) return [];

    const notices: Array<{
      id: string;
      text: string;
      clinicId?: ClinicId;
      clinicNameZh?: string;
    }> = [];

    for (const notice of selectedDoctor.bookingNotices ?? []) {
      if (clinicId && notice.clinicId && notice.clinicId !== clinicId) {
        continue;
      }

      notices.push(notice);
    }

    return notices;
  }, [clinicId, selectedDoctor]);
  const selectedClinic = useMemo(
    () => clinicOptions.find((clinic) => clinic.clinicId === clinicId),
    [clinicId, clinicOptions]
  );
  const isOnlineConsultation = clinicId === 'online';
  const availableTreatmentOptions = !isOnlineConsultation
    && !usesVisitBasedServices
    ? selectedDoctor?.bookingTreatmentOptions ?? []
    : [];
  const selectedTreatmentDetails = useMemo(() => {
    if (!selectedDoctor || isOnlineConsultation || usesVisitBasedServices) return [];

    const treatmentOptionById = new Map(
      selectedDoctor.bookingTreatmentOptions.map((option) => [option.id, option] as const)
    );

    return selectedTreatmentOptions
      .map((optionId) => treatmentOptionById.get(optionId))
      .filter((option): option is BookingTreatmentOption => Boolean(option));
  }, [isOnlineConsultation, selectedDoctor, selectedTreatmentOptions, usesVisitBasedServices]);
  const selectedTreatmentSummary = selectedTreatmentDetails.length > 0
    ? formatSelectedTreatments(selectedTreatmentDetails, formValues.treatmentOtherDetails, locale)
    : '';
  const treatmentSummaryDetail = isOnlineConsultation
    ? null
    : selectedTreatmentSummary
      ? bookingText("已選治療項目：{0}", locale, [selectedTreatmentSummary])
      : selectedDoctor
        ? isMinimalPreview
          ? null
          : bookingText("治療項目：未指定（可留待到診時再確認）", locale)
        : null;
  const availableTreatmentSummaryDetail =
    !isMinimalPreview && selectedDoctor && !usesVisitBasedServices
      ? null
      : null;
  const selectedVisitOptionSummary = formatVisitOptionSummary(selectedVisitOption, locale);
  const pickupOptions = useMemo(
    () => getBookingPickupOptions(clinicId),
    [clinicId]
  );
  const needsShippingAddressDetails =
    isOnlineConsultation && isShippingBookingPickup(formValues.medicationPickup);
  const needsClinicPickupRemarks =
    isOnlineConsultation && isClinicPickupBookingPickup(formValues.medicationPickup);
  const needsTreatmentOtherDetails =
    !isOnlineConsultation
    && !usesVisitBasedServices
    && selectedTreatmentOptions.includes(OTHER_TREATMENT_OPTION_ID);
  const selectedDoctorSlotMinutes =
    selectedVisitOption?.durationMinutes
    ?? selectedDoctor?.bookingSlotMinutes
    ?? DEFAULT_SLOT_DURATION_MINUTES;
  const selectedDoctorVisitOptionsHideDurations =
    Boolean(selectedDoctor?.bookingVisitOptions.length)
    && selectedDoctor?.bookingVisitOptions.every((option) => option.hideDurationLabel);
  const selectedDoctorSlotDurationLabel =
    usesVisitBasedServices
    && (selectedVisitOption?.hideDurationLabel ?? selectedDoctorVisitOptionsHideDurations)
      ? null
      : getSlotDurationLabel(selectedDoctorSlotMinutes, locale);
  const onlineConsultationMethodNotice =
    isOnlineConsultation && selectedDoctor?.doctorId === 'cheung'
      ? bookingText("{0}網上診症會使用 Google Meet 視像。預約成功後，系統會透過 WhatsApp 發送網上診症入口；到時按連結進入即可。", locale, [bookingText(selectedDoctor.doctorNameZh, locale)])
      : '';
  const onlineConsultationMethodDetail = onlineConsultationMethodNotice
    ? bookingText("視像方式：Google Meet；預約成功後 WhatsApp 會收到網上診症入口。", locale)
    : null;
  const groupBookingNotice = '';
  const scannableClinics = useMemo(
    () => selectedDoctor?.clinics ?? [],
    [selectedDoctor]
  );
  const visibleClinics = useMemo(
    () =>
      clinicId
        ? scannableClinics.filter((clinic) => clinic.clinicId === clinicId)
        : scannableClinics,
    [clinicId, scannableClinics]
  );
  const pageTitle = isStaffFlow ? bookingText("姑娘代約", locale) : bookingText("預約服務", locale);
  const pageSubtitle = isStaffFlow
    ? bookingText("供姑娘或前台代病人安排時段。成功後系統會優先透過 WhatsApp 發送確認訊息，若有電郵則會一併寄出確認電郵。", locale)
    : isMinimalPreview
    ? ''
    : isWhatsappFlow
    ? bookingText("成功預約後，診所會透過 WhatsApp 發送確認訊息到你提供的電話。", locale)
    : bookingText("「每一次預約，都是照顧自己的開始。」", locale);
  const submitButtonLabel = bookingText("確認預約", locale);
  const submitLoadingLabel = isStaffFlow ? bookingText("代約處理中...", locale) : bookingText("預約處理中...", locale);
  const confirmationNotice = isStaffFlow
    ? bookingText("此頁會以病人資料建立正式預約，並嘗試即時發送 WhatsApp 確認。若病人已有電郵，系統亦會補發確認電郵。", locale)
    : groupBookingNotice
    ? groupBookingNotice
    : isWhatsappFlow
    ? bookingText("成功預約後會透過 WhatsApp 發送確認訊息到你提供的電話。", locale)
    : bookingText("如有提供電郵，系統會發送確認電郵；更改或取消可使用電郵內連結。", locale);
  const detailNotice = onlineConsultationMethodNotice
    ? `${onlineConsultationMethodNotice} ${confirmationNotice}`
    : confirmationNotice;
  const successTitle = isStaffFlow ? bookingText("代約完成", locale) : bookingText("預約成功", locale);
  const successDescription = isStaffFlow
    ? bookingText("預約已建立，系統已嘗試發送確認訊息到病人提供的聯絡方式。", locale)
    : groupBookingNotice
    ? groupBookingNotice
    : onlineConsultationMethodNotice
    ? bookingText("預約已建立，Google Meet 網上診症入口會隨 WhatsApp 確認訊息發送到你提供的電話。", locale)
    : isWhatsappFlow
    ? bookingText("預約已建立，診所會透過 WhatsApp 跟進並發送確認訊息到你提供的電話。", locale)
    : formValues.email.trim()
      ? bookingText("確認電郵將發送到你提供的信箱。", locale)
      : bookingText("預約已建立；如需更改或取消，請聯絡診所跟進。", locale);
  const successQuote = isStaffFlow ? bookingText("「資料確認得愈完整，跟進就愈穩陣。」", locale) : bookingText("「每一次回來，身體都記得。」", locale);
  const referenceLabel = bookingText("預約編號", locale);

  const canContinueSetup = Boolean(doctorId && visitType);
  const canContinueTimeslot = Boolean(selectedDate && selectedTime && clinicId);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1, locale);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1, locale);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate, locale);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate, locale);
  const hasAutofilledContact = Boolean(
    initialContact?.displayName || initialContact?.email || initialContact?.phone
  );

  function getClinicsForFilter(filterClinicId: ClinicId | '' = clinicId) {
    if (!filterClinicId) return scannableClinics;
    return scannableClinics.filter((clinic) => clinic.clinicId === filterClinicId);
  }

  function isDateFullyUnavailable(dateIso: string, filterClinicId: ClinicId | '' = clinicId) {
    const clinics = getClinicsForFilter(filterClinicId);
    if (clinics.length === 0) return false;

    const dateAvailability = monthClinicAvailability[dateIso] ?? {};
    return clinics.every((clinic) => dateAvailability[clinic.clinicId] === 'unavailable');
  }

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
    () => formatMonthLabel(calendarMonthKey, locale),
    [calendarMonthKey, locale]
  );

  const calendarCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(calendarMonthKey, locale);
    const leadingEmptyCellCount = getWeekdayIndexMondayFirst(
      isoDateFromMonthDay(calendarMonthKey, 1, locale), locale
    );
    const totalCellCount = Math.ceil((leadingEmptyCellCount + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCellCount }, (_, index) => {
      const day = index - leadingEmptyCellCount + 1;
      if (day < 1 || day > daysInMonth) return null;

      const dateIso = isoDateFromMonthDay(calendarMonthKey, day, locale);
      const dateAvailability = monthClinicAvailability[dateIso] ?? {};
      const availableClinicIds = visibleClinics
        .filter((clinic) => dateAvailability[clinic.clinicId] === 'available')
        .map((clinic) => clinic.clinicId);
      const hasUnknownAvailability = visibleClinics.some((clinic) => {
        const state = dateAvailability[clinic.clinicId];
        return typeof state === 'undefined' || state === 'unknown';
      });
      const isUnavailable =
        visibleClinics.length > 0 && availableClinicIds.length === 0 && !hasUnknownAvailability;
      const availableClinicNames = visibleClinics
        .filter((clinic) => availableClinicIds.includes(clinic.clinicId))
        .map((clinic) => bookingText(clinic.clinicNameZh, locale));

      return {
        dateIso,
        day,
        isSelectable: dateIso >= minDate && dateIso <= maxDate,
        availableClinicIds,
        isUnavailable,
        availabilityLabel:
          availableClinicNames.length > 0
            ? bookingText("{0}有位", locale, [availableClinicNames.join(locale === 'en' ? ', ' : '、')])
            : isUnavailable
              ? clinicId
                ? bookingText("{0}暫滿", locale, [bookingText(visibleClinics[0]?.clinicNameZh || '所選診所', locale)])
                : bookingText("所有診所暫滿", locale)
              : bookingText("正在掃描時段", locale),
      };
    });
  }, [calendarMonthKey, clinicId, maxDate, minDate, monthClinicAvailability, visibleClinics, locale]);

  const clinicEarliestSummaries = useMemo<Partial<Record<ClinicId, EarliestAvailabilitySummary>>>(
    () =>
      Object.fromEntries(
        scannableClinics.map((clinic) => [
          clinic.clinicId,
          earliestAvailabilitySummary(
            bookingDates,
            (dateIso) => monthClinicAvailability[dateIso]?.[clinic.clinicId],
            earliestDatesLoading,
            locale
          ),
        ])
      ),
    [bookingDates, earliestDatesLoading, monthClinicAvailability, scannableClinics, locale]
  );

  const selectedDateAllAvailableClinics = useMemo(() => {
    if (!selectedDate) return [];

    const dateAvailability = monthClinicAvailability[selectedDate] ?? {};
    return scannableClinics.filter((clinic) => dateAvailability[clinic.clinicId] === 'available');
  }, [monthClinicAvailability, scannableClinics, selectedDate]);

  const selectedDateVisibleAvailableClinics = useMemo(() => {
    if (!selectedDate) return [];

    const dateAvailability = monthClinicAvailability[selectedDate] ?? {};
    return visibleClinics.filter((clinic) => dateAvailability[clinic.clinicId] === 'available');
  }, [monthClinicAvailability, selectedDate, visibleClinics]);

  useEffect(() => {
    if (!doctorId || scannableClinics.length === 0) {
      setMonthClinicAvailability({});
      setBookableDatesLoading(false);
      setEarliestDatesLoading(false);
      setBookableDatesError('');
      return;
    }

    const clinicIds = scannableClinics.map((clinic) => clinic.clinicId);
    const cacheKey = [
      doctorId,
      visitType,
      selectedDoctorSlotMinutes,
      clinicIds.join(','),
      bookingDates[0] ?? '',
      bookingDates[bookingDates.length - 1] ?? '',
    ].join('|');
    if (availabilityCacheRef.current.key !== cacheKey) {
      availabilityCacheRef.current = { key: cacheKey, data: {} };
    }

    const known = availabilityCacheRef.current.data;
    setMonthClinicAvailability(known);
    setBookableDatesError('');

    if (bookingDates.length === 0) {
      setBookableDatesLoading(false);
      setEarliestDatesLoading(false);
      return;
    }

    let isCancelled = false;
    setBookableDatesLoading(true);
    setEarliestDatesLoading(true);

    const visibleMonthPrefix = `${calendarMonthKey}-`;
    const hasPartialRead = (dates: string[]) =>
      dates.some((dateIso) =>
        Object.values(availabilityCacheRef.current.data[dateIso] ?? {}).includes('unknown')
      );
    const partialReadMessage = bookingText('暫時未能完整讀取預約日曆，彩色燈號可能未完全顯示。', locale);

    const scanBookableDates = async () => {
      await scanBookingOverview({
        dates: bookingDates,
        clinics: clinicIds,
        known,
        isPriorityDate: (dateIso) => dateIso.startsWith(visibleMonthPrefix),
        isCancelled: () => isCancelled,
        request: async (dateIso, targetClinicId) => {
          const result = await requestAvailabilityForDoctor(
            doctorId, targetClinicId, dateIso, selectedDoctorSlotMinutes, visitType, locale
          );
          return result.status;
        },
        onResult: (dateIso, targetClinicId, state) => {
          if (availabilityCacheRef.current.key !== cacheKey) return;
          const cache = availabilityCacheRef.current.data;
          availabilityCacheRef.current.data = {
            ...cache,
            [dateIso]: { ...(cache[dateIso] ?? {}), [targetClinicId]: state },
          };
          if (!isCancelled) setMonthClinicAvailability(availabilityCacheRef.current.data);
        },
        onPriorityComplete: () => {
          if (isCancelled) return;
          setBookableDatesLoading(false);
          setBookableDatesError(
            hasPartialRead(bookingDates.filter((dateIso) => dateIso.startsWith(visibleMonthPrefix)))
              ? partialReadMessage
              : ''
          );
        },
      });

      if (isCancelled) return;

      setBookableDatesLoading(false);
      setEarliestDatesLoading(false);
      setBookableDatesError(hasPartialRead(bookingDates) ? partialReadMessage : '');
    };

    void scanBookableDates();

    return () => {
      isCancelled = true;
    };
  }, [bookingDates, calendarMonthKey, doctorId, scannableClinics, selectedDoctorSlotMinutes, visitType, locale]);

  useEffect(() => {
    const isCurrentPickupAvailable = pickupOptions.some(
      (option) => option.value === formValues.medicationPickup
    );

    if (isCurrentPickupAvailable || formValues.medicationPickup === '') return;

    setFormValues((prev) => ({
      ...prev,
      medicationPickup: isOnlineConsultation ? '' : 'none',
    }));
  }, [formValues.medicationPickup, isOnlineConsultation, pickupOptions]);

  useEffect(() => {
    if (previousClinicIdRef.current === clinicId) return;

    setFormValues((prev) => ({
      ...prev,
      medicationPickup: clinicId === 'online' ? '' : 'none',
      shippingAddressDetails: '',
      clinicPickupRemarks: '',
    }));
    setFormErrors((prev) => ({
      ...prev,
      medicationPickup: undefined,
      shippingAddressDetails: undefined,
      clinicPickupRemarks: undefined,
    }));
    previousClinicIdRef.current = clinicId;
  }, [clinicId]);

  useEffect(() => {
    if (usesVisitBasedServices) {
      setSelectedTreatmentOptions((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    if (!selectedDoctor) {
      setSelectedTreatmentOptions((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    const availableOptionIds = new Set(
      selectedDoctor.bookingTreatmentOptions.map((option) => option.id)
    );

    setSelectedTreatmentOptions((prev) => {
      const next = prev.filter((optionId) => availableOptionIds.has(optionId));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedDoctor, usesVisitBasedServices]);

  useEffect(() => {
    if (!isOnlineConsultation) return;

    setSelectedTreatmentOptions((prev) => (prev.length > 0 ? [] : prev));
    setFormValues((prev) => (
      prev.treatmentOtherDetails
        ? { ...prev, treatmentOtherDetails: '' }
        : prev
    ));
    setFormErrors((prev) => (
      prev.treatmentOtherDetails
        ? { ...prev, treatmentOtherDetails: undefined }
        : prev
    ));
  }, [isOnlineConsultation]);

  useEffect(() => {
    if (selectedTreatmentOptions.includes(OTHER_TREATMENT_OPTION_ID)) return;

    setFormValues((prev) => (
      prev.treatmentOtherDetails
        ? { ...prev, treatmentOtherDetails: '' }
        : prev
    ));
    setFormErrors((prev) => (
      prev.treatmentOtherDetails
        ? { ...prev, treatmentOtherDetails: undefined }
        : prev
    ));
  }, [selectedTreatmentOptions]);

  function clearSelectedTimeslot(keepDate = false) {
    if (!keepDate) {
      setSelectedDate('');
    }
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotsLoading(false);
    setSlotError('');
  }

  function resetAvailabilityOverview() {
    setCalendarMonthKey(toMonthKeyInHongKong(new Date(), locale));
    setMonthClinicAvailability({});
    setBookableDatesLoading(false);
    setBookableDatesError('');
  }

  function resetSlotState() {
    clearSelectedTimeslot();
    resetAvailabilityOverview();
  }

  function resetSubmissionState() {
    setSubmitError('');
    setIsSubmitting(false);
    setBookingId('');
    setWhatsappSent(null);
  }

  function handleDoctorChange(nextDoctorId: string) {
    setDoctorId(nextDoctorId as DoctorId);
    setClinicId('');
    setStep('setup');
    resetSlotState();
    resetSubmissionState();
  }

  function handleClinicChange(nextClinicId: string) {
    const nextFilter = nextClinicId as ClinicId | '';
    setClinicId(nextFilter);
    resetSubmissionState();

    if (step === 'timeslot') {
      clearSelectedTimeslot(true);

      if (!selectedDate) return;

      if (nextFilter) {
        void fetchAvailability(selectedDate, nextFilter);
        return;
      }

      if (isDateFullyUnavailable(selectedDate, '')) {
        setSlotError(bookingText("所選日期所有診所暫無可預約時段。", locale));
      }
      return;
    }

    setStep('setup');
    clearSelectedTimeslot();
  }

  function handleVisitTypeChange(nextVisitType: VisitType) {
    setVisitType(nextVisitType);
    setStep('setup');
    resetSlotState();
    setFormErrors({});
    setSubmitError('');
  }

  async function fetchAvailability(dateIso: string, targetClinicId?: ClinicId) {
    if (!doctorId || !targetClinicId) return;

    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setSelectedTime('');

    const result = await requestAvailabilityForDoctor(
      doctorId,
      targetClinicId,
      dateIso,
      selectedDoctorSlotMinutes,
      visitType, locale
    );

    setMonthClinicAvailability((prev) => ({
      ...prev,
      [dateIso]: {
        ...(prev[dateIso] ?? {}),
        [targetClinicId]: result.status,
      },
    }));

    if (result.status === 'unknown') {
      setSlotError(
        result.errorMessage || bookingText("暫時未能讀取可預約時段，請稍後再試。", locale)
      );
      setSlotsLoading(false);
      return;
    }

    setAvailableSlots(result.slots);

    if (result.isClosedDay) {
      setSlotError(bookingText("當日休診或公眾假期，請選擇其他日期。", locale));
      setSlotsLoading(false);
      return;
    }

    if (result.slots.length === 0) {
      setSlotError(bookingText("當日暫無可預約時段。", locale));
    }

    setSlotsLoading(false);
  }

  function continueToTimeslot() {
    setStep('timeslot');
    if (initialDateConsumedRef.current) return;
    initialDateConsumedRef.current = true;
    const date = parseBookingDate(initialSelection?.date);
    if (date && date >= minDate && date <= maxDate) {
      handleDateChange(date);
    }
  }

  function handleDateChange(dateIso: string) {
    setSelectedDate(dateIso);
    setCalendarMonthKey(toMonthKeyFromIsoDate(dateIso, locale));
    clearSelectedTimeslot(true);

    if (clinicId) {
      void fetchAvailability(dateIso, clinicId);
      return;
    }

    if (isDateFullyUnavailable(dateIso, '')) {
      setSlotError(bookingText("所選日期所有診所暫無可預約時段。", locale));
    }
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

  function toggleTreatmentOption(optionId: BookingTreatmentOptionId) {
    setSelectedTreatmentOptions((prev) => (
      prev.includes(optionId)
        ? prev.filter((value) => value !== optionId)
        : [...prev, optionId]
    ));
  }

  function validateForm(values: BookingFormValues): BookingFormErrors {
    const nextErrors: BookingFormErrors = {};

    if (!values.firstName.trim()) {
      nextErrors.firstName = bookingText("請輸入名字", locale);
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = bookingText("請輸入姓氏", locale);
    }

    const normalizedPhone = normalizePhoneForSearch(values.phone);
    if (normalizedPhone.length < 8) {
      nextErrors.phone = bookingText("請輸入有效電話（至少 8 位數字）", locale);
    }

    const normalizedEmail = values.email.trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = bookingText("請輸入有效電郵地址", locale);
    }

    if (needsTreatmentOtherDetails && !values.treatmentOtherDetails.trim()) {
      nextErrors.treatmentOtherDetails = bookingText("如選擇其他，請註明服務內容", locale);
    }

    if (isOnlineConsultation && !values.medicationPickup) {
      nextErrors.medicationPickup = bookingText("請選擇取藥方法", locale);
    }

    if (isOnlineConsultation && isShippingBookingPickup(values.medicationPickup) && !values.shippingAddressDetails.trim()) {
      nextErrors.shippingAddressDetails = bookingText("請填寫寄送地址或順豐站／智能櫃資料", locale);
    }

    if (isOnlineConsultation && isClinicPickupBookingPickup(values.medicationPickup) && !values.clinicPickupRemarks.trim()) {
      nextErrors.clinicPickupRemarks = bookingText("請填寫取藥時間或其他備註", locale);
    }

    if (visitType === 'first') {
      if (!values.dateOfBirth.trim()) {
        nextErrors.dateOfBirth = bookingText("首診需要出生日期", locale);
      }

      if (!values.gender) {
        nextErrors.gender = bookingText("首診需要性別資料", locale);
      }

      if (!values.allergies.trim()) {
        nextErrors.allergies = bookingText("首診需要過敏史資料", locale);
      }

      if (!values.medications.trim()) {
        nextErrors.medications = bookingText("首診需要現正服用藥物資料", locale);
      }

      if (!values.symptoms.trim()) {
        nextErrors.symptoms = bookingText("首診需要主要症狀資料", locale);
      }

      if (!values.referralSource.trim()) {
        nextErrors.referralSource = bookingText("首診需要得知來源資料", locale);
      }
    }

    return nextErrors;
  }

  function buildBookingNotes(values: BookingFormValues): string {
    const selectedServiceLine = selectedVisitOption
      ? bookingText("服務: {0} {1}", locale, [selectedVisitOption.serviceNameZh, selectedVisitOption.serviceNameEn])
      : null;
    const selectedPriceLine = selectedVisitOption
      ? [
          selectedVisitOption.promotionLabel,
          getVisitOptionPriceLabel(selectedVisitOption, locale)
            ? bookingText("收費: {0}", locale, [getVisitOptionPriceLabel(selectedVisitOption, locale)])
            : null,
        ].filter(Boolean).join(' | ')
      : null;
    const selectedTreatmentLine = selectedTreatmentDetails.length > 0
      ? bookingText("治療項目: {0}", locale, [formatSelectedTreatments(selectedTreatmentDetails, values.treatmentOtherDetails, locale)])
      : null;
    const sourceLine = initialSelection?.source
      ? bookingText("預約來源: {0}", locale, [initialSelection.source])
      : null;
    const notes = visitType === 'first'
      ? [
          sourceLine,
          selectedServiceLine,
          selectedPriceLine,
          selectedTreatmentLine,
          bookingText("[首診]", locale),
          bookingText("出生日期: {0}", locale, [values.dateOfBirth.trim() || '未提供']),
          bookingText("性別: {0}", locale, [values.gender ? bookingText(GENDER_LABELS[values.gender], locale) : '未提供']),
          bookingText("過敏史: {0}", locale, [values.allergies.trim() || '沒有']),
          bookingText("正服用藥物／保健品: {0}", locale, [values.medications.trim() || '沒有']),
          bookingText("主要症狀: {0}", locale, [values.symptoms.trim() || '未提供']),
          bookingText("得知來源: {0}", locale, [bookingText(REFERRAL_SOURCE_LABELS[values.referralSource.trim()], locale) || '未提供']),
          bookingText("收據需求: {0}", locale, [bookingText(RECEIPT_LABELS[values.needReceipt], locale)]),
        ].filter((value): value is string => Boolean(value))
      : [
          sourceLine,
          selectedServiceLine,
          selectedPriceLine,
          selectedTreatmentLine,
          bookingText("[覆診]", locale),
          bookingText("收據需求: {0}", locale, [bookingText(RECEIPT_LABELS[values.needReceipt], locale)]),
        ].filter((value): value is string => Boolean(value));

    if (isOnlineConsultation && values.medicationPickup) {
      notes.push(bookingText("取藥方法: {0}", locale, [bookingText(BOOKING_PICKUP_LABELS[values.medicationPickup], locale)]));
    }

    if (isOnlineConsultation && isShippingBookingPickup(values.medicationPickup)) {
      notes.push(bookingText("寄送地址／順豐站點: {0}", locale, [values.shippingAddressDetails.trim() || '未提供']));
    }

    if (isOnlineConsultation && isClinicPickupBookingPickup(values.medicationPickup)) {
      notes.push(bookingText("診所取藥時間／其他備註: {0}", locale, [values.clinicPickupRemarks.trim() || '未提供']));
    }

    return notes.join(' | ');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDoctor || !selectedClinic || !doctorId || !clinicId) {
      setSubmitError(bookingText("請先選擇醫師/協作服務與診所。", locale));
      setStep('setup');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setSubmitError(bookingText("請先選擇日期與時間。", locale));
      setStep('timeslot');
      return;
    }

    const validationErrors = validateForm(formValues);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError(bookingText("資料未填完整，請檢查必填欄位。", locale));
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const treatmentOptions = isOnlineConsultation || usesVisitBasedServices ? [] : selectedTreatmentOptions;
    const payload = {
      locale,
      doctorId,
      clinicId,
      doctorName: selectedDoctor.doctorNameEn,
      doctorNameZh: selectedDoctor.doctorNameZh,
      clinicName: selectedClinic.clinicNameEn,
      clinicNameZh: selectedClinic.clinicNameZh,
      date: selectedDate,
      time: selectedTime,
      durationMinutes: selectedDoctorSlotMinutes,
      patientName: `${formValues.lastName.trim()} ${formValues.firstName.trim()}`.trim(),
      phone: normalizePhoneForStorage(formValues.phone),
      email: formValues.email.trim().toLowerCase(),
      treatmentOptions,
      notes: buildBookingNotes(formValues),
    };
    const medicationPickup = isOnlineConsultation
      ? (formValues.medicationPickup as BookingPickupType)
      : 'none';
    const submitEndpoint = isStaffFlow
      ? '/api/doctor/bookings'
      : '/api/booking-whatsapp';
    const requestBody = isStaffFlow || isWhatsappFlow
      ? {
          ...payload,
          visitType,
          needReceipt: formValues.needReceipt,
          medicationPickup,
          dateOfBirth: formValues.dateOfBirth.trim(),
          gender: formValues.gender || undefined,
          allergies: formValues.allergies.trim(),
          medications: formValues.medications.trim(),
          symptoms: formValues.symptoms.trim(),
          referralSource: formValues.referralSource.trim(),
          ...(isStaffFlow && staffPatientUserId ? { patientUserId: staffPatientUserId } : {}),
          ...((isStaffFlow || isWhatsappFlow) && selectedPatientProfileId
            ? { patientProfileId: selectedPatientProfileId }
            : {}),
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
        setSubmitError(data?.error || bookingText("預約失敗，請稍後再試。", locale));
        return;
      }

      setBookingId(data.bookingId || '');

      if (isWhatsappFlow || isStaffFlow) {
        setWhatsappSent(data.whatsappSent === true);
      }
      if (!isStaffFlow) {
        trackEvent('booking_completed', {
          doctor_id: doctorId,
          clinic_id: clinicId,
          booking_flow: flowVariant,
        });
      }
      setStep('success');
    } catch {
      setSubmitError(bookingText("預約時發生錯誤，請稍後再試。", locale));
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
          {isStaffFlow ? bookingText("目前未有可用的醫師或協作服務時段，請稍後再試或由姑娘人工跟進。", locale) : bookingText("目前未有可用的醫師或協作服務時段，請稍後再試或於聊天頁聯絡我們。", locale)}
        </p>
        {!embedMode ? (
          <Link
            href={isStaffFlow ? '/nurse' : '/chat'}
            className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            {isStaffFlow ? bookingText("返回控制台", locale) : bookingText("返回聊天頁", locale)}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`patient-card mx-auto p-6 sm:p-8 ${embedMode ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <div className={isMinimalPreview ? 'mb-5 space-y-2' : 'mb-8 space-y-3'}>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-primary sm:text-[30px]">{pageTitle}</h1>
        {pageSubtitle ? (
          <p
            className="text-sm leading-relaxed text-slate-400"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {pageSubtitle}
          </p>
        ) : null}
      </div>

      {!isMinimalPreview ? (
        <div className="mb-6 rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
          {bookingText("步驟：", locale)}{step === 'setup' && bookingText("1. 醫師/協作服務與診所", locale)}{step === 'timeslot' && bookingText("2. 日期與時間", locale)}
          {step === 'details' && bookingText("3. 填寫資料", locale)}{step === 'success' && bookingText("完成", locale)}
        </div>
      ) : null}

      {step === 'setup' && (
        <div className="space-y-6">
          {isMinimalPreview && selectedDoctor ? (
            <div className="w-full rounded-2xl border border-[#d5e7d8] bg-white/90 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <DoctorAvatar doctor={selectedDoctor} size="lg" locale={locale} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-[#5d8c67]">{bookingText("已選醫師", locale)}</p>
                    <p className="mt-1 text-base font-semibold leading-snug text-[#254430]">
                      {bookingText(selectedDoctor.doctorNameZh, locale)}
                    </p>
                    {selectedDoctorSlotDurationLabel ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {selectedDoctorSlotDurationLabel}
                      </p>
                    ) : null}
                    <Link
                      href={locale === 'en' ? '/en/booking' : '/booking-whatsapp'}
                      className="mt-2 inline-flex w-fit rounded-full border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light"
                    >
                      {bookingText("更改醫師", locale)}</Link>
                  </div>
                </div>
                <CompactScheduleSummaryCard doctor={selectedDoctor} locale={locale} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">{bookingText("選擇醫師", locale)}</span>
                <select
                  value={doctorId}
                  onChange={(event) => handleDoctorChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="">{bookingText("請選擇醫師及服務", locale)}</option>
                  {primaryDoctorOptions.length > 0 ? (
                    <optgroup label={bookingText("中醫主診醫師", locale)}>
                      {primaryDoctorOptions.map((doctor) => (
                        <option key={doctor.doctorId} value={doctor.doctorId}>
                          {formatDoctorOptionLabel(doctor, locale)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {supportDoctorOptions.length > 0 ? (
                    <optgroup label={bookingText("協作服務", locale)}>
                      {supportDoctorOptions.map((doctor) => (
                        <option key={doctor.doctorId} value={doctor.doctorId}>
                          {formatDoctorOptionLabel(doctor, locale)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
              {supportDoctorOptions.length > 0 ? (
                <p className="text-xs leading-relaxed text-slate-500">
                  {bookingText("中醫主診醫師優先顯示；協作脊醫服務列於下方。", locale)}</p>
              ) : null}
            </div>
          )}

          {selectedDoctor && (
            <section className="rounded-[30px] border border-[#cfe1d3] bg-[linear-gradient(135deg,#f8fcf8_0%,#edf7f0_52%,#ffffff_100%)] p-4 shadow-[0_22px_56px_-42px_rgba(31,74,44,0.42)] sm:p-6">
              {isMinimalPreview ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold text-[#254430]">{bookingText("選擇診所", locale)}</p>
                    <p className="mt-1 text-xs text-slate-500">{bookingText("先選診所，再揀日期時間。", locale)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <DoctorAvatar doctor={selectedDoctor} size="lg" locale={locale} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.28em] text-[#5d8c67]">
                        {getSelectedScheduleEyebrow(selectedDoctor, locale)}
                      </p>
                      <h2 className="mt-2 text-[1.35rem] font-semibold text-[#234230] sm:text-[1.5rem]">
                        {bookingText(selectedDoctor.doctorNameZh, locale)}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {usesVisitBasedServices ? (
                          <>
                            {firstVisitOption ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                {bookingText("首診", locale)}{formatHkdPrice(firstVisitOption.priceHkd, locale)}
                              </span>
                            ) : null}
                            {followupVisitOption ? (
                              <span className="inline-flex items-center rounded-full border border-[#d6e7d8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#31533c]">
                                {bookingText("覆診", locale)}{formatHkdPrice(followupVisitOption.priceHkd, locale)}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {selectedDoctorSlotDurationLabel ? (
                          <span className="inline-flex items-center rounded-full border border-[#d6e7d8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#31533c]">
                            {selectedDoctorSlotDurationLabel}
                          </span>
                        ) : null}
                        {isSupportBookingDoctor(selectedDoctor, locale) ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                            {bookingText(selectedDoctor.bookingRoleLabel, locale)}
                          </span>
                        ) : null}
                      </div>
                      {bookingText(selectedDoctor.bookingSupportNote, locale) ? (
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                          {bookingText(selectedDoctor.bookingSupportNote, locale)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <CompactScheduleSummaryCard doctor={selectedDoctor} className="sm:max-w-[18rem]" locale={locale} />
                </div>
              )}

              {!isMinimalPreview && selectedDoctorNotices.length > 0 && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    {getDoctorHolidaySummaryLines(selectedDoctor, selectedDoctorNotices, locale).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {selectedDoctor.clinics.map((clinic) => {
                  const scheduleLines = formatScheduleLines(clinic.schedule, locale);
                  const isChosenClinic = clinic.clinicId === clinicId;
                  const clinicStyle = CLINIC_AVAILABILITY_STYLES[clinic.clinicId];
                  const clinicSummary = clinicEarliestSummaries[clinic.clinicId];
                  const summaryClassName =
                    clinicSummary?.tone === 'available'
                      ? clinicStyle.badgeClassName
                      : clinicSummary?.tone === 'unavailable'
                        ? 'border-slate-200 bg-slate-100 text-slate-600'
                        : clinicSummary?.tone === 'loading'
                          ? 'border-slate-200 bg-white text-slate-600'
                          : 'border-amber-200 bg-amber-50 text-amber-800';
                  const summaryDotClassName =
                    clinicSummary?.tone === 'available'
                      ? clinicStyle.dotClassName
                      : clinicSummary?.tone === 'unavailable'
                        ? UNAVAILABLE_DOT_CLASS_NAME
                        : clinicSummary?.tone === 'loading'
                          ? 'bg-slate-300'
                          : 'bg-amber-400';

                  return (
                    <button
                      key={clinic.clinicId}
                      type="button"
                      onClick={() => handleClinicChange(isChosenClinic ? '' : clinic.clinicId)}
                      aria-pressed={isChosenClinic}
                      aria-label={
                        isChosenClinic
                          ? bookingText("{0} 已選取，再按一次取消篩選", locale, [bookingText(clinic.clinicNameZh, locale)])
                          : bookingText("選擇 {0}", locale, [bookingText(clinic.clinicNameZh, locale)])
                      }
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        isChosenClinic
                          ? 'border-primary/40 bg-white shadow-[0_12px_30px_rgba(31,95,63,0.08)]'
                          : 'border-white/80 bg-white/80 hover:border-primary/30 hover:bg-white hover:shadow-[0_12px_30px_rgba(31,95,63,0.05)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-slate-900">
                            {bookingText(clinic.clinicNameZh, locale)}
                            <span className="ml-2 text-sm font-medium text-slate-400">
                              {locale === 'zh' ? clinic.clinicNameEn : null}
                            </span>
                          </p>
                          {clinic.nextEffectiveFrom ? (
                            <p className="mt-1 text-xs font-medium text-sky-700">
                              {bookingText("已排定新版本，", locale)}{formatShortDate(clinic.nextEffectiveFrom, locale)} {bookingText("起更新", locale)}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${summaryClassName}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${summaryDotClassName}`} />
                            {clinicSummary?.label || bookingText("正在查詢最早時段", locale)}
                          </span>
                          {isChosenClinic && (
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                              {bookingText("已選診所", locale)}</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        {scheduleLines.map((line) => (
                          <p key={`${clinic.clinicId}-${line}`} className="text-sm text-slate-600">
                            {line}
                          </p>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {bookingText("點按診所即可篩選。", locale)}
              </p>
              {onlineConsultationMethodNotice ? (
                <div className="mt-4 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{onlineConsultationMethodNotice}</p>
                </div>
              ) : null}
            </section>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">
                {usesVisitBasedServices ? bookingText("選擇服務", locale) : bookingText("診症類型", locale)}
              </p>
              {usesVisitBasedServices ? (
                <span className="text-xs font-medium text-emerald-700">
                  {bookingText("脊醫服務", locale)}</span>
              ) : null}
            </div>
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
                <p className="font-semibold">{bookingText(VISIT_TYPE_LABELS.first, locale)}</p>
                {usesVisitBasedServices && firstVisitOption ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      {bookingText(firstVisitOption.serviceNameZh, locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {locale === 'zh' ? firstVisitOption.serviceNameEn : null}
                    </p>
                    <p className="text-sm font-semibold text-emerald-700">
                      {getVisitOptionPriceLabel(firstVisitOption, locale)}
                    </p>
                    {getVisitOptionDurationLabel(firstVisitOption, locale) ? (
                      <p className="text-xs text-slate-500">
                        {getVisitOptionDurationLabel(firstVisitOption, locale)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">{bookingText("第一次到診所就診", locale)}</p>
                )}
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
                <p className="font-semibold">{bookingText(VISIT_TYPE_LABELS.followup, locale)}</p>
                {usesVisitBasedServices && followupVisitOption ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-semibold text-slate-700">
                      {bookingText(followupVisitOption.serviceNameZh, locale)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {locale === 'zh' ? followupVisitOption.serviceNameEn : null}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {getVisitOptionPriceLabel(followupVisitOption, locale)}
                    </p>
                    {getVisitOptionDurationLabel(followupVisitOption, locale) ? (
                      <p className="text-xs text-slate-500">
                        {getVisitOptionDurationLabel(followupVisitOption, locale)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">{bookingText("曾經到診所就診", locale)}</p>
                )}
              </button>
            </div>
            {usesVisitBasedServices ? (
              <div className="space-y-1">
                {firstVisitOption?.note ? (
                  <p className="text-xs font-medium leading-relaxed text-emerald-700">
                    {firstVisitOption.note}
                  </p>
                ) : null}
                <p className="text-xs leading-relaxed text-slate-500">
                  {bookingText("網上預約暫時只開放首診及覆診；X 光片及 X 光片講解會由脊醫到診後按需要再安排。", locale)}</p>
              </div>
            ) : null}
          </div>

          {selectedDoctor && !isOnlineConsultation && !usesVisitBasedServices ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">{bookingText("治療項目", locale)}</p>
                <span className="text-xs font-medium text-slate-500">{bookingText("可留空，可多選", locale)}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {availableTreatmentOptions.map((option) => {
                  const isChecked = selectedTreatmentOptions.includes(option.id);

                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                        isChecked
                          ? 'border-primary bg-primary-light/70 text-primary'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTreatmentOption(option.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">{bookingText(option.labelZh, locale)}</span>
                        <span className="mt-1 block text-xs text-slate-500">{locale === 'zh' ? option.labelEn : null}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {needsTreatmentOtherDetails ? (
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("其他服務內容 *", locale)}</span>
                  <input
                    value={formValues.treatmentOtherDetails}
                    onChange={(event) => updateFormField('treatmentOtherDetails', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder={bookingText("請註明想預約的其他服務", locale)}
                  />
                  {formErrors.treatmentOtherDetails ? (
                    <p className="text-xs text-red-600">{formErrors.treatmentOtherDetails}</p>
                  ) : null}
                </label>
              ) : null}

              <p className="text-xs leading-relaxed text-slate-500">
                {bookingText("如未確定做哪一項，可先留空，稍後到診時再確認。", locale)}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={continueToTimeslot}
            disabled={!canContinueSetup}
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bookingText("下一步：選擇日期與時間", locale)}</button>
        </div>
      )}

      {step === 'timeslot' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('setup')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> {bookingText("返回上一頁", locale)}</button>

          <DoctorBookingSummary
            doctor={selectedDoctor}
            clinicNameZh={bookingText(selectedClinic?.clinicNameZh, locale) || bookingText("比較全部診所", locale)}
            eyebrow={selectedDoctorSummaryEyebrow}
            details={compactDetails([
              usesVisitBasedServices && selectedVisitOptionSummary
                ? `${bookingText(VISIT_TYPE_LABELS[visitType], locale)}．${selectedVisitOptionSummary}`
                : null,
              !usesVisitBasedServices && !isOnlineConsultation
                ? treatmentSummaryDetail || availableTreatmentSummaryDetail
                : null,
              !usesVisitBasedServices
                ? `${bookingText(VISIT_TYPE_LABELS[visitType], locale)}．${getSlotDurationLabel(selectedDoctorSlotMinutes, locale)}`
                : null,
              onlineConsultationMethodDetail,
              selectedClinic
                ? bookingText("日曆只顯示所選診所燈號。", locale)
                : bookingText("日曆會同時顯示各診所燈號，方便直接比較日期。", locale),
            ], locale)} locale={locale}
          />

          {groupBookingNotice ? (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{groupBookingNotice}</p>
            </div>
          ) : null}

          {clinicId ? (
            <button
              type="button"
              onClick={() => handleClinicChange('')}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              {bookingText("改為比較全部診所", locale)}</button>
          ) : null}

          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4" />
              {bookingText("選擇日期", locale)}</span>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
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

                  const isSelected = selectedDate === cell.dateIso;

                  return (
                    <button
                      key={cell.dateIso}
                      type="button"
                      onClick={() => handleDateChange(cell.dateIso)}
                      disabled={!cell.isSelectable}
                      aria-label={`${cell.dateIso}，${cell.availabilityLabel}`}
                      className={`h-12 rounded-lg border text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        !cell.isSelectable
                          ? 'cursor-not-allowed border-transparent text-slate-300'
                          : isSelected
                            ? 'border-primary bg-primary text-white'
                            : cell.availableClinicIds.length > 0
                              ? 'border-slate-200 bg-white text-slate-900 hover:border-primary/40 hover:bg-primary-light/20'
                              : cell.isUnavailable
                                ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300'
                                : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cell.day}</span>
                      <span className="mt-1 flex min-h-[8px] items-center justify-center gap-1">
                        {isSelected ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                        ) : cell.availableClinicIds.length > 0 ? (
                          cell.availableClinicIds.map((availableClinicId) => (
                            <span
                              key={`${cell.dateIso}-${availableClinicId}`}
                              className={`h-1.5 w-1.5 rounded-full ${
                                CLINIC_AVAILABILITY_STYLES[availableClinicId].dotClassName
                              }`}
                            />
                          ))
                        ) : cell.isUnavailable ? (
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
                {(clinicId ? visibleClinics : scannableClinics).map((clinic) => (
                  <span key={`legend-${clinic.clinicId}`} className="inline-flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        CLINIC_AVAILABILITY_STYLES[clinic.clinicId].dotClassName
                      }`}
                    />
                    <span>{bookingText(clinic.clinicNameZh, locale)}{bookingText("有位", locale)}</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${UNAVAILABLE_DOT_CLASS_NAME}`} />
                  <span>{clinicId ? bookingText("所選診所暫滿", locale) : bookingText("全部診所暫滿", locale)}</span>
                </span>
              </div>
            </div>

            {bookableDatesLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {bookingText("正在掃描本月各診所可預約日子...", locale)}</div>
            ) : null}

            {!bookableDatesLoading && bookableDatesError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bookingFeedback(bookableDatesError, locale)}
              </div>
            ) : null}

            {selectedDate ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  {bookingText("已選日期：", locale)}<span className="font-semibold text-slate-900">{formatDateForDisplay(selectedDate, locale)}</span>
                </p>
                {!clinicId && selectedDateAllAvailableClinics.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-slate-700">{bookingText("此日可預約診所", locale)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDateAllAvailableClinics.map((clinic) => (
                        <button
                          key={`selected-date-${clinic.clinicId}`}
                          type="button"
                          onClick={() => handleClinicChange(clinic.clinicId)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:shadow-sm ${
                            CLINIC_AVAILABILITY_STYLES[clinic.clinicId].selectedButtonClassName
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              CLINIC_AVAILABILITY_STYLES[clinic.clinicId].dotClassName
                            }`}
                          />
                          {bookingText(clinic.clinicNameZh, locale)}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      {bookingText("先揀診所，再顯示當日可預約時段。", locale)}</p>
                  </div>
                ) : null}
                {clinicId &&
                selectedDateVisibleAvailableClinics.length === 0 &&
                selectedDateAllAvailableClinics.length > 0 ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    {bookingText("此日", locale)}{bookingText(selectedClinic?.clinicNameZh, locale)} {bookingText("暫滿，但其他診所仍有位。", locale)}<button
                      type="button"
                      onClick={() => handleClinicChange('')}
                      className="ml-2 font-semibold underline underline-offset-2"
                    >
                      {bookingText("改為比較全部診所", locale)}</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{bookingText("請先在日曆選擇日期，再選擇時段。", locale)}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">{bookingText("可預約時段", locale)}</p>
            <p className="text-xs text-slate-500">
              {selectedDoctorSlotDurationLabel
                ? selectedDoctor
                  ? bookingText("已按 {0} 設定顯示 {1}。", locale, [selectedDoctor.doctorNameZh, selectedDoctorSlotDurationLabel])
                  : bookingText("已按醫師/協作服務設定顯示 {0}。", locale, [selectedDoctorSlotDurationLabel])
                : selectedDoctor
                  ? bookingText("已按 {0} 設定顯示可預約時段。", locale, [bookingText(selectedDoctor.doctorNameZh, locale)])
                  : bookingText("已按醫師/協作服務設定顯示可預約時段。", locale)}
            </p>

            {slotsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {bookingText("正在查詢可預約時段...", locale)}</div>
            ) : null}

            {!slotsLoading && slotError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bookingFeedback(slotError, locale)}
              </div>
            ) : null}

            {!slotsLoading && !slotError && selectedDate && !clinicId ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {bookingText("請先選擇當日有位的診所，再查看可預約時段。", locale)}</div>
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
            {bookingText("下一步：填寫個人資料", locale)}</button>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('timeslot')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> {bookingText("返回選擇時段", locale)}</button>

          <DoctorBookingSummary
            doctor={selectedDoctor}
            clinicNameZh={bookingText(selectedClinic?.clinicNameZh, locale)}
            eyebrow={bookingText("預約摘要", locale)}
            details={compactDetails([
              `${formatDateForDisplay(selectedDate, locale)} ${selectedTime}`,
              usesVisitBasedServices && selectedVisitOptionSummary
                ? `${bookingText(VISIT_TYPE_LABELS[visitType], locale)}．${selectedVisitOptionSummary}`
                : null,
              !usesVisitBasedServices && !isOnlineConsultation
                ? treatmentSummaryDetail || availableTreatmentSummaryDetail
                : null,
              !usesVisitBasedServices
                ? `${bookingText(VISIT_TYPE_LABELS[visitType], locale)}．${getSlotDurationLabel(selectedDoctorSlotMinutes, locale)}`
                : null,
              onlineConsultationMethodDetail,
            ], locale)} locale={locale}
          />

          {isWhatsappFlow ? (
            <PatientProfileSelector
              selectedProfileId={selectedPatientProfileId}
              onSelect={(profile) => {
                setSelectedPatientProfileId(profile.id);
                const { lastName, firstName } = splitHkDisplayName(profile.display_name);
                setFormValues((prev) => ({
                  ...prev,
                  lastName: lastName || prev.lastName,
                  firstName: firstName || prev.firstName,
                  dateOfBirth: profile.date_of_birth ?? prev.dateOfBirth,
                  gender: (profile.gender as typeof prev.gender) || prev.gender,
                }));
              }}
              onInitialLoad={(profiles) => {
                if (selectedPatientProfileId) return;
                const preferred =
                  profiles.find((p) => p.is_default) ?? profiles[0];
                if (!preferred) return;
                setSelectedPatientProfileId(preferred.id);
                const { lastName, firstName } = splitHkDisplayName(preferred.display_name);
                setFormValues((prev) => ({
                  ...prev,
                  lastName: prev.lastName || lastName,
                  firstName: prev.firstName || firstName,
                  dateOfBirth: prev.dateOfBirth || (preferred.date_of_birth ?? ''),
                  gender: prev.gender || ((preferred.gender as typeof prev.gender) ?? ''),
                }));
              }} locale={locale}
            />
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {hasAutofilledContact ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                {isStaffFlow
                  ? bookingText("已從所選病人資料帶入聯絡資料，你可按需要修改。", locale)
                  : bookingText("已從登入帳戶帶入可用聯絡資料，你可按需要修改。", locale)}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">{bookingText("名字 *", locale)}</span>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={formValues.firstName}
                  onChange={(event) => updateFormField('firstName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder={bookingText("例如：大文", locale)}
                />
                {formErrors.firstName ? <p className="text-xs text-red-600">{formErrors.firstName}</p> : null}
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">{bookingText("姓氏 *", locale)}</span>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={formValues.lastName}
                  onChange={(event) => updateFormField('lastName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder={bookingText("例如：陳", locale)}
                />
                {formErrors.lastName ? <p className="text-xs text-red-600">{formErrors.lastName}</p> : null}
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">{bookingText("電話 *", locale)}</span>
              <input
                type="tel"
                autoComplete="tel"
                value={formValues.phone}
                onChange={(event) => updateFormField('phone', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder={bookingText("例如：98765432", locale)}
              />
              {formErrors.phone ? <p className="text-xs text-red-600">{formErrors.phone}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">{bookingText("電郵（選填）", locale)}</span>
              <input
                type="email"
                autoComplete="email"
                value={formValues.email}
                onChange={(event) => updateFormField('email', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder={bookingText("例如：name@example.com", locale)}
              />
              {formErrors.email ? <p className="text-xs text-red-600">{formErrors.email}</p> : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">{bookingText("收據需求 *", locale)}</span>
                <select
                  value={formValues.needReceipt}
                  onChange={(event) => updateFormField('needReceipt', event.target.value as ReceiptType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="no">{bookingText("不需要", locale)}</option>
                  <option value="yes_insurance">{bookingText("需要，用作保險索償", locale)}</option>
                  <option value="yes_not_insurance">{bookingText("需要，非保險用途", locale)}</option>
                </select>
              </label>
            </div>

            {isOnlineConsultation ? (
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">{bookingText("取藥方法 *", locale)}</span>
                <select
                  value={formValues.medicationPickup}
                  onChange={(event) =>
                    updateFormField('medicationPickup', event.target.value as BookingPickupSelection)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="">{bookingText("請選擇", locale)}</option>
                  {pickupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {bookingText(option.label, locale)}
                    </option>
                  ))}
                </select>
                {formErrors.medicationPickup ? (
                  <p className="text-xs text-red-600">{formErrors.medicationPickup}</p>
                ) : null}
              </label>
            ) : null}

            {needsShippingAddressDetails ? (
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  {bookingText("如選擇送遞，請填寫中文寄送地址／順豐站點或智能櫃代碼", locale)}</span>
                <input
                  value={formValues.shippingAddressDetails}
                  onChange={(event) => updateFormField('shippingAddressDetails', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder={bookingText("例如：九龍尖沙咀廣東道 88 號 xx 大廈 xx 室／順豐站代碼", locale)}
                />
                {formErrors.shippingAddressDetails ? (
                  <p className="text-xs text-red-600">{formErrors.shippingAddressDetails}</p>
                ) : null}
              </label>
            ) : null}

            {needsClinicPickupRemarks ? (
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  {bookingText("若於診所取藥，請填寫取藥時間／其他備註", locale)}</span>
                <textarea
                  value={formValues.clinicPickupRemarks}
                  onChange={(event) => updateFormField('clinicPickupRemarks', event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder={bookingText("例如：星期二 4pm 後可到中環診所取藥", locale)}
                />
                {formErrors.clinicPickupRemarks ? (
                  <p className="text-xs text-red-600">{formErrors.clinicPickupRemarks}</p>
                ) : null}
              </label>
            ) : null}

            {visitType === 'first' ? (
              <div className="space-y-4 rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
                  <UserRound className="h-4 w-4" />
                  {bookingText("首診資料（必填）", locale)}</p>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("出生日期 *", locale)}</span>
                  <input
                    value={formValues.dateOfBirth}
                    onChange={(event) => updateFormField('dateOfBirth', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder={bookingText("例如：1990/01/15", locale)}
                  />
                  {formErrors.dateOfBirth ? (
                    <p className="text-xs text-red-600">{formErrors.dateOfBirth}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("性別 *", locale)}</span>
                  <select
                    value={formValues.gender}
                    onChange={(event) => updateFormField('gender', event.target.value as GenderType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">{bookingText("請選擇", locale)}</option>
                    <option value="male">{bookingText("男", locale)}</option>
                    <option value="female">{bookingText("女", locale)}</option>
                    <option value="other">{bookingText("其他", locale)}</option>
                  </select>
                  {formErrors.gender ? <p className="text-xs text-red-600">{formErrors.gender}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("過敏史 *", locale)}</span>
                  <textarea
                    value={formValues.allergies}
                    onChange={(event) => updateFormField('allergies', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder={bookingText("如沒有請填「沒有」", locale)}
                  />
                  {formErrors.allergies ? <p className="text-xs text-red-600">{formErrors.allergies}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("正服用藥物／保健品 *", locale)}</span>
                  <textarea
                    value={formValues.medications}
                    onChange={(event) => updateFormField('medications', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder={bookingText("如沒有請填「沒有」", locale)}
                  />
                  {formErrors.medications ? (
                    <p className="text-xs text-red-600">{formErrors.medications}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("主要症狀 *", locale)}</span>
                  <textarea
                    value={formValues.symptoms}
                    onChange={(event) => updateFormField('symptoms', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder={bookingText("請簡述主要問題", locale)}
                  />
                  {formErrors.symptoms ? <p className="text-xs text-red-600">{formErrors.symptoms}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">{bookingText("得知來源 *", locale)}</span>
                  <select
                    value={formValues.referralSource}
                    onChange={(event) => updateFormField('referralSource', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">{bookingText("請選擇", locale)}</option>
                    <option value="google">{bookingText("Google 搜尋", locale)}</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="friend">{bookingText("朋友介紹", locale)}</option>
                    <option value="doctor">{bookingText("醫師介紹", locale)}</option>
                    <option value="walk_in">{bookingText("路過", locale)}</option>
                    <option value="other">{bookingText("其他", locale)}</option>
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
                {bookingFeedback(submitError, locale)}
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
            {(isWhatsappFlow || isStaffFlow) && whatsappSent === false ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {isStaffFlow
                  ? bookingText("已完成代約，但 WhatsApp 確認訊息暫時未能自動發送，請姑娘跟進。", locale)
                  : bookingText("已完成預約，但 WhatsApp 確認訊息暫時未能自動發送。診所會另行跟進。", locale)}
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
            clinicNameZh={bookingText(selectedClinic?.clinicNameZh, locale)}
            eyebrow={bookingText("完成摘要", locale)}
            details={[
              `${formatDateForDisplay(selectedDate, locale)} ${selectedTime}`,
              ...(usesVisitBasedServices && selectedVisitOptionSummary
                ? [`${bookingText(VISIT_TYPE_LABELS[visitType], locale)}．${selectedVisitOptionSummary}`]
                : []),
              ...(onlineConsultationMethodDetail ? [onlineConsultationMethodDetail] : []),
              bookingId ? `${referenceLabel}：${bookingId}` : bookingText("確認資料已準備完成", locale),
            ]} locale={locale}
          />

          <div className={`grid gap-3 ${embedMode ? '' : 'sm:grid-cols-2'}`}>
            <button
              type="button"
              onClick={startAnotherBooking}
              className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              {bookingText("再預約一個時段", locale)}</button>

            {!embedMode ? (
              <Link
                href={isStaffFlow ? '/nurse' : '/chat'}
                className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                {isStaffFlow ? bookingText("返回姑娘主頁", locale) : bookingText("返回聊天頁", locale)}
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
