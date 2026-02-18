/**
 * Booking Conversation Helpers
 *
 * These functions are designed to be called by Gemini AI via Function Calling
 * to enable conversational booking flow in the chat interface.
 */

import { getBookableDoctors, getDoctorScheduleSummaryByNameZh } from '@/shared/clinic-schedule-data';
import { DOCTOR_BY_NAME_ZH, CLINIC_BY_ID, CLINIC_ID_BY_NAME_ZH, getClinicAddress } from '@/shared/clinic-data';
import { CALENDAR_MAPPINGS } from '@/shared/schedule-config';
import { getFreeBusy } from './google-calendar';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { createBooking, deleteEvent, listEventsInRange } from './google-calendar';
import { sendBookingConfirmationEmail } from './gmail';
import { createServiceClient } from './supabase';
import { z } from 'zod';
import {
  createPendingBookingIntake,
  markBookingIntakeConfirmed,
  markBookingIntakeFailed,
  type BookingGender,
  type BookingPickupType,
  type BookingReceiptType,
  type BookingVisitType,
} from './booking-intake-storage';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_DURATION_MINUTES = 15;
const MAX_LIST_BOOKINGS_LIMIT = 10;
const DEFAULT_LIST_BOOKINGS_LIMIT = 5;
const DEFAULT_RECENT_BOOKINGS_LIMIT = 3;
const CALENDAR_LOOKBACK_DAYS = 180;
const CALENDAR_LOOKAHEAD_DAYS = 365;

const RECEIPT_LABELS: Record<BookingReceiptType, string> = {
  no: '不用',
  yes_insurance: '是，保險索償',
  yes_not_insurance: '是，但非保險',
};

const PICKUP_LABELS: Record<BookingPickupType, string> = {
  none: '不需要',
  lalamove: 'Lalamove',
  sfexpress: '順豐 SF Express',
  clinic_pickup: '診所自取',
};

const GENDER_LABELS: Record<BookingGender, string> = {
  male: '男 Male',
  female: '女 Female',
  other: '其他 Other',
};

const conversationalBookingSchema = z
  .object({
    doctorNameZh: z.string().trim().min(1, '請提供醫師名稱'),
    clinicNameZh: z.string().trim().min(1, '請提供診所名稱'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/, '時間格式需為 HH:mm'),
    patientName: z.string().trim().min(2, '請提供病人姓名'),
    phone: z.string().trim().min(8, '請提供有效電話號碼'),
    email: z.string().trim().email('請提供有效電郵地址'),
    visitType: z.enum(['first', 'followup'], {
      errorMap: () => ({ message: '請先選擇首診或覆診' }),
    }),
    needReceipt: z.enum(['no', 'yes_insurance', 'yes_not_insurance'], {
      errorMap: () => ({ message: '請先選擇收據需求' }),
    }),
    medicationPickup: z.enum(['none', 'lalamove', 'sfexpress', 'clinic_pickup'], {
      errorMap: () => ({ message: '請先選擇取藥方法' }),
    }),
    idCard: z.string().trim().optional(),
    dob: z.string().trim().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    allergies: z.string().trim().optional(),
    medications: z.string().trim().optional(),
    symptoms: z.string().trim().optional(),
    referralSource: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.visitType !== 'first') return;

    const requiredFields: Array<{
      key: keyof typeof value;
      message: string;
    }> = [
      { key: 'idCard', message: '首診需要身份證資料' },
      { key: 'dob', message: '首診需要出生日期' },
      { key: 'gender', message: '首診需要性別資料' },
      { key: 'allergies', message: '首診需要過敏史資料' },
      { key: 'medications', message: '首診需要現正服用藥物資料' },
      { key: 'symptoms', message: '首診需要主要症狀資料' },
      { key: 'referralSource', message: '首診需要得知來源資料' },
    ];

    for (const field of requiredFields) {
      const rawValue = value[field.key];
      if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        continue;
      }
      if (rawValue) continue;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field.key],
        message: field.message,
      });
    }
  });

export type BookingRequest = z.infer<typeof conversationalBookingSchema>;

export interface BookingCreationContext {
  userId?: string;
  sessionId?: string;
}

