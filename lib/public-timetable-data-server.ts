import 'server-only';

import { buildBookingUrl } from '@/lib/public-url';
import { getActiveScheduleMappings } from '@/lib/doctor-schedule-store';
import { getTodayIsoInHongKong } from '@/lib/timetable-admin-utils';
import {
  getUpcomingHolidayNotices,
  type HolidayNotice as TimetableNotice,
} from '@/lib/holiday-notices';
import {
  CLINIC_BY_ID,
  DOCTOR_BY_ID,
  PHYSICAL_CLINIC_IDS,
  type DoctorId,
  type PhysicalClinicId,
} from '@/shared/clinic-data';

type SessionId = 'morning' | 'afternoon';
const AFTERNOON_SESSION_START_MINUTES = 14 * 60 + 30;

type TimetableDoctorEntry = {
  doctorId: DoctorId;
  doctorNameZh: string;
  shortNameZh: string;
  timeLabel: string;
  bookingUrl?: string;
};

type TimetableSessionRow = {
  id: SessionId;
  label: string;
  cells: Record<number, TimetableDoctorEntry[]>;
};

export type TimetableClinicCard = {
  clinicId: PhysicalClinicId;
  clinicNameZh: string;
  clinicNameEn: string;
  address: string;
  phones: string[];
  hoursText: string;
  rows: TimetableSessionRow[];
};

export type PublicTimetableData = {
  generatedAtLabel: string;
  cards: TimetableClinicCard[];
  notices: TimetableNotice[];
};

const DAY_KEYS = [1, 2, 3, 4, 5, 6, 0] as const;

function createEmptyCells(): Record<number, TimetableDoctorEntry[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function resolveSessionId(startTime: string): SessionId {
  return minutesFromTime(startTime) < AFTERNOON_SESSION_START_MINUTES ? 'morning' : 'afternoon';
}

function shortDoctorName(nameZh: string): string {
  return nameZh.replace(/醫師$/, '');
}

function hasAnyPhysicalSchedule(schedule: Record<number, { start: string; end: string }[] | null>): boolean {
  return DAY_KEYS.some((day) => {
    const ranges = schedule[day];
    return Array.isArray(ranges) && ranges.length > 0;
  });
}

export async function getPublicTimetableData(targetDate?: string): Promise<PublicTimetableData> {
  const effectiveDate =
    typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())
      ? targetDate.trim()
      : getTodayIsoInHongKong();

  const mappings = await getActiveScheduleMappings(effectiveDate);
  const rowsByClinic = Object.fromEntries(
    PHYSICAL_CLINIC_IDS.map((clinicId) => [
      clinicId,
      {
        morning: createEmptyCells(),
        afternoon: createEmptyCells(),
      },
    ])
  ) as Record<PhysicalClinicId, Record<SessionId, Record<number, TimetableDoctorEntry[]>>>;

  for (const mapping of mappings) {
    if (mapping.clinicId === 'online' || !hasAnyPhysicalSchedule(mapping.schedule)) {
      continue;
    }

    const clinicId = mapping.clinicId as PhysicalClinicId;
    const doctor = DOCTOR_BY_ID[mapping.doctorId];
    if (!doctor) continue;

    for (const day of DAY_KEYS) {
      const ranges = mapping.schedule[day];
      if (!ranges || ranges.length === 0) continue;

      for (const range of ranges) {
        const sessionId = resolveSessionId(range.start);
        rowsByClinic[clinicId][sessionId][day].push({
          doctorId: doctor.id,
          doctorNameZh: doctor.nameZh,
          shortNameZh: shortDoctorName(doctor.nameZh),
          timeLabel: `${range.start}-${range.end}`,
          bookingUrl: buildBookingUrl({ doctorId: doctor.id, clinicId }),
        });
      }
    }
  }

  const cards: TimetableClinicCard[] = PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];
    const morningCells = rowsByClinic[clinicId].morning;
    const afternoonCells = rowsByClinic[clinicId].afternoon;

    for (const day of DAY_KEYS) {
      morningCells[day].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel) || a.doctorNameZh.localeCompare(b.doctorNameZh));
      afternoonCells[day].sort((a, b) => a.timeLabel.localeCompare(b.timeLabel) || a.doctorNameZh.localeCompare(b.doctorNameZh));
    }

    return {
      clinicId,
      clinicNameZh: clinic.nameZh,
      clinicNameEn: clinic.nameEn,
      address: clinic.address,
      phones: clinic.phones,
      hoursText: clinic.hoursText,
      rows: [
        { id: 'morning', label: '上午', cells: morningCells },
        { id: 'afternoon', label: '下午', cells: afternoonCells },
      ],
    };
  });

  const notices = (await getUpcomingHolidayNotices()).slice(0, 10);

  const generatedAtLabel = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());

  return {
    generatedAtLabel,
    cards,
    notices,
  };
}
