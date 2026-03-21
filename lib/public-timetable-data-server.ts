import 'server-only';

import { createServiceClient } from '@/lib/supabase';
import { getActiveScheduleMappings } from '@/lib/doctor-schedule-store';
import {
  CLINIC_BY_ID,
  DOCTOR_BY_ID,
  PHYSICAL_CLINIC_IDS,
  type ClinicId,
  type DoctorId,
  type PhysicalClinicId,
} from '@/shared/clinic-data';

type SessionId = 'morning' | 'afternoon';

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

export type TimetableNotice = {
  id: string;
  doctorId?: DoctorId;
  doctorNameZh?: string;
  clinicId?: ClinicId;
  clinicNameZh?: string;
  dateLabel: string;
  reason: string;
  timeLabel?: string;
};

export type PublicTimetableData = {
  generatedAtLabel: string;
  cards: TimetableClinicCard[];
  notices: TimetableNotice[];
};

interface HolidayRow {
  doctor_id: string | null;
  clinic_id: string | null;
  holiday_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

interface HolidayGroup {
  clinicId: string | null;
  doctorId: string | null;
  endDate: string;
  reason: string | null;
  startDate: string;
  endTime: string | null;
  startTime: string | null;
}

const DAY_KEYS = [1, 2, 3, 4, 5, 6, 0] as const;
const NOTICE_LOOKAHEAD_DAYS = 90;

function createEmptyCells(): Record<number, TimetableDoctorEntry[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function getTodayInHongKong(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function resolveSessionId(startTime: string): SessionId {
  return minutesFromTime(startTime) < 15 * 60 ? 'morning' : 'afternoon';
}

function shortDoctorName(nameZh: string): string {
  return nameZh.replace(/醫師$/, '');
}

function formatDateLabel(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    month: 'numeric',
    day: 'numeric',
  });

  const toDate = (dateIso: string) => new Date(`${dateIso}T00:00:00+08:00`);
  const startLabel = formatter.format(toDate(startDate));
  const endLabel = formatter.format(toDate(endDate));
  return startDate === endDate ? startLabel : `${startLabel}至${endLabel}`;
}

function normalizeTimeLabel(startTime: string | null, endTime: string | null): string | undefined {
  if (!startTime || !endTime) return undefined;
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  return `${start}-${end}`;
}

function hasAnyPhysicalSchedule(schedule: Record<number, { start: string; end: string }[] | null>): boolean {
  return DAY_KEYS.some((day) => {
    const ranges = schedule[day];
    return Array.isArray(ranges) && ranges.length > 0;
  });
}

async function fetchUpcomingHolidayRows(): Promise<HolidayRow[]> {
  try {
    const supabase = createServiceClient();
    const today = getTodayInHongKong();
    const endDate = addDays(today, NOTICE_LOOKAHEAD_DAYS);
    const { data, error } = await supabase
      .from('holidays')
      .select('doctor_id, clinic_id, holiday_date, start_time, end_time, reason')
      .gte('holiday_date', today)
      .lte('holiday_date', endDate)
      .order('holiday_date', { ascending: true });

    if (error) {
      console.warn(`[public-timetable-data] Failed to load holidays: ${error.message}`);
      return [];
    }

    return Array.isArray(data) ? (data as HolidayRow[]) : [];
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[public-timetable-data] Failed to load holidays: ${detail}`);
    return [];
  }
}

function collapseHolidayRows(rows: HolidayRow[]): HolidayGroup[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.holiday_date !== b.holiday_date) {
      return a.holiday_date.localeCompare(b.holiday_date);
    }

    const aKey = `${a.doctor_id ?? ''}|${a.clinic_id ?? ''}|${a.reason ?? ''}|${a.start_time ?? ''}|${a.end_time ?? ''}`;
    const bKey = `${b.doctor_id ?? ''}|${b.clinic_id ?? ''}|${b.reason ?? ''}|${b.start_time ?? ''}|${b.end_time ?? ''}`;
    return aKey.localeCompare(bKey);
  });

  const groups: HolidayGroup[] = [];

  for (const row of sorted) {
    const previous = groups[groups.length - 1];
    const isConsecutive =
      previous &&
      previous.doctorId === row.doctor_id &&
      previous.clinicId === row.clinic_id &&
      previous.reason === row.reason &&
      previous.startTime === row.start_time &&
      previous.endTime === row.end_time &&
      addDays(previous.endDate, 1) === row.holiday_date;

    if (isConsecutive) {
      previous.endDate = row.holiday_date;
      continue;
    }

    groups.push({
      doctorId: row.doctor_id,
      clinicId: row.clinic_id,
      startDate: row.holiday_date,
      endDate: row.holiday_date,
      reason: row.reason,
      startTime: row.start_time,
      endTime: row.end_time,
    });
  }

  return groups;
}

function buildNotice(group: HolidayGroup): TimetableNotice | null {
  const doctor = group.doctorId ? DOCTOR_BY_ID[group.doctorId as DoctorId] : undefined;
  const clinic = group.clinicId ? CLINIC_BY_ID[group.clinicId as ClinicId] : undefined;
  const reason = group.reason?.trim() || '特別休診';

  return {
    id: [
      group.doctorId ?? 'all-doctors',
      group.clinicId ?? 'all-clinics',
      group.startDate,
      group.endDate,
      group.startTime ?? 'all-day',
      reason,
    ].join(':'),
    doctorId: doctor?.id,
    doctorNameZh: doctor?.nameZh,
    clinicId: clinic?.id,
    clinicNameZh: clinic?.nameZh,
    dateLabel: formatDateLabel(group.startDate, group.endDate),
    reason,
    timeLabel: normalizeTimeLabel(group.startTime, group.endTime),
  };
}

export async function getPublicTimetableData(): Promise<PublicTimetableData> {
  const mappings = await getActiveScheduleMappings();
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
          bookingUrl: doctor.bookingUrl,
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

  const notices = collapseHolidayRows(await fetchUpcomingHolidayRows())
    .map(buildNotice)
    .filter((notice): notice is TimetableNotice => Boolean(notice))
    .sort((a, b) => a.dateLabel.localeCompare(b.dateLabel))
    .slice(0, 10);

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
