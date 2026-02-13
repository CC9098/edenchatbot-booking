
import { storage } from '@/lib/storage';
import { CALENDAR_MAPPINGS, CalendarMapping } from '@/shared/schedule-config';
import { isClinicId, isDoctorId } from '@/shared/clinic-data';

// Helper: Try to get schedule from database, fallback to static config
export async function getMappingWithFallback(doctorId: string, clinicId: string): Promise<CalendarMapping | undefined> {
                // 1. Try DB
                try {
                                const dbSchedule = await storage.getDoctorSchedule(doctorId, clinicId);

                                if (dbSchedule && dbSchedule.isActive) {
                                                if (!isDoctorId(dbSchedule.doctorId) || !isClinicId(dbSchedule.clinicId)) {
                                                                return undefined;
                                                }
                                                return {
                                                                doctorId: dbSchedule.doctorId,
                                                                clinicId: dbSchedule.clinicId,
                                                                calendarId: dbSchedule.calendarId,
                                                                isActive: dbSchedule.isActive ?? true,
                                                                schedule: dbSchedule.schedule as any // Cast because Drizzle JSON type is unknown
                                                };
                                }
                } catch (err) {
                                console.error(`Failed to fetch schedule from DB for ${doctorId}-${clinicId}:`, err);
                }

                // 2. Fallback to static config
                if (!isDoctorId(doctorId) || !isClinicId(clinicId)) {
                                return undefined;
                }
                return CALENDAR_MAPPINGS.find(m => m.doctorId === doctorId && m.clinicId === clinicId);
}
