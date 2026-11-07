import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { type CalendarMapping, WeeklySchedule, TimeRange } from '../shared/schedule-config';
import { type Holiday } from '../shared/schema';
import { getDoctorBookingSlotMinutes, PHYSICAL_CLINIC_IDS, type PhysicalClinicId } from '../shared/clinic-data';
import { getHolidaysForDate } from './holiday-store';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
// Morning sessions end at 14:00; only slots starting before then use the lunch
// cutoff. Afternoon sessions that start earlier than 15:00 (e.g. 14:30) use the
// evening cutoff instead of being blocked by the lunch one.
const MORNING_SESSION_END_MINUTES = 14 * 60;
const SAME_DAY_EVENING_BOOKING_CUTOFF_MINUTES = 19 * 60;
// These earlier last-booking times apply only to Dr. Lee and Dr. Chau.
const LAST_BOOKING_CUTOFF_DOCTOR_IDS = new Set(['lee', 'chau']);
const CLINIC_LAST_BOOKING_CUTOFFS: Record<
  PhysicalClinicId,
  { lunch: string; evening: string }
> = {
  central: { lunch: '13:15', evening: '18:45' },
  jordan: { lunch: '13:15', evening: '18:45' },
  tsuenwan: { lunch: '13:15', evening: '18:15' },
};

// Helper: Get schedule for a specific day from weekly schedule
export function getScheduleForDayFromWeekly(schedule: WeeklySchedule | undefined | null, dayOfWeek: number): TimeRange[] | null {
  if (!schedule) return null;
  return schedule[dayOfWeek] || null;
}

function isHolidayScopeMatched(holiday: Holiday, doctorId?: string, clinicId?: string): boolean {
  if (!holiday.doctorId && !holiday.clinicId) return true;
  if (holiday.doctorId && holiday.doctorId !== doctorId) return false;
  if (holiday.clinicId && holiday.clinicId !== clinicId) return false;
  return true;
}

export async function getApplicableHolidaysForDate(
  date: string,
  doctorId?: string,
  clinicId?: string
): Promise<Holiday[]> {
  const holidays = await getHolidaysForDate(date);
  if (holidays.length === 0) return [];
  return holidays.filter((holiday) => isHolidayScopeMatched(holiday, doctorId, clinicId));
}

function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})(:\d{2})?$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isPhysicalClinicId(clinicId: string): clinicId is PhysicalClinicId {
  return PHYSICAL_CLINIC_IDS.includes(clinicId as PhysicalClinicId);
}

function getClinicLastBookingCutoffTime(
  clinicId: string,
  slotStartMinutes: number
): string | null {
  if (!isPhysicalClinicId(clinicId)) {
    return null;
  }

  const cutoffs = CLINIC_LAST_BOOKING_CUTOFFS[clinicId];
  return slotStartMinutes < MORNING_SESSION_END_MINUTES
    ? cutoffs.lunch
    : cutoffs.evening;
}

function getHolidayMinutes(holiday: Holiday): { start: number; end: number } | null {
  if (!holiday.startTime || !holiday.endTime) return null;
  const start = toMinutes(String(holiday.startTime));
  const end = toMinutes(String(holiday.endTime));
  if (start === null || end === null) return null;
  if (start >= end) return null;
  return { start, end };
}

function isSlotBlockedByHoliday(slotStartMin: number, slotEndMin: number, holiday: Holiday): boolean {
  // Backward compatibility: rows without explicit time range are all-day blocks
  const holidayMinutes = getHolidayMinutes(holiday);
  if (!holidayMinutes) {
    return true;
  }

  return slotStartMin < holidayMinutes.end && slotEndMin > holidayMinutes.start;
}

function getSlotMinutesInHongKong(slotStartUtc: Date, slotEndUtc: Date): { start: number; end: number } | null {
  const slotStart = formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'HH:mm');
  const slotEnd = formatInTimeZone(slotEndUtc, HONG_KONG_TIMEZONE, 'HH:mm');
  const start = toMinutes(slotStart);
  const end = toMinutes(slotEnd);
  if (start === null || end === null) return null;
  if (start >= end) return null;
  return { start, end };
}

export function hasDoctorLastBookingCutoff(doctorId: string): boolean {
  return LAST_BOOKING_CUTOFF_DOCTOR_IDS.has(doctorId);
}

export function isSlotAfterClinicLastBookingCutoffUtc(
  slotStartUtc: Date,
  clinicId: string | null | undefined,
  doctorId: string
): boolean {
  if (!clinicId || !hasDoctorLastBookingCutoff(doctorId)) return false;

  const slotStartLabel = formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'HH:mm');
  const slotStartMinutes = toMinutes(slotStartLabel);
  if (slotStartMinutes === null) {
    return false;
  }

  // Dr. Lee's Saturday Jordan session closes at 18:30; last booking is 17:45.
  const isLeeSaturdayJordanEvening = doctorId === 'lee' && clinicId === 'jordan'
    && formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'i') === '6'
    && slotStartMinutes >= MORNING_SESSION_END_MINUTES;
  const cutoffTime = isLeeSaturdayJordanEvening
    ? '17:45'
    : getClinicLastBookingCutoffTime(clinicId, slotStartMinutes);
  if (!cutoffTime) {
    return false;
  }

  const cutoffMinutes = toMinutes(cutoffTime);
  if (cutoffMinutes === null) {
    return false;
  }

  return slotStartMinutes > cutoffMinutes;
}

