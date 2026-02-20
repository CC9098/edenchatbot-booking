import { formatInTimeZone } from 'date-fns-tz';
import { WeeklySchedule, TimeRange } from '../shared/schedule-config';
import { type Holiday } from '../shared/schema';
import { storage } from './storage';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

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
  const holidays = await storage.getHolidaysForDate(date);
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
