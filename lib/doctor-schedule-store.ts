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
  effective_from: string | null;
  schedule: unknown;
}

interface VersionedCalendarMapping extends CalendarMapping {
  effectiveFrom: string;
}

interface MappingCache {
  expiresAt: number;
  mappings: VersionedCalendarMapping[];
}

type DoctorScheduleLoadSource = 'supabase' | 'supabase-with-static-new-doctors' | 'static-fallback-empty' | 'static-fallback-error';

interface DoctorScheduleLoadInfo {
  detail: string | null;
  loadedAt: number;
  mappingCount: number;
  source: DoctorScheduleLoadSource;
}

const DEFAULT_CACHE_TTL_SECONDS = 120;
const MIN_CACHE_TTL_SECONDS = 5;
const MAX_CACHE_TTL_SECONDS = 1800;
const TIME_TEXT_REGEX = /^\d{2}:\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

let cache: MappingCache | null = null;
let inFlightLoad: Promise<VersionedCalendarMapping[]> | null = null;
let lastLoadInfo: DoctorScheduleLoadInfo = {
  detail: null,
  loadedAt: 0,
  mappingCount: 0,
  source: 'static-fallback-error',
};

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

function cloneCalendarMapping(mapping: VersionedCalendarMapping): VersionedCalendarMapping {
  return {
    ...mapping,
    schedule: cloneWeeklySchedule(mapping.schedule),
  };
}

function getTodayIsoInHongKong(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeEffectiveFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const value = raw.trim();
  return ISO_DATE_REGEX.test(value) ? value : null;
}

function isMissingEffectiveFromColumnError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

  const normalized = message.toLowerCase();
  return normalized.includes('effective_from') && (
    normalized.includes('column') || normalized.includes('schema cache')
  );
}

function normalizeRequestedDate(targetDate?: string): string {
  if (typeof targetDate === 'string' && ISO_DATE_REGEX.test(targetDate.trim())) {
    return targetDate.trim();
  }

  return getTodayIsoInHongKong();
}

function resolveMappingsForDate(
  mappings: VersionedCalendarMapping[],
  targetDate: string
): VersionedCalendarMapping[] {
  const resolved = new Map<string, VersionedCalendarMapping>();

  for (const mapping of mappings) {
    if (mapping.effectiveFrom > targetDate) {
      continue;
    }

    const key = `${mapping.doctorId}:${mapping.clinicId}`;
    const current = resolved.get(key);
    if (!current || mapping.effectiveFrom > current.effectiveFrom) {
      resolved.set(key, mapping);
    }
  }

  return Array.from(resolved.values()).map(cloneCalendarMapping);
}

function normalizeRow(row: DoctorScheduleRow): VersionedCalendarMapping | null {
  const doctorId = row.doctor_id?.trim();
  const clinicId = row.clinic_id?.trim();
  const calendarId = row.calendar_id?.trim();
  const effectiveFrom = normalizeEffectiveFrom(row.effective_from) ?? getTodayIsoInHongKong();

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
    effectiveFrom,
    schedule,
  };
}

function getStaticFallbackMappings(): VersionedCalendarMapping[] {
  return CALENDAR_MAPPINGS.map((mapping) =>
    cloneCalendarMapping({
      ...mapping,
      effectiveFrom: mapping.effectiveFrom ?? '1970-01-01',
    })
  );
}

function mergeStaticMappingsForNewDoctors(
  supabaseMappings: VersionedCalendarMapping[]
): VersionedCalendarMapping[] {
  const supabaseDoctorIds = new Set(supabaseMappings.map((mapping) => mapping.doctorId));
  const staticNewDoctorMappings = getStaticFallbackMappings().filter(
    (mapping) => !supabaseDoctorIds.has(mapping.doctorId)
  );

  return [...supabaseMappings, ...staticNewDoctorMappings];
}

function normalizeRows(rows: DoctorScheduleRow[]): VersionedCalendarMapping[] {
  const normalized = rows
    .map(normalizeRow)
    .filter((mapping): mapping is VersionedCalendarMapping => Boolean(mapping));

  return normalized.sort((left, right) => {
    if (left.doctorId !== right.doctorId) {
      return left.doctorId.localeCompare(right.doctorId);
    }
    if (left.clinicId !== right.clinicId) {
      return left.clinicId.localeCompare(right.clinicId);
    }
    return left.effectiveFrom.localeCompare(right.effectiveFrom);
  });
}