export function isSlotBlockedByOnlineSourceLastBookingCutoffUtc(
  slotStartUtc: Date,
  doctorId: string,
  sourceMappings: readonly CalendarMapping[]
): boolean {
  if (!hasDoctorLastBookingCutoff(doctorId)) return false;

  const dayOfWeek = Number(formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'i')) % 7;
  const slotMinutes = toMinutes(formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'HH:mm'));
  if (slotMinutes === null) return false;

  const daySources = sourceMappings.filter((mapping) => mapping.doctorId === doctorId
    && mapping.isActive && isPhysicalClinicId(mapping.clinicId)
    && (mapping.schedule[dayOfWeek]?.length ?? 0) > 0);
  // A doctor may work at different clinics before and after lunch. Dedicated
  // online calendars inherit that session's clinic cutoff without changing
  // their calendar ID or their configured opening hours.
  const sessionSources = daySources.filter((mapping) => mapping.schedule[dayOfWeek]?.some((range) => {
    const start = toMinutes(range.start);
    return start !== null && (start < MORNING_SESSION_END_MINUTES) === (slotMinutes < MORNING_SESSION_END_MINUTES);
  }));
  const sources = sessionSources.length > 0 ? sessionSources : daySources;
  return sources.length > 0 && sources.every((mapping) =>
    isSlotAfterClinicLastBookingCutoffUtc(slotStartUtc, mapping.clinicId, doctorId));
}

export function isLastClinicSessionBooking(
  mapping: CalendarMapping,
  date: string,
  appointmentTime: string,
  appointmentEndTime: string,
): boolean {
  const { clinicId, doctorId } = mapping;
  if (!isPhysicalClinicId(clinicId)) return false;

  const appointmentStart = toMinutes(appointmentTime);
  const appointmentEnd = toMinutes(appointmentEndTime);
  if (appointmentStart === null || appointmentEnd === null || appointmentStart >= appointmentEnd) return false;

  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const session = getScheduleForDayFromWeekly(mapping.schedule, day)?.find(
    range => range.start <= appointmentTime && appointmentTime < range.end,
  );
  if (!session) return false;

  const sessionStart = toMinutes(session.start);
  const sessionEnd = toMinutes(session.end);
  if (sessionStart === null || sessionEnd === null || appointmentEnd > sessionEnd) return false;

  const dayStart = fromZonedTime(`${date}T00:00:00`, HONG_KONG_TIMEZONE).getTime();
  const atMinute = (minute: number) => new Date(dayStart + minute * 60_000);
  if (isSlotAfterClinicLastBookingCutoffUtc(atMinute(appointmentStart), clinicId, doctorId)) return false;

  const slotLengths = new Set([
    getDoctorBookingSlotMinutes(doctorId, 'first'),
    getDoctorBookingSlotMinutes(doctorId, 'followup'),
  ]);
  for (const length of slotLengths) {
    const nextSlot = sessionStart + Math.ceil((appointmentEnd - sessionStart) / length) * length;
    for (let slot = nextSlot; slot + length <= sessionEnd; slot += length) {
      if (!isSlotAfterClinicLastBookingCutoffUtc(atMinute(slot), clinicId, doctorId)) return false;
    }
  }
  return true;
}

export function isSlotBlockedBySameDayEveningCutoffUtc(
  slotStartUtc: Date,
  nowUtc: Date = new Date()
): boolean {
  const todayInHk = formatInTimeZone(nowUtc, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
  const slotDateInHk = formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
  if (slotDateInHk !== todayInHk) {
    return false;
  }

  const nowLabel = formatInTimeZone(nowUtc, HONG_KONG_TIMEZONE, 'HH:mm');
  const slotStartLabel = formatInTimeZone(slotStartUtc, HONG_KONG_TIMEZONE, 'HH:mm');
  const nowMinutes = toMinutes(nowLabel);
  const slotStartMinutes = toMinutes(slotStartLabel);
  if (nowMinutes === null || slotStartMinutes === null) {
    return false;
  }

  return (
    nowMinutes >= SAME_DAY_EVENING_BOOKING_CUTOFF_MINUTES &&
    slotStartMinutes >= SAME_DAY_EVENING_BOOKING_CUTOFF_MINUTES
  );
}

// Helper: Check if a date is blocked by all-day holidays
export async function isDateBlocked(date: string, doctorId?: string, clinicId?: string): Promise<boolean> {
  const holidays = await getApplicableHolidaysForDate(date, doctorId, clinicId);
  if (holidays.length === 0) return false;
  return holidays.some((holiday) => !holiday.startTime || !holiday.endTime);
}

export function isSlotBlockedByHolidaysUtc(
  slotStartUtc: Date,
  slotEndUtc: Date,
  applicableHolidays: Holiday[]
): boolean {
  if (applicableHolidays.length === 0) return false;
  const slot = getSlotMinutesInHongKong(slotStartUtc, slotEndUtc);
  if (!slot) return false;
  for (const holiday of applicableHolidays) {
    if (isSlotBlockedByHoliday(slot.start, slot.end, holiday)) {
      return true;
    }
  }

  return false;
}

// Helper: Check if a UTC time slot overlaps with any busy period
export function isSlotAvailableUtc(slotStart: Date, slotEnd: Date, busySlots: { start: Date; end: Date }[]): boolean {
  for (const busy of busySlots) {
    if (
      (slotStart >= busy.start && slotStart < busy.end) || // Slot starts during busy time
      (slotEnd > busy.start && slotEnd <= busy.end) ||     // Slot ends during busy time
      (slotStart <= busy.start && slotEnd >= busy.end)     // Slot encompasses busy time
    ) {
      return false;
    }
  }
  return true;
}
