import 'server-only';

import { createServiceClient } from '@/lib/supabase';
import {
  CLINIC_BY_ID,
  DOCTOR_BY_ID,
  type ClinicId,
  type DoctorId,
} from '@/shared/clinic-data';

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

export type HolidayNotice = {
  id: string;
  startDate: string;
  endDate: string;
  doctorId?: DoctorId;
  doctorNameZh?: string;
  clinicId?: ClinicId;
  clinicNameZh?: string;
  dateLabel: string;
  dateWithWeekdayLabel: string;
  reason: string;
  timeLabel?: string;
  bookingText: string;
};

const NOTICE_LOOKAHEAD_DAYS = 90;
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const;

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

function toHongKongDate(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00+08:00`);
}

function formatDateLabel(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    month: 'numeric',
    day: 'numeric',
  });

  const startLabel = formatter.format(toHongKongDate(startDate));
  const endLabel = formatter.format(toHongKongDate(endDate));
  return startDate === endDate ? startLabel : `${startLabel}至${endLabel}`;
}

function formatDateWithWeekday(dateIso: string): string {
  const date = toHongKongDate(dateIso);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}(${WEEKDAY_LABELS[date.getUTCDay()]})`;
}

function formatDateWithWeekdayLabel(startDate: string, endDate: string): string {
  const startLabel = formatDateWithWeekday(startDate);
  const endLabel = formatDateWithWeekday(endDate);
  return startDate === endDate ? startLabel : `${startLabel}至${endLabel}`;
}

function normalizeTimeLabel(startTime: string | null, endTime: string | null): string | undefined {
  if (!startTime || !endTime) return undefined;
  const start = startTime.slice(0, 5);
  const end = endTime.slice(0, 5);
  return `${start}-${end}`;
}

function buildBookingFallbackText(
  dateWithWeekdayLabel: string,
  clinicNameZh?: string,
  timeLabel?: string
): string {
  const scopeText = clinicNameZh ? `${clinicNameZh} ` : '';
  if (timeLabel) {
    return `${dateWithWeekdayLabel} ${scopeText}${timeLabel}休診`.trim();
  }
  return `${dateWithWeekdayLabel} ${scopeText}${clinicNameZh ? '全日休診' : '全線休息一日'}`.trim();
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
      console.warn(`[holiday-notices] Failed to load holidays: ${error.message}`);
      return [];
    }

    return Array.isArray(data) ? (data as HolidayRow[]) : [];
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`[holiday-notices] Failed to load holidays: ${detail}`);
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

function buildNotice(group: HolidayGroup): HolidayNotice | null {
  const doctor = group.doctorId ? DOCTOR_BY_ID[group.doctorId as DoctorId] : undefined;
  const clinic = group.clinicId ? CLINIC_BY_ID[group.clinicId as ClinicId] : undefined;
  const reason = group.reason?.trim() || '特別休診';
  const timeLabel = normalizeTimeLabel(group.startTime, group.endTime);
  const dateWithWeekdayLabel = formatDateWithWeekdayLabel(group.startDate, group.endDate);

  return {
    id: [
      group.doctorId ?? 'all-doctors',
      group.clinicId ?? 'all-clinics',
      group.startDate,
      group.endDate,
      group.startTime ?? 'all-day',
      reason,
    ].join(':'),
    startDate: group.startDate,
    endDate: group.endDate,
    doctorId: doctor?.id,
    doctorNameZh: doctor?.nameZh,
    clinicId: clinic?.id,
    clinicNameZh: clinic?.nameZh,
    dateLabel: formatDateLabel(group.startDate, group.endDate),
    dateWithWeekdayLabel,
    reason,
    timeLabel,
    bookingText:
      group.reason?.trim() ||
      buildBookingFallbackText(dateWithWeekdayLabel, clinic?.nameZh, timeLabel),
  };
}

export async function getUpcomingHolidayNotices(): Promise<HolidayNotice[]> {
  return collapseHolidayRows(await fetchUpcomingHolidayRows())
    .map(buildNotice)
    .filter((notice): notice is HolidayNotice => Boolean(notice))
    .sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }

      const aKey = `${a.doctorId ?? ''}|${a.clinicId ?? ''}|${a.reason}|${a.timeLabel ?? ''}`;
      const bKey = `${b.doctorId ?? ''}|${b.clinicId ?? ''}|${b.reason}|${b.timeLabel ?? ''}`;
      return aKey.localeCompare(bKey);
    });
}
