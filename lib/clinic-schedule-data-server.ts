import 'server-only';

import { getActiveScheduleMappings } from '@/lib/doctor-schedule-store';
import {
  CLINIC_BY_ID,
  DOCTORS,
  DOCTOR_BY_NAME_ZH,
  PHYSICAL_CLINIC_IDS,
  type DoctorProfile,
} from '@/shared/clinic-data';
import type { WeeklySchedule } from '@/shared/schedule-config';

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

async function getDoctorMappings(doctorId: DoctorProfile['id']) {
  const mappings = await getActiveScheduleMappings();
  return mappings.filter(
    (mapping) =>
      mapping.doctorId === doctorId
      && mapping.clinicId !== 'online'
      && hasAnySchedule(mapping.schedule)
  );
}

export async function getBookableDoctorsServer(): Promise<DoctorProfile[]> {
  const mappings = await getActiveScheduleMappings();
  const doctorIds = new Set(
    mappings
      .filter(
        (mapping) => mapping.clinicId !== 'online' && hasAnySchedule(mapping.schedule)
      )
      .map((mapping) => mapping.doctorId)
  );
  return DOCTORS.filter((doctor) => doctorIds.has(doctor.id));
}

export async function getDoctorScheduleSummaryByNameZhServer(
  nameZh: string
): Promise<string | undefined> {
  const doctor = DOCTOR_BY_NAME_ZH[nameZh];
  if (!doctor) return undefined;

  const mappings = await getDoctorMappings(doctor.id);
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

export async function getPromptDoctorInfoLinesServer(): Promise<string[]> {
  const doctors = await getBookableDoctorsServer();
  const lines = await Promise.all(
    doctors.map(async (doctor) => {
      const schedule = await getDoctorScheduleSummaryByNameZhServer(doctor.nameZh);
      if (!schedule) return null;
      return `${doctor.nameZh}：${schedule.replace(/\n/g, '，')}`;
    })
  );
  return lines.filter((value): value is string => Boolean(value));
}