async function fetchMappingsFromSupabase(): Promise<VersionedCalendarMapping[]> {
  const supabase = createServiceClient();
  let { data, error } = await supabase
    .from('doctor_schedules')
    .select('doctor_id, clinic_id, calendar_id, is_active, effective_from, schedule');

  if (error && isMissingEffectiveFromColumnError(error)) {
    const fallbackResult = await supabase
      .from('doctor_schedules')
      .select('doctor_id, clinic_id, calendar_id, is_active, schedule');

    data = Array.isArray(fallbackResult.data)
      ? fallbackResult.data.map((row) => ({ ...row, effective_from: getTodayIsoInHongKong() }))
      : null;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? (data as DoctorScheduleRow[]) : [];
  return normalizeRows(rows);
}

async function loadMappingsWithFallback(): Promise<VersionedCalendarMapping[]> {
  try {
    const supabaseMappings = await fetchMappingsFromSupabase();
    if (supabaseMappings.length > 0) {
      const mappings = mergeStaticMappingsForNewDoctors(supabaseMappings);
      lastLoadInfo = {
        detail: mappings.length === supabaseMappings.length ? null : 'Merged static schedules for doctors missing in Supabase',
        loadedAt: Date.now(),
        mappingCount: mappings.length,
        source: mappings.length === supabaseMappings.length ? 'supabase' : 'supabase-with-static-new-doctors',
      };
      return mappings;
    }

    console.warn(
      '[doctor-schedule-store] No doctor_schedules in Supabase; using static schedule-config fallback.'
    );
    const fallbackMappings = getStaticFallbackMappings();
    lastLoadInfo = {
      detail: 'No doctor_schedules rows in Supabase',
      loadedAt: Date.now(),
      mappingCount: fallbackMappings.length,
      source: 'static-fallback-empty',
    };
    return fallbackMappings;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(
      `[doctor-schedule-store] Failed to load doctor_schedules from Supabase; using static fallback. reason=${detail}`
    );
    const fallbackMappings = getStaticFallbackMappings();
    lastLoadInfo = {
      detail,
      loadedAt: Date.now(),
      mappingCount: fallbackMappings.length,
      source: 'static-fallback-error',
    };
    return fallbackMappings;
  }
}

async function getCachedMappings(): Promise<VersionedCalendarMapping[]> {
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

export function getDoctorScheduleLoadInfo(): DoctorScheduleLoadInfo {
  return { ...lastLoadInfo };
}

export async function getScheduleVersions(): Promise<CalendarMapping[]> {
  const mappings = await getCachedMappings();
  return mappings.map(cloneCalendarMapping);
}

export async function getActiveScheduleMappings(targetDate?: string): Promise<CalendarMapping[]> {
  const mappings = await getCachedMappings();
  const effectiveDate = normalizeRequestedDate(targetDate);

  return resolveMappingsForDate(mappings, effectiveDate)
    .filter((mapping) => mapping.isActive)
    .map(cloneCalendarMapping);
}

export async function getScheduleMapping(
  doctorId: DoctorId,
  clinicId: ClinicId,
  targetDate?: string
): Promise<CalendarMapping | undefined> {
  const mappings = await getActiveScheduleMappings(targetDate);
  const mapping = mappings.find((entry) => entry.doctorId === doctorId && entry.clinicId === clinicId);
  return mapping
    ? {
        ...mapping,
        schedule: cloneWeeklySchedule(mapping.schedule),
      }
    : undefined;
}

export async function getScheduleMappingByRawIds(
  doctorId: string,
  clinicId: string,
  targetDate?: string
): Promise<CalendarMapping | undefined> {
  if (!isDoctorId(doctorId) || !isClinicId(clinicId)) {
    return undefined;
  }
  return getScheduleMapping(doctorId, clinicId, targetDate);
}

export async function getActiveCalendarIds(): Promise<string[]> {
  const mappings = await getCachedMappings();
  return Array.from(
    new Set(
      mappings
        .filter((mapping) => mapping.isActive)
        .map((mapping) => mapping.calendarId.trim())
        .filter((calendarId) => calendarId.length > 0)
    )
  );
}
