import type { DoctorId, PhysicalClinicId } from '@/shared/clinic-data';
import type { WeeklySchedule } from '@/shared/schedule-config';

export type BookableClinicSchedule = {
  clinicId: PhysicalClinicId;
  clinicNameZh: string;
  clinicNameEn: string;
  schedule: WeeklySchedule;
  summary: string;
};

export type BookableDoctorSchedule = {
  doctorId: DoctorId;
  doctorNameZh: string;
  doctorNameEn: string;
  scheduleNote?: string;
  summary: string;
  clinics: BookableClinicSchedule[];
};

export function getScheduleForDayFromPublicSchedule(
  schedule: WeeklySchedule,
  dayOfWeek: number
) {
  return schedule[dayOfWeek] ?? null;
}
