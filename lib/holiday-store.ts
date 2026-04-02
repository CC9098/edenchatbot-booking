import { createServiceClient } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import type { Holiday } from '@/shared/schema';

interface SupabaseHolidayRow {
  id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  holiday_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

function normalizeSupabaseHoliday(row: SupabaseHolidayRow): Holiday {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    clinicId: row.clinic_id,
    holidayDate: row.holiday_date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
  };
}

function buildHolidayDedupKey(holiday: Holiday): string {
  return [
    holiday.doctorId ?? '',
    holiday.clinicId ?? '',
    holiday.holidayDate,
    holiday.startTime ?? '',
    holiday.endTime ?? '',
    holiday.reason ?? '',
  ].join('|');
}

export function mergeHolidayRows(...sources: Holiday[][]): Holiday[] {
  const deduped = new Map<string, Holiday>();

  for (const source of sources) {
    for (const holiday of source) {
      const key = buildHolidayDedupKey(holiday);
      if (!deduped.has(key)) {
        deduped.set(key, holiday);
      }
    }
  }

  return Array.from(deduped.values());
}

async function getSupabaseHolidaysForDate(date: string): Promise<Holiday[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('holidays')
    .select('id, doctor_id, clinic_id, holiday_date, start_time, end_time, reason')
    .eq('holiday_date', date);

  if (error) {
    throw new Error(`[holiday-store] Supabase holidays query failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as SupabaseHolidayRow[]) : [];
  return rows.map(normalizeSupabaseHoliday);
}

async function getLegacyHolidaysForDate(date: string): Promise<Holiday[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  return storage.getHolidaysForDate(date);
}

export async function getHolidaysForDate(date: string): Promise<Holiday[]> {
  const results = await Promise.allSettled([
    getSupabaseHolidaysForDate(date),
    getLegacyHolidaysForDate(date),
  ]);

  const holidays: Holiday[][] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      holidays.push(result.value);
      continue;
    }

    errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

  if (holidays.some((rows) => rows.length > 0)) {
    return mergeHolidayRows(...holidays);
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }

  return [];
}
