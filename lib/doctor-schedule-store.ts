import 'server-only';

import { createServiceClient } from '@/lib/supabase';
import { isClinicId, isDoctorId, type ClinicId, type DoctorId } from '@/shared/clinic-data';
import {
  CALENDAR_MAPPINGS,
  type CalendarMapping,
  type TimeRange,
  type WeeklySchedule,
} from '@/shared/schedule-config';

interface DoctorScheduleRow {
  doctor_id: string;
  clinic_id: string;
  calendar_id: string;
  is_active: boolean | null;
  schedule: unknown;
}

interface MappingCache {
  expiresAt: number;
  mappings: CalendarMapping[];
}

const DEFAULT_CACHE_TTL_SECONDS = 120;
const MIN_CACHE_TTL_SECONDS = 5;
const MAX_CACHE_TTL_SECONDS = 1800;
const TIME_TEXT_REGEX = /^\d{2}:\d{2}$/;

let cache: MappingCache | null = null;
let inFlightLoad: Promise<CalendarMapping[]> | null = null;

function getCacheTtlMs(): number {
  const raw = Number(process.env.DOCTOR_SCHEDULE_CACHE_TTL_SECONDS ?? DEFAULT_CACHE_TTL_SECONDS);
  if (!Number.isFinite(raw)) return DEFAULT_CACHE_TTL_SECONDS * 1000;
  const normalized = Math.max(MIN_CACHE_TTL_SECONDS, Math.min(MAX_CACHE_TTL_SECONDS, Math.floor(raw)));
  return normalized * 1000;
}

function isValidTimeRange(raw: unknown): raw is TimeRange {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  return (
    typeof row.start === 'string' &&
    typeof row.end === 'string' &&
    TIME_TEXT_REGEX.test(row.start) &&
    TIME_TEXT_REGEX.test(row.end)
  );
}

function parseWeeklySchedule(raw: unknown): WeeklySchedule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const parsed: WeeklySchedule = {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };

  for (let day = 0; day <= 6; day += 1) {
    const dayRaw = row[String(day)];
    if (dayRaw === null || dayRaw === undefined) {
      parsed[day] = null;
      continue;
    }

    if (!Array.isArray(dayRaw)) {
      return null;
    }

    const ranges: TimeRange[] = [];
    for (const range of dayRaw) {
      if (!isValidTimeRange(range)) {
        return null;
      }
      ranges.push({ start: range.start, end: range.end });
    }

    parsed[day] = ranges.length > 0 ? ranges : null;
  }

  return parsed;
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

function cloneCalendarMapping(mapping: CalendarMapping): CalendarMapping {
  return {
    ...mapping,
    schedule: cloneWeeklySchedule(mapping.schedule),
  };
}

function normalizeRow(row: DoctorScheduleRow): CalendarMapping | null {
  const doctorId = row.doctor_id?.trim();
  const clinicId = row.clinic_id?.trim();
  const calendarId = row.calendar_id?.trim();

  if (!doctorId || !clinicId || !calendarId) {
    return null;
  }
  if (!isDoctorId(doctorId) || !isClinicId(clinicId)) {
    return null;
  }

  const schedule = parseWeeklySchedule(row.schedule);
  if (!schedule) {
    return null;
  }

  return {
    doctorId,
    clinicId,
    calendarId,
    isActive: row.is_active !== false,
    schedule,
  };
}

function getStaticFallbackMappings(): CalendarMapping[] {
  return CALENDAR_MAPPINGS.filter((mapping) => mapping.isActive).map(cloneCalendarMapping);
}

function normalizeRows(rows: DoctorScheduleRow[]): CalendarMapping[] {
  const deduped = new Map<string, CalendarMapping>();

  for (const row of rows) {
    const mapping = normalizeRow(row);
    if (!mapping) continue;
    const key = `${mapping.doctorId}:${mapping.clinicId}`;
    if (!deduped.has(key)) {
      deduped.set(key, mapping);
    }
  }

  return Array.from(deduped.values());
}

async function fetchMappingsFromSupabase(): Promise<CalendarMapping[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('doctor_id, clinic_id, calendar_id, is_active, schedule')
    .eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? (data as DoctorScheduleRow[]) : [];
  return normalizeRows(rows);
}

async function loadMappingsWithFallback(): Promise<CalendarMapping[]> {
  try {
    const supabaseMappings = await fetchMappingsFromSupabase();
    if (supabaseMappings.length > 0) {
      return supabaseMappings;
    }

    console.warn(
      '[doctor-schedule-store] No active doctor_schedules in Supabase; using static schedule-config fallback.'
    );
    return getStaticFallbackMappings();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(
      `[doctor-schedule-store] Failed to load doctor_schedules from Supabase; using static fallback. reason=${detail}`
    );
    return getStaticFallbackMappings();
  }
}

async function getCachedMappings(): Promise<CalendarMapping[]> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.mappings;
  }

  if (!inFlightLoad) {
    inFlightLoad = loadMappingsWithFallback()
      .then((mappings) => {
        cache = {
          expiresAt: Date.now() + getCacheTtlMs(),
          mappings,
        };
        return mappings;
      })
      .finally(() => {
        inFlightLoad = null;
      });
  }

  return inFlightLoad;
}

export function clearDoctorScheduleCache(): void {
  cache = null;
  inFlightLoad = null;
}

export async function getActiveScheduleMappings(): Promise<CalendarMapping[]> {
  const mappings = await getCachedMappings();
  return mappings.map(cloneCalendarMapping);
}

export async function getScheduleMapping(
  doctorId: DoctorId,
  clinicId: ClinicId
): Promise<CalendarMapping | undefined> {
  const mappings = await getCachedMappings();
  const mapping = mappings.find((entry) => entry.doctorId === doctorId && entry.clinicId === clinicId);
  return mapping ? cloneCalendarMapping(mapping) : undefined;
}

export async function getScheduleMappingByRawIds(
  doctorId: string,
  clinicId: string
): Promise<CalendarMapping | undefined> {
  if (!isDoctorId(doctorId) || !isClinicId(clinicId)) {
    return undefined;
  }
  return getScheduleMapping(doctorId, clinicId);
}

export async function getActiveCalendarIds(): Promise<string[]> {
  const mappings = await getCachedMappings();
  return Array.from(
    new Set(
      mappings
        .map((mapping) => mapping.calendarId.trim())
        .filter((calendarId) => calendarId.length > 0)
    )
  );
}
