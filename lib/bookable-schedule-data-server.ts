import 'server-only';

import { getActiveScheduleMappings, getScheduleVersions } from '@/lib/doctor-schedule-store';
import { getUpcomingHolidayNotices } from '@/lib/holiday-notices';
import { getTodayIsoInHongKong } from '@/lib/timetable-admin-utils';
import {
  CLINIC_BY_ID,
  DOCTORS,
  PHYSICAL_CLINIC_IDS,
  getDoctorBookingGroupLabel,
  getDoctorBookingPractitionerGroup,
  getDoctorBookingRoleLabel,
  getDoctorBookingSupportNote,
  getDoctorBookingSlotMinutes,
  getDoctorBookingTreatmentLabel,
  getDoctorBookingTreatmentOptions,
  getDoctorBookingVisitOptions,
} from '@/shared/clinic-data';
import type {
  BookableClinicSchedule,
  BookableDoctorSchedule,
} from '@/shared/bookable-schedule-data';
import type { TimeRange, WeeklySchedule } from '@/shared/schedule-config';
import { buildVirtualOnlineScheduleFromMappings } from '@/lib/virtual-online-booking';

const DAY_LABELS_ZH = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const UPCOMING_SCHEDULE_PREVIEW_DAYS = 14;

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

function findNextScheduleChangeDate(
  mappings: Awaited<ReturnType<typeof getScheduleVersions>>,
  doctorId: string,
  clinicId: string,
  today: string
): string | undefined {
  return mappings
    .filter((mapping) => mapping.doctorId === doctorId && mapping.clinicId === clinicId)
    .map((mapping) => mapping.effectiveFrom)
    .filter((value): value is string => typeof value === 'string' && value > today)
    .sort((left, right) => left.localeCompare(right))[0];
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mappingKey(mapping: { doctorId: string; clinicId: string }): string {
  return `${mapping.doctorId}:${mapping.clinicId}`;
}

function buildBookableDoctorSchedule(
  doctor: (typeof DOCTORS)[number],
  clinics: BookableClinicSchedule[] = []
): BookableDoctorSchedule {
  return {
    doctorId: doctor.id,
    doctorNameZh: doctor.nameZh,
    doctorNameEn: doctor.nameEn,
    avatarSrc: doctor.avatarSrc,
    avatarObjectPosition: doctor.avatarObjectPosition,
    bookingPractitionerGroup: getDoctorBookingPractitionerGroup(doctor.id),
    bookingGroupLabel: getDoctorBookingGroupLabel(doctor.id),
    bookingRoleLabel: getDoctorBookingRoleLabel(doctor.id),
    bookingSupportNote: getDoctorBookingSupportNote(doctor.id),
    scheduleNote: doctor.scheduleNote,
    bookingTreatmentLabel: getDoctorBookingTreatmentLabel(doctor.id),
    bookingTreatmentOptions: getDoctorBookingTreatmentOptions(doctor.id),
    bookingSlotMinutes: getDoctorBookingSlotMinutes(doctor.id),
    bookingVisitOptions: [...getDoctorBookingVisitOptions(doctor.id)],
    summary: '',
    clinics,
  };
}

function findUpcomingPreviewDate(
  mappings: Awaited<ReturnType<typeof getScheduleVersions>>,
  today: string
): string | undefined {
  const previewLimit = addDaysIso(today, UPCOMING_SCHEDULE_PREVIEW_DAYS);
  return Array.from(
    new Set(
      mappings
        .map((mapping) => mapping.effectiveFrom)
        .filter((value): value is string => Boolean(value && value > today && value <= previewLimit))
    )
  ).sort((left, right) => left.localeCompare(right))[0];
}

function mergeMappingsForUpcomingPreview(
  currentMappings: Awaited<ReturnType<typeof getActiveScheduleMappings>>,
  previewMappings: Awaited<ReturnType<typeof getActiveScheduleMappings>>,
  allScheduleVersions: Awaited<ReturnType<typeof getScheduleVersions>>,
  previewDate: string
) {
  const keysChangedOnPreviewDate = new Set(
    allScheduleVersions
      .filter((mapping) => mapping.effectiveFrom === previewDate)
      .map(mappingKey)
  );

  return [
    ...currentMappings.filter((mapping) => !keysChangedOnPreviewDate.has(mappingKey(mapping))),
    ...previewMappings,
  ];
}

export async function getPublicBookableScheduleData(): Promise<BookableDoctorSchedule[]> {
  const today = getTodayIsoInHongKong();
  const [currentMappings, allScheduleVersions, holidayNotices] = await Promise.all([
    getActiveScheduleMappings(),
    getScheduleVersions(),
    getUpcomingHolidayNotices(),
  ]);
  const previewDate = findUpcomingPreviewDate(allScheduleVersions, today);
  const mappings = previewDate
    ? mergeMappingsForUpcomingPreview(
        currentMappings,
        await getActiveScheduleMappings(previewDate),
        allScheduleVersions,
        previewDate
      )
    : currentMappings;
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
      nextEffectiveFrom: findNextScheduleChangeDate(
        allScheduleVersions,
        mapping.doctorId,
        mapping.clinicId,
        today
      ),
    };

    const existing = doctorMap.get(doctor.id);
    if (!existing) {
      doctorMap.set(doctor.id, buildBookableDoctorSchedule(doctor, [clinicSchedule]));
      continue;
    }

    existing.clinics.push(clinicSchedule);
  }

  return DOCTORS
    .map((doctorProfile): BookableDoctorSchedule | null => {
      const onlineSchedule =
        doctorProfile.onlineBookingEnabled === false
          ? null
          : buildVirtualOnlineScheduleFromMappings(mappings, doctorProfile.id, {
              allScheduleVersions,
              targetDate: previewDate ?? today,
            });
      const existingDoctor = doctorMap.get(doctorProfile.id);

      if (!existingDoctor && (!onlineSchedule || !hasAnySchedule(onlineSchedule))) {
        return null;
      }

      const doctor = existingDoctor ?? buildBookableDoctorSchedule(doctorProfile);
      const clinics: BookableClinicSchedule[] = PHYSICAL_CLINIC_IDS
        .map((clinicId) => doctor.clinics.find((clinic) => clinic.clinicId === clinicId))
        .filter((clinic): clinic is BookableClinicSchedule => Boolean(clinic));

      if (onlineSchedule && hasAnySchedule(onlineSchedule)) {
        const onlineClinic = CLINIC_BY_ID.online;
        clinics.push({
          clinicId: 'online',
          clinicNameZh: onlineClinic.nameZh,
          clinicNameEn: onlineClinic.nameEn,
          schedule: cloneWeeklySchedule(onlineSchedule),
          summary: formatWeeklySchedule(onlineSchedule),
        });
      }

      return {
        ...doctor,
        bookingNotices: holidayNotices
          .filter((notice) => {
            if (notice.doctorId && notice.doctorId !== doctor.doctorId) {
              return false;
            }

            if (!notice.clinicId) {
              return true;
            }

            return clinics.some((clinic) => clinic.clinicId === notice.clinicId);
          })
          .map((notice) => ({
            id: notice.id,
            text: notice.bookingText,
            clinicId: notice.clinicId,
            clinicNameZh: notice.clinicNameZh,
          })),
        clinics,
        summary: clinics
          .map((clinic) => `${clinic.clinicNameZh}：${clinic.summary}`)
          .join('\n'),
      };
    })
    .filter((doctor): doctor is BookableDoctorSchedule => Boolean(doctor));
}
