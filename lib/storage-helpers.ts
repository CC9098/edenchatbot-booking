import { getScheduleMappingByRawIds } from '@/lib/doctor-schedule-store';
import type { CalendarMapping } from '@/shared/schedule-config';

// Backward-compatible helper for booking APIs
export async function getMappingWithFallback(
  doctorId: string,
  clinicId: string
): Promise<CalendarMapping | undefined> {
  return getScheduleMappingByRawIds(doctorId, clinicId);
}
