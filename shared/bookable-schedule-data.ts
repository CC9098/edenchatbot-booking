import type { ClinicId, DoctorId } from '@/shared/clinic-data';
import type { WeeklySchedule } from '@/shared/schedule-config';

export type BookableClinicSchedule = {
  clinicId: ClinicId;
  clinicNameZh: string;
  clinicNameEn: string;
  schedule: WeeklySchedule;
  summary: string;
};

export type BookableDoctorSchedule = {
  doctorId: DoctorId;
  doctorNameZh: string;
  doctorNameEn: string;
  avatarSrc?: string;
  avatarObjectPosition?: string;
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
