'use client';

import Image from 'next/image';
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
import { getMonthlyUnavailableSummaryLabel } from '@/lib/booking-availability-labels';
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
import { type ClinicId, type DoctorId } from '@/shared/clinic-data';
import type { TimeRange, WeeklySchedule } from '@/shared/schedule-config';
import {
  PatientProfileSelector,
  splitHkDisplayName,
} from '@/components/booking/PatientProfileSelector';
import type { PatientProfile } from '@/app/api/patient-profiles/route';

type BookingStep = 'setup' | 'timeslot' | 'details' | 'success';
type FlowVariant = 'booking' | 'whatsapp' | 'staff';
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
  staffPatientUserId?: string | null;
  embedMode?: boolean;
  flowVariant?: FlowVariant;
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_SLOT_DURATION_MINUTES = 15;
const MAX_BOOKING_WINDOW_DAYS = 90;
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;
const WEEKDAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;
const OTHER_TREATMENT_OPTION_ID: BookingTreatmentOptionId = 'other';
const DR_WONG_GROUP_BOOKING_NOTICE =
  '為方便醫生安排時間，每節需要最少三位病人才會開診。若未滿三人，系統會自動取消預約。若果人數足夠確認預約，會前一天以 WhatsApp 確認。';

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

function formatShortDate(dateIso: string): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG_TIMEZONE,
    month: 'numeric',
    day: 'numeric',
  }).format(date);
}

function formatSelectedTreatments(
  treatmentOptions: BookingTreatmentOption[],
  treatmentOtherDetails?: string
): string {
  const normalizedOtherDetails = treatmentOtherDetails?.trim();

  return treatmentOptions
    .map((option) => {
      const label = formatBookingTreatmentOptionLabel(option);
      if (option.id === OTHER_TREATMENT_OPTION_ID && normalizedOtherDetails) {
        return `${label}: ${normalizedOtherDetails}`;
      }
      return label;
    })
    .join('、');
}

async function requestAvailabilityForDoctor(
  targetDoctorId: DoctorId,
  targetClinicId: ClinicId,
  dateIso: string,
  durationMinutes: number
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
          errorMessage: '暫時未能連接預約日曆，請稍後再試或在聊天頁由姑娘協助安排。',
        };
      }

      return {
        slots: [],
        isClosedDay: false,
        status: 'unknown',
        errorMessage: data?.error || '暫時未能讀取可預約時段，請稍後再試。',
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
      errorMessage: '載入時段失敗，請稍後再試。',
    };
  }
}

function getSlotDurationLabel(durationMinutes: number): string {
  return `每個時段 ${durationMinutes} 分鐘`;
}

function compactDetails(details: Array<string | null | undefined | false>): string[] {
  return details.filter((detail): detail is string => Boolean(detail));
}

function isSupportBookingDoctor(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>
): boolean {
  return doctor?.bookingPractitionerGroup === 'support';
}

function formatDoctorOptionLabel(
  doctor: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'doctorNameEn' | 'bookingPractitionerGroup' | 'bookingRoleLabel'>
): string {
  const suffix = isSupportBookingDoctor(doctor) ? ` - ${doctor.bookingRoleLabel}` : '';
  return `${doctor.doctorNameZh} (${doctor.doctorNameEn})${suffix}`;
}

function getSelectedScheduleEyebrow(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>
): string {
  return isSupportBookingDoctor(doctor) ? '協作脊醫時段' : '醫師應診時間';
}

function getSelectedCardLabel(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>
): string {
  return isSupportBookingDoctor(doctor) ? '協作服務卡片' : '醫師卡片';
}