function toSafeText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildStructuredBookingNotes(request: BookingRequest): string {
  const base = [
    request.visitType === 'first' ? '[首診]' : '[覆診]',
    `Receipt: ${RECEIPT_LABELS[request.needReceipt]}`,
    `取藥方法: ${PICKUP_LABELS[request.medicationPickup]}`,
  ];

  if (request.visitType === 'first') {
    base.push(
      `ID: ${request.idCard}`,
      `DOB: ${request.dob}`,
      `Gender: ${request.gender ? GENDER_LABELS[request.gender] : 'N/A'}`,
      `Allergies: ${request.allergies}`,
      `Medications: ${request.medications}`,
      `Symptoms: ${request.symptoms}`,
      `Referral: ${request.referralSource}`,
    );
  }

  const extraNotes = toSafeText(request.notes);
  if (extraNotes) {
    base.push(`User Notes: ${extraNotes}`);
  }

  return base.join(' | ');
}

function formatBookingValidationError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return '預約資料未齊，請補充資料後再試。';
  }
  const field = firstIssue.path.join('.');
  if (!field) {
    return firstIssue.message;
  }
  return `資料未齊（${field}）：${firstIssue.message}`;
}

// ---------------------------------------------------------------------------
// 1. List Bookable Doctors
// ---------------------------------------------------------------------------

export interface DoctorInfo {
  nameZh: string;
  nameEn: string;
  scheduleSummary: string;
}

type BookingOptionMissingField = 'doctorNameZh' | 'date' | 'clinicNameZh';

export interface BookingOptionsRequest {
  doctorNameZh?: string;
  date?: string;
  clinicNameZh?: string;
}

export interface BookingOptionsResult {
  success: boolean;
  doctors?: DoctorInfo[];
  selectedDoctor?: string;
  clinics?: string[];
  availableSlots?: string[];
  missingFields?: BookingOptionMissingField[];
  nextQuestion?: string;
  error?: string;
}

export interface MyBookingInfo {
  intakeId: string;
  status: string;
  doctorNameZh: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  googleEventId: string | null;
  calendarId: string | null;
}

interface RawBookingIntakeRow {
  id: string;
  status: string;
  doctor_name_zh: string;
  clinic_name_zh: string;
  appointment_date: string;
  appointment_time: string;
  google_event_id: string | null;
  calendar_id: string | null;
}

interface ListMyBookingsOptions {
  userEmail?: string;
  limit?: number;
  recentLimit?: number;
}

interface CalendarEventLike {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
  attendees?: Array<{
    email?: string | null;
  }> | null;
}

function getTodayInHongKongDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function clampPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, MAX_LIST_BOOKINGS_LIMIT);
}

function mapBookingRow(row: RawBookingIntakeRow): MyBookingInfo {
  return {
    intakeId: row.id,
    status: row.status,
    doctorNameZh: row.doctor_name_zh,
    clinicNameZh: row.clinic_name_zh,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
  };
}

function isRawBookingIntakeRow(value: unknown): value is RawBookingIntakeRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.status === 'string' &&
    typeof row.doctor_name_zh === 'string' &&
    typeof row.clinic_name_zh === 'string' &&
    typeof row.appointment_date === 'string' &&
    typeof row.appointment_time === 'string'
  );
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseLineValue(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() || '';
}

function extractEventDateAndTime(event: CalendarEventLike): { date: string; time: string } | null {
  const dateTime = event.start?.dateTime;
  if (typeof dateTime === 'string' && dateTime.trim()) {
    const start = new Date(dateTime);
    if (Number.isNaN(start.getTime())) return null;
    return {
      date: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'yyyy-MM-dd'),
      time: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'HH:mm'),
    };
  }

  const date = event.start?.date;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { date, time: '00:00' };
  }

  return null;
}

function extractEventEmail(event: CalendarEventLike): string | null {
  const description = typeof event.description === 'string' ? event.description : '';
  const emailFromDescription = parseLineValue(description, 'Email / 電郵');
  if (emailFromDescription) return normalizeEmail(emailFromDescription);

  if (Array.isArray(event.attendees)) {
    const matched = event.attendees.find(
      (attendee) => typeof attendee?.email === 'string' && attendee.email.trim().length > 0
    );
    if (matched?.email) return normalizeEmail(matched.email);
  }

  return null;
}

