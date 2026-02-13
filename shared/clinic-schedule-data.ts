import {
  CLINIC_BY_ID,
  DOCTORS,
  DOCTOR_BY_NAME_ZH,
  PHYSICAL_CLINIC_IDS,
  type DoctorProfile,
  type PhysicalClinicId,
} from '@/shared/clinic-data';
import { CALENDAR_MAPPINGS, type WeeklySchedule } from '@/shared/schedule-config';

const DAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function hasAnySchedule(schedule: WeeklySchedule): boolean {
  return Object.values(schedule).some((ranges) => ranges !== null && ranges.length > 0);
}

function formatRanges(ranges: { start: string; end: string }[]): string {
  return ranges.map((range) => `${range.start}-${range.end}`).join(', ');
}

function formatWeeklySchedule(schedule: WeeklySchedule): string {
  const sections: string[] = [];
  for (let day = 0; day <= 6; day += 1) {
    const ranges = schedule[day];
    if (!ranges || ranges.length === 0) continue;
    sections.push(`${DAY_LABELS_ZH[day]} ${formatRanges(ranges)}`);
  }
  return sections.join(' | ');
}

function getDoctorMappings(doctorId: DoctorProfile['id']) {
  return CALENDAR_MAPPINGS.filter(
    (mapping) =>
      mapping.doctorId === doctorId
      && mapping.isActive
      && PHYSICAL_CLINIC_IDS.includes(mapping.clinicId as PhysicalClinicId)
      && hasAnySchedule(mapping.schedule)
  );
}

export function getBookableDoctors(): DoctorProfile[] {
  return DOCTORS.filter((doctor) => getDoctorMappings(doctor.id).length > 0);
}

export function getBookableDoctorNameZhList(): string[] {
  return getBookableDoctors().map((doctor) => doctor.nameZh);
}

export function getDoctorScheduleSummaryByNameZh(nameZh: string): string | undefined {
  const doctor = DOCTOR_BY_NAME_ZH[nameZh];
  if (!doctor) return undefined;

  const mappings = getDoctorMappings(doctor.id);
  if (mappings.length === 0) return undefined;

  const sections = PHYSICAL_CLINIC_IDS
    .map((clinicId) => {
      const mapping = mappings.find((item) => item.clinicId === clinicId);
      if (!mapping) return null;
      const clinicName = CLINIC_BY_ID[clinicId]?.nameZh || clinicId;
      return `${clinicName}：${formatWeeklySchedule(mapping.schedule)}`;
    })
    .filter((value): value is string => Boolean(value));

  return sections.join('\n');
}

export function getPromptDoctorInfoLines(): string[] {
  return getBookableDoctors()
    .map((doctor) => {
      const schedule = getDoctorScheduleSummaryByNameZh(doctor.nameZh);
      if (!schedule) return null;
      return `${doctor.nameZh}：${schedule.replace(/\n/g, '，')}`;
    })
    .filter((value): value is string => Boolean(value));
}