function getSelectedSummaryEyebrow(
  doctor?: Pick<BookableDoctorSchedule, 'bookingPractitionerGroup'>
): string {
  return isSupportBookingDoctor(doctor) ? '已選協作服務' : '已選醫師';
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
          alt={`${doctor.doctorNameZh}頭像`}
          fill
          sizes={isLarge ? '112px' : '56px'}
          className="object-cover"
          style={{ objectPosition: doctor.avatarObjectPosition || 'center' }}
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
  doctor?: Pick<BookableDoctorSchedule, 'doctorNameZh' | 'avatarSrc' | 'avatarObjectPosition'>;
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
  staffPatientUserId,
  embedMode = false,
  flowVariant = 'booking',
}: BookingTabFlowProps) {
  const isWhatsappFlow = flowVariant === 'whatsapp';
  const isStaffFlow = flowVariant === 'staff';
  const [step, setStep] = useState<BookingStep>('setup');
  const [visitType, setVisitType] = useState<VisitType>(initialSelection?.visitType ?? 'first');
  const [doctorId, setDoctorId] = useState<DoctorId | ''>(initialSelection?.doctorId ?? '');
  const [clinicId, setClinicId] = useState<ClinicId | ''>(initialSelection?.clinicId ?? '');
  const [selectedTreatmentOptions, setSelectedTreatmentOptions] = useState<BookingTreatmentOptionId[]>([]);

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKeyInHongKong(new Date()));
  const [monthClinicAvailability, setMonthClinicAvailability] = useState<MonthClinicAvailability>(
    {}
  );
  const [bookableDatesLoading, setBookableDatesLoading] = useState(false);
  const [bookableDatesError, setBookableDatesError] = useState('');

  const [formValues, setFormValues] = useState<BookingFormValues>(() =>
    buildInitialFormValues(initialContact)
  );
  const [formErrors, setFormErrors] = useState<BookingFormErrors>({});
  const previousClinicIdRef = useRef<ClinicId | ''>(initialSelection?.clinicId ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [whatsappSent, setWhatsappSent] = useState<boolean | null>(null);
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<string | null>(null);

  const minDate = getTodayIsoInHongKong();
  const maxDate = getMaxDateIsoInHongKong(MAX_BOOKING_WINDOW_DAYS);
  const currentMonthKey = toMonthKeyFromIsoDate(minDate);

  const doctorOptions = useMemo(
    () => doctors,
    [doctors]
  );
  const primaryDoctorOptions = useMemo(
    () => doctorOptions.filter((doctor) => !isSupportBookingDoctor(doctor)),
    [doctorOptions]
  );
  const supportDoctorOptions = useMemo(
    () => doctorOptions.filter((doctor) => isSupportBookingDoctor(doctor)),
    [doctorOptions]
  );

  const clinicOptions = useMemo(() => {
    if (!doctorId) return [];
    return doctorOptions.find((doctor) => doctor.doctorId === doctorId)?.clinics ?? [];
  }, [doctorId, doctorOptions]);

  const selectedDoctor = useMemo(
    () => doctorOptions.find((doctor) => doctor.doctorId === doctorId),
    [doctorId, doctorOptions]
  );
  const selectedDoctorSummaryEyebrow = getSelectedSummaryEyebrow(selectedDoctor);
  const selectedDoctorNotices = useMemo(() => {
    if (!selectedDoctor) return [];

    const notices: Array<{
      id: string;
      text: string;
      clinicId?: ClinicId;
      clinicNameZh?: string;
      isStatic?: boolean;
    }> = [];

    if (selectedDoctor.scheduleNote) {
      notices.push({
        id: `static:${selectedDoctor.doctorId}`,
        text: selectedDoctor.scheduleNote,
        isStatic: true,
      });
    }

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
    ? selectedDoctor?.bookingTreatmentOptions ?? []
    : [];
  const selectedTreatmentDetails = useMemo(() => {
    if (!selectedDoctor || isOnlineConsultation) return [];

    const treatmentOptionById = new Map(
      selectedDoctor.bookingTreatmentOptions.map((option) => [option.id, option] as const)
    );

    return selectedTreatmentOptions
      .map((optionId) => treatmentOptionById.get(optionId))
      .filter((option): option is BookingTreatmentOption => Boolean(option));
  }, [isOnlineConsultation, selectedDoctor, selectedTreatmentOptions]);
  const selectedTreatmentSummary = selectedTreatmentDetails.length > 0
    ? formatSelectedTreatments(selectedTreatmentDetails, formValues.treatmentOtherDetails)
    : '';
  const treatmentSummaryDetail = isOnlineConsultation
    ? null
    : selectedTreatmentSummary
      ? `已選治療項目：${selectedTreatmentSummary}`
      : selectedDoctor
        ? '治療項目：未指定（可留待到診時再確認）'
        : null;
  const pickupOptions = useMemo(
    () => getBookingPickupOptions(clinicId),
    [clinicId]
  );
  const needsShippingAddressDetails =
    isOnlineConsultation && isShippingBookingPickup(formValues.medicationPickup);
  const needsClinicPickupRemarks =
    isOnlineConsultation && isClinicPickupBookingPickup(formValues.medicationPickup);
  const needsTreatmentOtherDetails =
    !isOnlineConsultation && selectedTreatmentOptions.includes(OTHER_TREATMENT_OPTION_ID);
  const selectedDoctorSlotMinutes = selectedDoctor?.bookingSlotMinutes ?? DEFAULT_SLOT_DURATION_MINUTES;
  const groupBookingNotice =
    selectedDoctor?.doctorId === 'wong' && clinicId === 'jordan'
      ? DR_WONG_GROUP_BOOKING_NOTICE
      : '';
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
  const pageTitle = isStaffFlow ? '姑娘代約' : '預約服務';
  const pageSubtitle = isStaffFlow
    ? '供姑娘或前台代病人安排時段。成功後系統會優先透過 WhatsApp 發送確認訊息，若有電郵則會一併寄出確認電郵。'
    : isWhatsappFlow
    ? '成功預約後，診所會透過 WhatsApp 發送確認訊息到你提供的電話。'
    : '「每一次預約，都是照顧自己的開始。」';
  const submitButtonLabel = '確認預約';
  const submitLoadingLabel = isStaffFlow ? '代約處理中...' : '預約處理中...';
  const detailNotice = isStaffFlow
    ? '此頁會以病人資料建立正式預約，並嘗試即時發送 WhatsApp 確認。若病人已有電郵，系統亦會補發確認電郵。'
    : groupBookingNotice
    ? groupBookingNotice
    : isWhatsappFlow
    ? '成功預約後會透過 WhatsApp 發送確認訊息到你提供的電話。'
    : '如有提供電郵，系統會發送確認電郵；更改或取消可使用電郵內連結。';
  const successTitle = isStaffFlow ? '代約完成' : '預約成功';
  const successDescription = isStaffFlow
    ? '預約已建立，系統已嘗試發送確認訊息到病人提供的聯絡方式。'
    : groupBookingNotice
    ? groupBookingNotice
    : isWhatsappFlow
    ? '預約已建立，診所會透過 WhatsApp 跟進並發送確認訊息到你提供的電話。'
    : formValues.email.trim()
      ? '確認電郵將發送到你提供的信箱。'
      : '預約已建立；如需更改或取消，請聯絡診所跟進。';
  const successQuote = isStaffFlow ? '「資料確認得愈完整，跟進就愈穩陣。」' : '「每一次回來，身體都記得。」';
  const referenceLabel = '預約編號';

  const canContinueSetup = Boolean(doctorId && visitType);
  const canContinueTimeslot = Boolean(selectedDate && selectedTime && clinicId);
  const previousMonthKey = shiftMonthKey(calendarMonthKey, -1);
  const nextMonthKey = shiftMonthKey(calendarMonthKey, 1);
  const canGoToPreviousMonth = monthHasSelectableDate(previousMonthKey, minDate, maxDate);
  const canGoToNextMonth = monthHasSelectableDate(nextMonthKey, minDate, maxDate);
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
        .map((clinic) => clinic.clinicNameZh);

      return {
        dateIso,
        day,
        isSelectable: dateIso >= minDate && dateIso <= maxDate,
        availableClinicIds,
        isUnavailable,
        availabilityLabel:
          availableClinicNames.length > 0
            ? `${availableClinicNames.join('、')}有位`
            : isUnavailable
              ? clinicId
                ? `${visibleClinics[0]?.clinicNameZh || '所選診所'}暫滿`
                : '所有診所暫滿'
              : '正在掃描 availability',
      };
    });
  }, [calendarMonthKey, clinicId, maxDate, minDate, monthClinicAvailability, visibleClinics]);

  const clinicMonthlySummaries = useMemo<
    Partial<Record<ClinicId, { label: string; tone: 'available' | 'unavailable' | 'loading' | 'unknown' }>>
  >(() => {
    const summaries: Partial<
      Record<ClinicId, { label: string; tone: 'available' | 'unavailable' | 'loading' | 'unknown' }>
    > = {};
    const daysInMonth = getDaysInMonth(calendarMonthKey);

    for (const clinic of scannableClinics) {
      let firstAvailableDate = '';
      let hasUnavailableDate = false;
      let hasUnknownDate = false;

      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateIso = isoDateFromMonthDay(calendarMonthKey, day);
        if (dateIso < minDate || dateIso > maxDate) continue;

        const state = monthClinicAvailability[dateIso]?.[clinic.clinicId];
        if (state === 'available') {
          firstAvailableDate = dateIso;
          break;
        }

        if (state === 'unavailable') {
          hasUnavailableDate = true;
          continue;
        }

        hasUnknownDate = true;
      }

      if (firstAvailableDate) {
        summaries[clinic.clinicId] = {
          label: `本月最早 ${formatShortDate(firstAvailableDate)} 可約`,
          tone: 'available',
        };
        continue;
      }

      if (bookableDatesLoading) {
        summaries[clinic.clinicId] = {
          label: '正在掃描本月 availability',
          tone: 'loading',
        };
        continue;
      }

      if (!hasUnknownDate && hasUnavailableDate) {
        summaries[clinic.clinicId] = {
          label: getMonthlyUnavailableSummaryLabel({
            calendarMonthKey,
            currentMonthKey,
          }),
          tone: 'unavailable',
        };
        continue;
      }

      summaries[clinic.clinicId] = {
        label: '稍後更新',
        tone: 'unknown',
      };
    }

    return summaries;
  }, [
    bookableDatesLoading,
    calendarMonthKey,
    currentMonthKey,
    maxDate,
    minDate,
    monthClinicAvailability,
    scannableClinics,
  ]);

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

    setMonthClinicAvailability({});
    setBookableDatesError('');

    if (datesToScan.length === 0) {
      setBookableDatesLoading(false);
      return;
    }

    let isCancelled = false;
    setBookableDatesLoading(true);

    const scanBookableDates = async () => {
      const queue = datesToScan.flatMap((dateIso) =>
        scannableClinics.map((clinic) => ({
          dateIso,
          clinicId: clinic.clinicId,
        }))
      );
      const nextAvailability: MonthClinicAvailability = {};
      let hasPartialRead = false;
      const workerCount = Math.min(6, queue.length);

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (queue.length > 0 && !isCancelled) {
            const nextJob = queue.shift();
            if (!nextJob) break;

            const result = await requestAvailabilityForDoctor(
              doctorId,
              nextJob.clinicId,
              nextJob.dateIso,
              selectedDoctorSlotMinutes
            );

            nextAvailability[nextJob.dateIso] = {
              ...(nextAvailability[nextJob.dateIso] ?? {}),
              [nextJob.clinicId]: result.status,
            };

            if (result.status === 'unknown' || result.calendarUnavailable) {
              hasPartialRead = true;
            }
          }
        })
      );

      if (isCancelled) return;

      setMonthClinicAvailability(nextAvailability);
      setBookableDatesLoading(false);
      setBookableDatesError(
        hasPartialRead
          ? '暫時未能完整讀取預約日曆，彩色燈號可能未完全顯示。'
          : ''
      );
    };

    void scanBookableDates();

    return () => {
      isCancelled = true;
    };
  }, [calendarMonthKey, doctorId, maxDate, minDate, scannableClinics, selectedDoctorSlotMinutes]);

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
  }, [selectedDoctor]);

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
    setCalendarMonthKey(toMonthKeyInHongKong(new Date()));
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
        setSlotError('所選日期所有診所暫無可預約時段。');
      }
      return;
    }

    setStep('setup');
    clearSelectedTimeslot();
  }

  function handleVisitTypeChange(nextVisitType: VisitType) {
    setVisitType(nextVisitType);
    setStep('setup');
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
      selectedDoctorSlotMinutes
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
        result.errorMessage || '暫時未能讀取可預約時段，請稍後再試。'
      );
      setSlotsLoading(false);
      return;
    }

    setAvailableSlots(result.slots);

    if (result.isClosedDay) {
      setSlotError('當日休診或公眾假期，請選擇其他日期。');
      setSlotsLoading(false);
      return;
    }

    if (result.slots.length === 0) {
      setSlotError('當日暫無可預約時段。');
    }

    setSlotsLoading(false);
  }

  function handleDateChange(dateIso: string) {
    setSelectedDate(dateIso);
    setCalendarMonthKey(toMonthKeyFromIsoDate(dateIso));
    clearSelectedTimeslot(true);

    if (clinicId) {
      void fetchAvailability(dateIso, clinicId);
      return;
    }

    if (isDateFullyUnavailable(dateIso, '')) {
      setSlotError('所選日期所有診所暫無可預約時段。');
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
      nextErrors.firstName = '請輸入名字';
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = '請輸入姓氏';
    }

    const normalizedPhone = normalizePhoneForSearch(values.phone);
    if (normalizedPhone.length < 8) {
      nextErrors.phone = '請輸入有效電話（至少 8 位數字）';
    }

    const normalizedEmail = values.email.trim().toLowerCase();
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = '請輸入有效電郵地址';
    }

    if (needsTreatmentOtherDetails && !values.treatmentOtherDetails.trim()) {
      nextErrors.treatmentOtherDetails = '如選擇其他，請註明服務內容';
    }

    if (isOnlineConsultation && !values.medicationPickup) {
      nextErrors.medicationPickup = '請選擇取藥方法';
    }

    if (isOnlineConsultation && isShippingBookingPickup(values.medicationPickup) && !values.shippingAddressDetails.trim()) {
      nextErrors.shippingAddressDetails = '請填寫寄送地址或順豐站／智能櫃資料';
    }

    if (isOnlineConsultation && isClinicPickupBookingPickup(values.medicationPickup) && !values.clinicPickupRemarks.trim()) {
      nextErrors.clinicPickupRemarks = '請填寫取藥時間或其他備註';
    }

    if (visitType === 'first') {
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
    const selectedTreatmentLine = selectedTreatmentDetails.length > 0
      ? `治療項目: ${formatSelectedTreatments(selectedTreatmentDetails, values.treatmentOtherDetails)}`
      : null;
    const notes = visitType === 'first'
      ? [
          selectedTreatmentLine,
          '[首診]',
          `出生日期: ${values.dateOfBirth.trim() || '未提供'}`,
          `性別: ${values.gender ? GENDER_LABELS[values.gender] : '未提供'}`,
          `過敏史: ${values.allergies.trim() || '沒有'}`,
          `正服用藥物／保健品: ${values.medications.trim() || '沒有'}`,
          `主要症狀: ${values.symptoms.trim() || '未提供'}`,
          `得知來源: ${REFERRAL_SOURCE_LABELS[values.referralSource.trim()] || '未提供'}`,
          `收據需求: ${RECEIPT_LABELS[values.needReceipt]}`,
        ].filter((value): value is string => Boolean(value))
      : [
          selectedTreatmentLine,
          '[覆診]',
          `收據需求: ${RECEIPT_LABELS[values.needReceipt]}`,
        ].filter((value): value is string => Boolean(value));

    if (isOnlineConsultation && values.medicationPickup) {
      notes.push(`取藥方法: ${BOOKING_PICKUP_LABELS[values.medicationPickup]}`);
    }

    if (isOnlineConsultation && isShippingBookingPickup(values.medicationPickup)) {
      notes.push(`寄送地址／順豐站點: ${values.shippingAddressDetails.trim() || '未提供'}`);
    }

    if (isOnlineConsultation && isClinicPickupBookingPickup(values.medicationPickup)) {
      notes.push(`診所取藥時間／其他備註: ${values.clinicPickupRemarks.trim() || '未提供'}`);
    }

    return notes.join(' | ');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDoctor || !selectedClinic || !doctorId || !clinicId) {
      setSubmitError('請先選擇醫師/協作服務與診所。');
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

    const treatmentOptions = isOnlineConsultation ? [] : selectedTreatmentOptions;
    const payload = {
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
      : isWhatsappFlow
        ? '/api/booking-whatsapp'
        : '/api/booking';
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
          ...(isWhatsappFlow && selectedPatientProfileId
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
        setSubmitError(data?.error || '預約失敗，請稍後再試。');
        return;
      }

      setBookingId(data.bookingId || '');

      if (isWhatsappFlow || isStaffFlow) {
        setWhatsappSent(data.whatsappSent === true);
      }
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
        <h1 className="text-2xl font-semibold text-primary">{pageTitle}</h1>
        <p className="mt-3 text-sm text-slate-600">
          {isStaffFlow ? '目前未有可用的醫師或協作服務時段，請稍後再試或由姑娘人工跟進。' : '目前未有可用的醫師或協作服務時段，請稍後再試或於聊天頁聯絡我們。'}
        </p>
        {!embedMode ? (
          <Link
            href={isStaffFlow ? '/doctor' : '/chat'}
            className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            {isStaffFlow ? '返回控制台' : '返回聊天頁'}
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
        步驟：{step === 'setup' && '1. 醫師/協作服務與診所'}{step === 'timeslot' && '2. 日期與時間'}
        {step === 'details' && '3. 填寫資料'}{step === 'success' && '完成'}
      </div>

      {step === 'setup' && (
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">選擇醫師</span>
              <select
                value={doctorId}
                onChange={(event) => handleDoctorChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
              >
                <option value="">請選擇醫師或協作服務</option>
                {primaryDoctorOptions.length > 0 ? (
                  <optgroup label="中醫主診醫師">
                    {primaryDoctorOptions.map((doctor) => (
                      <option key={doctor.doctorId} value={doctor.doctorId}>
                        {formatDoctorOptionLabel(doctor)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {supportDoctorOptions.length > 0 ? (
                  <optgroup label="協作服務">
                    {supportDoctorOptions.map((doctor) => (
                      <option key={doctor.doctorId} value={doctor.doctorId}>
                        {formatDoctorOptionLabel(doctor)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            {supportDoctorOptions.length > 0 ? (
              <p className="text-xs leading-relaxed text-slate-500">
                中醫主診醫師優先顯示；協作脊醫服務列於下方。
              </p>
            ) : null}
          </div>

          {selectedDoctor && (
            <section className="rounded-[30px] border border-[#cfe1d3] bg-[linear-gradient(135deg,#f8fcf8_0%,#edf7f0_52%,#ffffff_100%)] p-4 shadow-[0_22px_56px_-42px_rgba(31,74,44,0.42)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <DoctorAvatar doctor={selectedDoctor} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.28em] text-[#5d8c67]">
                      {getSelectedScheduleEyebrow(selectedDoctor)}
                    </p>
                    <h2 className="mt-2 text-[1.35rem] font-semibold text-[#234230] sm:text-[1.5rem]">
                      {selectedDoctor.doctorNameZh}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      可先睇固定應診時間，再去下一步用彩色燈號比較各診所邊日有位。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-[#d6e7d8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#31533c]">
                        可選治療項目：{selectedDoctor.bookingTreatmentLabel}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#d6e7d8] bg-white/80 px-3 py-1 text-xs font-semibold text-[#31533c]">
                        {getSlotDurationLabel(selectedDoctor.bookingSlotMinutes)}
                      </span>
                      {isSupportBookingDoctor(selectedDoctor) ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {selectedDoctor.bookingRoleLabel}
                        </span>
                      ) : null}
                    </div>
                    {selectedDoctor.bookingSupportNote ? (
                      <p className="mt-3 text-xs leading-relaxed text-slate-500">
                        {selectedDoctor.bookingSupportNote}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#d5e7d8] bg-white/85 px-4 py-3 text-sm shadow-[0_12px_30px_-26px_rgba(31,74,44,0.4)] sm:max-w-[240px]">
                  <p className="text-[11px] font-semibold tracking-[0.24em] text-[#5d8c67]">
                    {getSelectedCardLabel(selectedDoctor)}
                  </p>
                  <p className="mt-1 font-semibold text-[#254430]">
                    {selectedDoctor.doctorNameZh}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {selectedClinic
                      ? `${selectedClinic.clinicNameZh} 已套用篩選，日曆只會顯示該診所燈號。`
                      : '未鎖定診所，下一步可直接比較全部診所日期。'}
                  </p>
                  {selectedDoctor.doctorId === 'wong' ? (
                    <Link
                      href="/dr-wong"
                      className="mt-3 inline-flex rounded-full border border-[#b8d7be] bg-[#f5fbf6] px-3 py-1.5 text-xs font-semibold text-[#1f6b3f] transition hover:border-[#71a97a] hover:bg-white"
                    >
                      查看 Dr Wong 專頁
                    </Link>
                  ) : null}
                </div>
              </div>

              {selectedDoctorNotices.length > 0 && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-2">
                    {selectedDoctorNotices.map((notice) => (
                      <div key={notice.id} className="flex flex-wrap items-start gap-2">
                        {!clinicId && notice.clinicNameZh && !notice.isStatic ? (
                          <span className="rounded-full border border-amber-300/80 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            {notice.clinicNameZh}
                          </span>
                        ) : null}
                        <p className="flex-1">{notice.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                {selectedDoctor.clinics.map((clinic) => {
                  const scheduleLines = formatScheduleLines(clinic.schedule);
                  const isChosenClinic = clinic.clinicId === clinicId;
                  const clinicStyle = CLINIC_AVAILABILITY_STYLES[clinic.clinicId];
                  const clinicSummary = clinicMonthlySummaries[clinic.clinicId];
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
                          ? `${clinic.clinicNameZh} 已選取，再按一次取消篩選`
                          : `選擇 ${clinic.clinicNameZh}`
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
                            {clinic.clinicNameZh}
                            <span className="ml-2 text-sm font-medium text-slate-400">
                              {clinic.clinicNameEn}
                            </span>
                          </p>
                          {clinic.nextEffectiveFrom ? (
                            <p className="mt-1 text-xs font-medium text-sky-700">
                              已排定新版本，{formatShortDate(clinic.nextEffectiveFrom)} 起更新
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${summaryClassName}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${summaryDotClassName}`} />
                            {clinicSummary?.label || '稍後更新'}
                          </span>
                          {isChosenClinic && (
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                              已選診所
                            </span>
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
                點按診所卡即可套用篩選；如顯示「本月餘下日子暫滿」，可到下一步按右箭嘴查看下月。
              </p>
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

          {selectedDoctor && !isOnlineConsultation ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">治療項目</p>
                <span className="text-xs font-medium text-slate-500">可留空，可多選</span>
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
                        <span className="block font-semibold">{option.labelZh}</span>
                        <span className="mt-1 block text-xs text-slate-500">{option.labelEn}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {needsTreatmentOtherDetails ? (
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">其他服務內容 *</span>
                  <input
                    value={formValues.treatmentOtherDetails}
                    onChange={(event) => updateFormField('treatmentOtherDetails', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="請註明想預約的其他服務"
                  />
                  {formErrors.treatmentOtherDetails ? (
                    <p className="text-xs text-red-600">{formErrors.treatmentOtherDetails}</p>
                  ) : null}
                </label>
              ) : null}

              <p className="text-xs leading-relaxed text-slate-500">
                如未確定做哪一項，可先留空，稍後到診時再確認。
              </p>
            </div>
          ) : null}

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
            clinicNameZh={selectedClinic?.clinicNameZh || '比較全部診所'}
            eyebrow={selectedDoctorSummaryEyebrow}
            details={compactDetails([
              !isOnlineConsultation
                ? treatmentSummaryDetail || (selectedDoctor ? `可選治療項目：${selectedDoctor.bookingTreatmentLabel}` : null)
                : null,
              `${VISIT_TYPE_LABELS[visitType]}．${getSlotDurationLabel(selectedDoctorSlotMinutes)}`,
              selectedClinic
                ? '日曆只顯示所選診所燈號。'
                : '日曆會同時顯示各診所燈號，方便直接比較日期。',
            ])}
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
              改為比較全部診所
            </button>
          ) : null}

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
                    <span>{clinic.clinicNameZh}有位</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${UNAVAILABLE_DOT_CLASS_NAME}`} />
                  <span>{clinicId ? '所選診所暫滿' : '全部診所暫滿'}</span>
                </span>
              </div>
            </div>

            {bookableDatesLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在掃描本月各診所可預約日子...
              </div>
            ) : null}

            {!bookableDatesLoading && bookableDatesError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {bookableDatesError}
              </div>
            ) : null}

            {selectedDate ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  已選日期：<span className="font-semibold text-slate-900">{formatDateForDisplay(selectedDate)}</span>
                </p>
                {!clinicId && selectedDateAllAvailableClinics.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-slate-700">此日可預約診所</p>
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
                          {clinic.clinicNameZh}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      先揀診所，再顯示當日可預約時段。
                    </p>
                  </div>
                ) : null}
                {clinicId &&
                selectedDateVisibleAvailableClinics.length === 0 &&
                selectedDateAllAvailableClinics.length > 0 ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    此日 {selectedClinic?.clinicNameZh} 暫滿，但其他診所仍有位。
                    <button
                      type="button"
                      onClick={() => handleClinicChange('')}
                      className="ml-2 font-semibold underline underline-offset-2"
                    >
                      改為比較全部診所
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">請先在日曆選擇日期，再選擇時段。</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">可預約時段</p>
            <p className="text-xs text-slate-500">
              {selectedDoctor
                ? `已按 ${selectedDoctor.doctorNameZh} 設定顯示 ${getSlotDurationLabel(selectedDoctorSlotMinutes)}。`
                : `已按醫師/協作服務設定顯示 ${getSlotDurationLabel(selectedDoctorSlotMinutes)}。`}
            </p>

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

            {!slotsLoading && !slotError && selectedDate && !clinicId ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                請先選擇當日有位的診所，再查看可預約時段。
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
            details={compactDetails([
              `${formatDateForDisplay(selectedDate)} ${selectedTime}`,
              !isOnlineConsultation
                ? treatmentSummaryDetail || (selectedDoctor ? `可選治療項目：${selectedDoctor.bookingTreatmentLabel}` : null)
                : null,
              `${VISIT_TYPE_LABELS[visitType]}．${getSlotDurationLabel(selectedDoctorSlotMinutes)}`,
            ])}
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
              }}
            />
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {hasAutofilledContact ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
                {isStaffFlow
                  ? '已從所選病人資料帶入聯絡資料，你可按需要修改。'
                  : '已從登入帳戶帶入可用聯絡資料，你可按需要修改。'}
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
              <span className="text-sm font-semibold text-slate-700">電郵（選填）</span>
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
            </div>

            {isOnlineConsultation ? (
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">取藥方法 *</span>
                <select
                  value={formValues.medicationPickup}
                  onChange={(event) =>
                    updateFormField('medicationPickup', event.target.value as BookingPickupSelection)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="">請選擇</option>
                  {pickupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                  如選擇送遞，請填寫中文寄送地址／順豐站點或智能櫃代碼
                </span>
                <input
                  value={formValues.shippingAddressDetails}
                  onChange={(event) => updateFormField('shippingAddressDetails', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="例如：九龍尖沙咀廣東道 88 號 xx 大廈 xx 室／順豐站代碼"
                />
                {formErrors.shippingAddressDetails ? (
                  <p className="text-xs text-red-600">{formErrors.shippingAddressDetails}</p>
                ) : null}
              </label>
            ) : null}

            {needsClinicPickupRemarks ? (
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">
                  若於診所取藥，請填寫取藥時間／其他備註
                </span>
                <textarea
                  value={formValues.clinicPickupRemarks}
                  onChange={(event) => updateFormField('clinicPickupRemarks', event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="例如：星期二 4pm 後可到中環診所取藥"
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
                  首診資料（必填）
                </p>

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
            {(isWhatsappFlow || isStaffFlow) && whatsappSent === false ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {isStaffFlow
                  ? '已完成代約，但 WhatsApp 確認訊息暫時未能自動發送，請姑娘跟進。'
                  : '已完成預約，但 WhatsApp 確認訊息暫時未能自動發送。診所會另行跟進。'}
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

          <div className={`grid gap-3 ${embedMode ? '' : 'sm:grid-cols-2'}`}>
            <button
              type="button"
              onClick={startAnotherBooking}
              className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              再預約一個時段
            </button>

            {!embedMode ? (
              <Link
                href={isStaffFlow ? '/doctor' : '/chat'}
                className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                {isStaffFlow ? '返回病人列表' : '返回聊天頁'}
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
