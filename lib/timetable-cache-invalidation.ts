import 'server-only';

import { revalidatePath } from 'next/cache';

import { clearDoctorScheduleCache } from '@/lib/doctor-schedule-store';

const TIMETABLE_CONSUMER_PATHS = [
  '/booking',
  '/booking-whatsapp',
  '/embed/booking',
  '/embed/booking-whatsapp',
  '/embed/timetable',
  '/doctor/booking',
  '/doctor/operations',
  '/doctor/timetable',
] as const;

export function invalidateTimetableConsumers(): void {
  clearDoctorScheduleCache();

  for (const path of TIMETABLE_CONSUMER_PATHS) {
    revalidatePath(path);
  }
}