function extractDoctorNameZh(event: CalendarEventLike): string {
  const description = typeof event.description === 'string' ? event.description : '';
  const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
  if (doctorMatch?.[1]) return doctorMatch[1].trim();
  return '醫師資料未提供';
}

function extractClinicNameZh(event: CalendarEventLike): string {
  const description = typeof event.description === 'string' ? event.description : '';
  const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);
  if (clinicMatch?.[1]) return clinicMatch[1].trim();
  return '診所資料未提供';
}

async function listBookingsFromCalendarByEmail(
  email: string,
  today: string,
  bookingLimit: number,
  recentLimit: number
): Promise<{ upcomingRows: RawBookingIntakeRow[]; recentRows: RawBookingIntakeRow[] }> {
  const normalizedEmail = normalizeEmail(email);
  const activeCalendarIds = Array.from(
    new Set(
      CALENDAR_MAPPINGS.filter((mapping) => mapping.isActive && mapping.calendarId)
        .map((mapping) => mapping.calendarId)
    )
  );

  if (activeCalendarIds.length === 0) {
    return { upcomingRows: [], recentRows: [] };
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - CALENDAR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const listResults = await Promise.all(
    activeCalendarIds.map(async (calendarId) => ({
      calendarId,
      result: await listEventsInRange(calendarId, windowStart, windowEnd),
    }))
  );

  const allRows: RawBookingIntakeRow[] = [];
  const seen = new Set<string>();

  for (const { calendarId, result } of listResults) {
    if (!result.success) continue;
    for (const event of (result.events || []) as CalendarEventLike[]) {
      if (event?.status === 'cancelled') continue;

      const eventEmail = extractEventEmail(event);
      if (!eventEmail || eventEmail !== normalizedEmail) continue;

      const eventDateTime = extractEventDateAndTime(event);
      if (!eventDateTime) continue;

      const rawEventId =
        typeof event.id === 'string' && event.id.trim().length > 0 ? event.id.trim() : '';
      const dedupeKey = rawEventId ? `${calendarId}:${rawEventId}` : '';
      if (dedupeKey && seen.has(dedupeKey)) continue;
      if (dedupeKey) seen.add(dedupeKey);

      const syntheticId = rawEventId
        ? `gcal:${calendarId}:${rawEventId}`
        : `gcal:${calendarId}:${eventDateTime.date}:${eventDateTime.time}:${allRows.length + 1}`;

      allRows.push({
        id: syntheticId,
        status: 'confirmed',
        doctor_name_zh: extractDoctorNameZh(event),
        clinic_name_zh: extractClinicNameZh(event),
        appointment_date: eventDateTime.date,
        appointment_time: eventDateTime.time,
        google_event_id: rawEventId || null,
        calendar_id: calendarId,
      });
    }
  }

  const upcomingRows = allRows
    .filter((row) => row.appointment_date >= today)
    .sort((a, b) =>
      a.appointment_date === b.appointment_date
        ? a.appointment_time.localeCompare(b.appointment_time)
        : a.appointment_date.localeCompare(b.appointment_date)
    )
    .slice(0, bookingLimit);

  const recentRows = allRows
    .filter((row) => row.appointment_date < today)
    .sort((a, b) =>
      a.appointment_date === b.appointment_date
        ? b.appointment_time.localeCompare(a.appointment_time)
        : b.appointment_date.localeCompare(a.appointment_date)
    )
    .slice(0, recentLimit);

  return { upcomingRows, recentRows };
}

/**
 * List all doctors that have active booking schedules
 */
export async function listBookableDoctors(): Promise<{ doctors: DoctorInfo[] }> {
  const doctors = getBookableDoctors();

  const doctorList = doctors.map(doctor => {
    const scheduleSummary = getDoctorScheduleSummaryByNameZh(doctor.nameZh) || '暫無時間表';
    return {
      nameZh: doctor.nameZh,
      nameEn: doctor.nameEn,
      scheduleSummary,
    };
  });

  // IMPORTANT: Gemini API requires response to be an object, not an array
  return { doctors: doctorList };
}

function getClinicsForDoctor(doctorNameZh: string): string[] {
  const doctor = DOCTOR_BY_NAME_ZH[doctorNameZh];
  if (!doctor) return [];

  const doctorMappings = CALENDAR_MAPPINGS.filter(
    (mapping) => mapping.doctorId === doctor.id && mapping.isActive
  );

  return [...new Set(
    doctorMappings
      .map((mapping) => CLINIC_BY_ID[mapping.clinicId]?.nameZh)
      .filter((name): name is string => Boolean(name))
  )];
}

/**
 * Combined helper for booking discovery. This collapses doctor/clinic/slot lookup
 * into one function-call entrypoint to reduce LLM tool-call round trips.
 */
export async function getBookingOptions(
  request: BookingOptionsRequest
): Promise<BookingOptionsResult> {
  const doctorNameZh = toSafeText(request.doctorNameZh);
  const date = toSafeText(request.date);
  const clinicNameZh = toSafeText(request.clinicNameZh);
  const doctors = (await listBookableDoctors()).doctors;

  if (!doctorNameZh) {
    return {
      success: true,
      doctors,
      missingFields: ['doctorNameZh'],
      nextQuestion: '請問你想預約邊位醫師？',
    };
  }

  if (!DOCTOR_BY_NAME_ZH[doctorNameZh]) {
    return {
      success: false,
      doctors,
      error: `找不到醫師：${doctorNameZh}`,
      missingFields: ['doctorNameZh'],
      nextQuestion: '請從現有醫師中選擇一位。',
    };
  }

  const clinics = getClinicsForDoctor(doctorNameZh);

  if (!date) {
    return {
      success: true,
      doctors,
      selectedDoctor: doctorNameZh,
      clinics,
      missingFields: ['date'],
      nextQuestion: '請問你想預約邊一日？請用 YYYY-MM-DD。',
    };
  }

  if (!clinicNameZh) {
    return {
      success: true,
      doctors,
      selectedDoctor: doctorNameZh,
      clinics,
      missingFields: ['clinicNameZh'],
      nextQuestion: '請問你想去邊間診所（中環／佐敦／荃灣）？',
    };
  }

  const slotsResult = await getAvailableTimeSlots(doctorNameZh, date, clinicNameZh);
  if (!slotsResult.success) {
    return {
      success: false,
      doctors,
      selectedDoctor: doctorNameZh,
      clinics,
      error: slotsResult.error,
    };
  }

  const availableSlots = (slotsResult.slots ?? [])
    .filter((slot) => slot.available)
    .map((slot) => slot.time);

  return {
    success: true,
    doctors,
    selectedDoctor: doctorNameZh,
    clinics,
    availableSlots,
    missingFields: [],
    nextQuestion:
      availableSlots.length > 0
        ? '請問你想揀邊個時段？'
        : '該日暫時冇可用時段，想唔想轉另一日？',
  };
}

// ---------------------------------------------------------------------------
// 1.5 List My Bookings
// ---------------------------------------------------------------------------

/**
 * List a user's upcoming bookings and recent booking history.
 * Primary lookup is user_id. If there are no user_id matches, fallback to
 * records booked with the same email (case-insensitive).
 */
export async function listMyBookings(
  userId: string,
  options?: ListMyBookingsOptions
): Promise<{
  success: boolean;
  upcomingBookings?: MyBookingInfo[];
  recentBookings?: MyBookingInfo[];
  usedEmailFallback?: boolean;
  error?: string;
}> {
  try {
    const supabase = createServiceClient();
    const today = getTodayInHongKongDate();
    const fallbackEmail = options?.userEmail?.trim();
    const bookingLimit = clampPositiveInteger(
      options?.limit ?? DEFAULT_LIST_BOOKINGS_LIMIT,
      DEFAULT_LIST_BOOKINGS_LIMIT
    );
    const recentLimit = clampPositiveInteger(
      options?.recentLimit ?? DEFAULT_RECENT_BOOKINGS_LIMIT,
      DEFAULT_RECENT_BOOKINGS_LIMIT
    );

    const selectFields = [
      'id',
      'status',
      'doctor_name_zh',
      'clinic_name_zh',
      'appointment_date',
      'appointment_time',
      'google_event_id',
      'calendar_id',
    ].join(', ');

    const upcomingByUser = await supabase
      .from('booking_intake')
      .select(selectFields)
      .eq('user_id', userId)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(bookingLimit);

    if (upcomingByUser.error) {
      return { success: false, error: upcomingByUser.error.message };
    }

    let usedEmailFallback = false;
    const upcomingByUserData = (upcomingByUser.data || []) as unknown[];
    let upcomingRows = upcomingByUserData.filter(isRawBookingIntakeRow);

    if (upcomingRows.length === 0 && fallbackEmail) {
      const upcomingByEmail = await supabase
        .from('booking_intake')
        .select(selectFields)
        .ilike('email', fallbackEmail)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', today)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })
        .limit(bookingLimit);

      if (upcomingByEmail.error) {
        return { success: false, error: upcomingByEmail.error.message };
      }

      const upcomingByEmailData = (upcomingByEmail.data || []) as unknown[];
      upcomingRows = upcomingByEmailData.filter(isRawBookingIntakeRow);
      if (upcomingRows.length > 0) {
        usedEmailFallback = true;
      }
    }

    let recentRows: RawBookingIntakeRow[] = [];

    const recentByUser = await supabase
      .from('booking_intake')
      .select(selectFields)
      .eq('user_id', userId)
      .in('status', ['confirmed', 'cancelled'])
      .lt('appointment_date', today)
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false })
      .limit(recentLimit);

    if (recentByUser.error) {
      return { success: false, error: recentByUser.error.message };
    }

    const recentByUserData = (recentByUser.data || []) as unknown[];
    recentRows = recentByUserData.filter(isRawBookingIntakeRow);

    if (recentRows.length === 0 && fallbackEmail) {
      const recentByEmail = await supabase
        .from('booking_intake')
        .select(selectFields)
        .ilike('email', fallbackEmail)
        .in('status', ['confirmed', 'cancelled'])
        .lt('appointment_date', today)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(recentLimit);

      if (recentByEmail.error) {
        return { success: false, error: recentByEmail.error.message };
      }

      const recentByEmailData = (recentByEmail.data || []) as unknown[];
      recentRows = recentByEmailData.filter(isRawBookingIntakeRow);
      if (recentRows.length > 0) {
        usedEmailFallback = true;
      }
    }

    if (fallbackEmail && upcomingRows.length === 0 && recentRows.length === 0) {
      const calendarFallback = await listBookingsFromCalendarByEmail(
        fallbackEmail,
        today,
        bookingLimit,
        recentLimit
      );
      if (calendarFallback.upcomingRows.length > 0 || calendarFallback.recentRows.length > 0) {
        upcomingRows = calendarFallback.upcomingRows;
        recentRows = calendarFallback.recentRows;
        usedEmailFallback = true;
      }
    }

    return {
      success: true,
      upcomingBookings: upcomingRows.map(mapBookingRow),
      recentBookings: recentRows.map(mapBookingRow),
      usedEmailFallback,
    };
  } catch (error) {
    console.error('[listMyBookings] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢預約紀錄時發生錯誤',
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Get Available Time Slots
// ---------------------------------------------------------------------------

export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
}

/**
 * Get available time slots for a doctor at a specific clinic on a specific date
 */
export async function getAvailableTimeSlots(
  doctorNameZh: string,
  date: string, // YYYY-MM-DD format
  clinicNameZh?: string
): Promise<{
  success: boolean;
  slots?: TimeSlot[];
  clinics?: string[]; // If clinic not specified, return available clinics
  error?: string;
}> {
  try {
    // Validate doctor
    const doctor = DOCTOR_BY_NAME_ZH[doctorNameZh];
    if (!doctor) {
      return { success: false, error: `找不到醫師：${doctorNameZh}` };
    }

    const doctorId = doctor.id;

    // Get all active mappings for this doctor
    const doctorMappings = CALENDAR_MAPPINGS.filter(
      mapping => mapping.doctorId === doctorId && mapping.isActive
    );

    if (doctorMappings.length === 0) {
      return { success: false, error: `${doctorNameZh} 暫時沒有可預約時段` };
    }

    // If clinic not specified, return list of available clinics
    if (!clinicNameZh) {
      const availableClinics = doctorMappings
        .map(m => CLINIC_BY_ID[m.clinicId]?.nameZh)
        .filter((name): name is string => Boolean(name));

      return {
        success: true,
        clinics: [...new Set(availableClinics)], // Remove duplicates
      };
    }

    // Validate clinic
    const clinicId = CLINIC_ID_BY_NAME_ZH[clinicNameZh];
    if (!clinicId) {
      return { success: false, error: `找不到診所：${clinicNameZh}` };
    }

    // Find mapping for this doctor + clinic
    const mapping = doctorMappings.find(m => m.clinicId === clinicId);
    if (!mapping) {
      return { success: false, error: `${doctorNameZh} 在 ${clinicNameZh} 沒有可預約時段` };
    }

    // Parse date and get day of week
    const requestDate = new Date(date);
    if (isNaN(requestDate.getTime())) {
      return { success: false, error: `無效日期格式：${date}` };
    }

    const dayOfWeek = requestDate.getDay(); // 0 = Sunday, 6 = Saturday
    const daySchedule = mapping.schedule[dayOfWeek];

    if (!daySchedule || daySchedule.length === 0) {
      return { success: false, error: `${doctorNameZh} 在 ${clinicNameZh} 於${date}沒有診症` };
    }

    // Get busy slots from Google Calendar
    const requestDateUtc = fromZonedTime(`${date}T00:00:00`, HONG_KONG_TIMEZONE);
    const busySlots = await getFreeBusy(mapping.calendarId, requestDateUtc);

    // Generate time slots based on schedule ranges
    const timeSlots: TimeSlot[] = [];

    for (const range of daySchedule) {
      const [startHour, startMinute] = range.start.split(':').map(Number);
      const [endHour, endMinute] = range.end.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      while (
        currentHour < endHour ||
        (currentHour === endHour && currentMinute < endMinute)
      ) {
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        // Check if this slot is available
        const slotStart = fromZonedTime(`${date}T${timeStr}:00`, HONG_KONG_TIMEZONE);
        const slotEnd = new Date(slotStart.getTime() + DEFAULT_DURATION_MINUTES * 60000);

        const isAvailable = !busySlots.some(busy => {
          return (
            (slotStart >= busy.start && slotStart < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (slotStart <= busy.start && slotEnd >= busy.end)
          );
        });

        timeSlots.push({
          time: timeStr,
          available: isAvailable,
        });

        // Increment by 15 minutes
        currentMinute += 15;
        if (currentMinute >= 60) {
          currentMinute -= 60;
          currentHour += 1;
        }
      }
    }

    return {
      success: true,
      slots: timeSlots,
    };
  } catch (error) {
    console.error('[getAvailableTimeSlots] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢時段時發生錯誤',
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Create Booking
// ---------------------------------------------------------------------------

/**
 * Create a booking for the patient.
 * Workflow: Supabase intake (pending) -> Google Calendar -> Supabase intake (confirmed)
 */
export async function createConversationalBooking(
  request: BookingRequest,
  context?: BookingCreationContext
): Promise<{
  success: boolean;
  bookingId?: string;
  error?: string;
}> {
  try {
    const parsed = conversationalBookingSchema.safeParse(request);
    if (!parsed.success) {
      return {
        success: false,
        error: formatBookingValidationError(parsed.error),
      };
    }
    const bookingData = parsed.data;

    // Validate doctor
    const doctor = DOCTOR_BY_NAME_ZH[bookingData.doctorNameZh];
    if (!doctor) {
      return { success: false, error: `找不到醫師：${bookingData.doctorNameZh}` };
    }

    // Validate clinic
    const clinicId = CLINIC_ID_BY_NAME_ZH[bookingData.clinicNameZh];
    if (!clinicId) {
      return { success: false, error: `找不到診所：${bookingData.clinicNameZh}` };
    }

    const clinic = CLINIC_BY_ID[clinicId];
    if (!clinic) {
      return { success: false, error: `找不到診所：${bookingData.clinicNameZh}` };
    }

    // Find calendar mapping
    const mapping = CALENDAR_MAPPINGS.find(
      (m) => m.doctorId === doctor.id && m.clinicId === clinicId && m.isActive
    );

    if (!mapping) {
      return {
        success: false,
        error: `${bookingData.doctorNameZh} 在 ${bookingData.clinicNameZh} 沒有可預約時段`,
      };
    }

    // Calculate start and end times
    const startDate = fromZonedTime(
      `${bookingData.date}T${bookingData.time}:00`,
      HONG_KONG_TIMEZONE
    );

    if (isNaN(startDate.getTime())) {
      return { success: false, error: "無效的日期或時間" };
    }

    const endDate = new Date(
      startDate.getTime() + DEFAULT_DURATION_MINUTES * 60000
    );

    // Re-check availability to prevent race conditions
    const requestDateUtc = fromZonedTime(
      `${bookingData.date}T00:00:00`,
      HONG_KONG_TIMEZONE
    );
    const busySlots = await getFreeBusy(mapping.calendarId, requestDateUtc);

    const isStillAvailable = !busySlots.some((busy) => {
      return (
        (startDate >= busy.start && startDate < busy.end) ||
        (endDate > busy.start && endDate <= busy.end) ||
        (startDate <= busy.start && endDate >= busy.end)
      );
    });

    if (!isStillAvailable) {
      return {
        success: false,
        error: "呢個時段啱啱俾人預約咗，請揀另一個時段",
      };
    }

    const notes = buildStructuredBookingNotes(bookingData);

    // Persist intake first. If this fails, stop before writing Google Calendar.
    const intakeCreate = await createPendingBookingIntake({
      source: "chat_v2",
      userId: context?.userId,
      sessionId: context?.sessionId,
      doctorId: doctor.id,
      doctorNameZh: doctor.nameZh,
      clinicId: clinic.id,
      clinicNameZh: clinic.nameZh,
      appointmentDate: bookingData.date,
      appointmentTime: bookingData.time,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      visitType: bookingData.visitType as BookingVisitType,
      needReceipt: bookingData.needReceipt as BookingReceiptType,
      medicationPickup: bookingData.medicationPickup as BookingPickupType,
      idCard: toSafeText(bookingData.idCard),
      dob: toSafeText(bookingData.dob),
      gender: bookingData.gender,
      allergies: toSafeText(bookingData.allergies),
      medications: toSafeText(bookingData.medications),
      symptoms: toSafeText(bookingData.symptoms),
      referralSource: toSafeText(bookingData.referralSource),
      notes,
      bookingPayload: bookingData,
    });

    if (!intakeCreate.success || !intakeCreate.intakeId) {
      return {
        success: false,
        error: "暫時未能儲存預約表單，請稍後再試。",
      };
    }

    // Create booking in Google Calendar
    const result = await createBooking(mapping.calendarId, {
      doctorName: doctor.nameEn,
      doctorNameZh: doctor.nameZh,
      clinicName: clinic.nameEn,
      clinicNameZh: clinic.nameZh,
      startTime: startDate,
      endTime: endDate,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      notes,
    });

    if (!result.success || !result.eventId) {
      await markBookingIntakeFailed({
        intakeId: intakeCreate.intakeId,
        reason: result.error || "Failed to create booking in calendar",
      });
      return {
        success: false,
        error: result.error || "創建預約失敗",
      };
    }

    // Link intake record to Google event. If this fails, try to rollback event creation.
    const intakeConfirm = await markBookingIntakeConfirmed({
      intakeId: intakeCreate.intakeId,
      googleEventId: result.eventId,
      calendarId: mapping.calendarId,
    });

    if (!intakeConfirm.success) {
      const rollback = await deleteEvent(mapping.calendarId, result.eventId);
      await markBookingIntakeFailed({
        intakeId: intakeCreate.intakeId,
        reason: `Confirm sync failed: ${intakeConfirm.error || "unknown error"}`,
      });

      if (!rollback.success) {
        return {
          success: false,
          error: "預約同步失敗，請立即聯絡診所確認預約狀態。",
        };
      }

      return {
        success: false,
        error: "系統同步失敗，預約未完成，請再試一次。",
      };
    }

    // Send email confirmation (best effort)
    const clinicAddress = getClinicAddress(clinic.nameZh);
    const emailResult = await sendBookingConfirmationEmail({
      patientName: bookingData.patientName,
      patientEmail: bookingData.email,
      doctorName: doctor.nameEn,
      doctorNameZh: doctor.nameZh,
      clinicName: clinic.nameEn,
      clinicNameZh: clinic.nameZh,
      clinicAddress: clinicAddress,
      date: bookingData.date,
      time: bookingData.time,
      eventId: result.eventId,
      calendarId: mapping.calendarId,
    });

    if (!emailResult.success) {
      console.error(
        "[createConversationalBooking] Failed to send email:",
        emailResult.error
      );
    }

    return {
      success: true,
      bookingId: result.eventId,
    };
  } catch (error) {
    console.error("[createConversationalBooking] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "創建預約時發生錯誤",
    };
  }
}
