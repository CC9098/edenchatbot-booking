import { WeeklySchedule, TimeRange } from '../shared/schedule-config';
import { holidays } from '../shared/schema';
import { storage } from './storage';

// Helper: Get schedule for a specific day from weekly schedule
export function getScheduleForDayFromWeekly(schedule: WeeklySchedule | undefined | null, dayOfWeek: number): TimeRange[] | null {
  if (!schedule) return null;
  return schedule[dayOfWeek] || null;
}

// Helper: Check if a date is blocked by holidays
export async function isDateBlocked(date: string, doctorId?: string, clinicId?: string): Promise<boolean> {
  // Optimization: Fetch all holidays for this date in one query
  const holidays = await storage.getHolidaysForDate(date);

  if (holidays.length === 0) return false;

  // Filter in memory
  // 1. Global holidays (no doctor, no clinic)
  const hasGlobal = holidays.some(h => !h.doctorId && !h.clinicId);
  if (hasGlobal) return true;

  // 2. Doctor-specific holidays (match doctor, no clinic)
  if (doctorId) {
    const hasDoctor = holidays.some(h => h.doctorId === doctorId && !h.clinicId);
    if (hasDoctor) return true;
  }

  // 3. Clinic-specific holidays (no doctor, match clinic)
  if (clinicId) {
    const hasClinic = holidays.some(h => !h.doctorId && h.clinicId === clinicId);
    if (hasClinic) return true;
  }

  // 4. Doctor-at-Clinic specific holidays (match both)
  if (doctorId && clinicId) {
    const hasSpecific = holidays.some(h => h.doctorId === doctorId && h.clinicId === clinicId);
    if (hasSpecific) return true;
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
