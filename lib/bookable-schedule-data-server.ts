import 'server-only';

import { getActiveScheduleMappings } from '@/lib/doctor-schedule-store';
import {
  CLINIC_BY_ID,
  DOCTORS,
  PHYSICAL_CLINIC_IDS,
} from '@/shared/clinic-data';
import type {
  BookableClinicSchedule,
  BookableDoctorSchedule,
} from '@/shared/bookable-schedule-data';
import type { TimeRange, WeeklySchedule } from '@/shared/schedule-config';

const DAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function hasAnySchedule(schedule: WeeklySchedule): boolean {
  return Object.values(schedule).some((ranges) => ranges !== null && ranges.length > 0);
}

function cloneWeeklySchedule(schedule: WeeklySchedule): WeeklySchedule {
  const cloned: WeeklySchedule = {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };

  for (let day = 0; day <= 6; day += 1) {
    const ranges = schedule[day];
    cloned[day] = ranges ? ranges.map((range) => ({ ...range })) : null;
  }

  return cloned;
}

function formatRanges(ranges: TimeRange[]): string {
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

export async function getPublicBookableScheduleData(): Promise<BookableDoctorSchedule[]> {
  const mappings = await getActiveScheduleMappings();
  const doctorMap = new Map<string, BookableDoctorSchedule>();

  for (const mapping of mappings) {
    if (mapping.clinicId === 'online' || !hasAnySchedule(mapping.schedule)) {
      continue;
    }

    const doctor = DOCTORS.find((candidate) => candidate.id === mapping.doctorId);
    const clinic = CLINIC_BY_ID[mapping.clinicId];
    if (!doctor || !clinic) continue;

    const clinicSchedule: BookableClinicSchedule = {
      clinicId: mapping.clinicId,
      clinicNameZh: clinic.nameZh,
      clinicNameEn: clinic.nameEn,
      schedule: cloneWeeklySchedule(mapping.schedule),
      summary: formatWeeklySchedule(mapping.schedule),
    };

    const existing = doctorMap.get(doctor.id);
    if (!existing) {
      doctorMap.set(doctor.id, {
        doctorId: doctor.id,
        doctorNameZh: doctor.nameZh,
        doctorNameEn: doctor.nameEn,
        summary: '',
        clinics: [clinicSchedule],
      });
      continue;
    }

    existing.clinics.push(clinicSchedule);
  }

  return DOCTORS
    .map((doctor) => doctorMap.get(doctor.id))
    .filter((doctor): doctor is BookableDoctorSchedule => Boolean(doctor))
    .map((doctor) => {
      const clinics = PHYSICAL_CLINIC_IDS
        .map((clinicId) => doctor.clinics.find((clinic) => clinic.clinicId === clinicId))
        .filter((clinic): clinic is BookableClinicSchedule => Boolean(clinic));

      return {
        ...doctor,
        clinics,
        summary: clinics
          .map((clinic) => `${clinic.clinicNameZh}：${clinic.summary}`)
          .join('\n'),
      };
    });
}
