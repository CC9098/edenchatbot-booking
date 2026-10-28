import { getScheduleMappingByRawIds } from '@/lib/doctor-schedule-store';
import type { CalendarMapping } from '@/shared/schedule-config';
import { isDoctorAcceptingBookings } from '@/shared/clinic-data';

// Backward-compatible helper for booking APIs
export async function getMappingWithFallback(
  doctorId: string,
  clinicId: string,
  targetDate?: string
): Promise<CalendarMapping | undefined> {
  if (!isDoctorAcceptingBookings(doctorId)) return undefined;
  return getScheduleMappingByRawIds(doctorId, clinicId, targetDate);
}
