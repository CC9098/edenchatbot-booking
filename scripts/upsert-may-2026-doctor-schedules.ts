import { config as loadDotenv } from 'dotenv';

import { createClient } from '@supabase/supabase-js';

import { DOCTORS } from '../shared/clinic-data';
import {
  CALENDAR_MAPPINGS,
  type TimeRange,
  type WeeklySchedule,
} from '../shared/schedule-config';

const EFFECTIVE_FROM = '2026-05-01';
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type ScheduleMap = Record<string, WeeklySchedule>;

interface ExistingScheduleRow {
  id: string;
  doctor_id: string;
  clinic_id: string;
}

function doctorTitleZh(doctorId: string): string {
  return doctorId === 'wong' ? '脊醫' : '醫師';
}

function doctorTitleEn(doctorId: string): string {
  return doctorId === 'wong' ? 'Chiropractor' : 'Doctor';
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function emptyWeeklySchedule(): WeeklySchedule {
  return {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
}

function schedule(days: Partial<Record<number, TimeRange[]>>): WeeklySchedule {
  const next = emptyWeeklySchedule();
  for (let day = 0; day <= 6; day += 1) {
    next[day] = days[day] ?? null;
  }
  return next;
}

function hasAnySchedule(schedule: WeeklySchedule): boolean {
  return Object.values(schedule).some((ranges) => Array.isArray(ranges) && ranges.length > 0);
}

function scheduleKey(doctorId: string, clinicId: string): string {
  return `${doctorId}:${clinicId}`;
}

const MORNING_1030_1400: TimeRange = { start: '10:30', end: '14:00' };
const AFTERNOON_1530_1900: TimeRange = { start: '15:30', end: '19:00' };
const MORNING_1100_1400: TimeRange = { start: '11:00', end: '14:00' };
const AFTERNOON_1530_1930: TimeRange = { start: '15:30', end: '19:30' };

const TSUENWAN_FULL_DAY = [MORNING_1030_1400, AFTERNOON_1530_1900];
const JORDAN_FULL_DAY = [MORNING_1100_1400, AFTERNOON_1530_1930];
const CENTRAL_FULL_DAY = [MORNING_1100_1400, AFTERNOON_1530_1930];

const MAY_2026_SCHEDULES: ScheduleMap = {
  // 中環診所
  [scheduleKey('chan', 'central')]: schedule({
    1: [MORNING_1100_1400],
    4: [MORNING_1100_1400],
  }),
  [scheduleKey('chau', 'central')]: schedule({
    2: [MORNING_1100_1400],
    5: [MORNING_1100_1400],
  }),
  [scheduleKey('hon', 'central')]: schedule({
    4: [AFTERNOON_1530_1930],
    5: [AFTERNOON_1530_1930],
  }),
  [scheduleKey('lee', 'central')]: schedule({
    1: [AFTERNOON_1530_1930],
    2: [AFTERNOON_1530_1930],
    3: CENTRAL_FULL_DAY,
  }),

  // 佐敦診所
  [scheduleKey('chan', 'jordan')]: schedule({
    1: [AFTERNOON_1530_1930],
    4: [AFTERNOON_1530_1930],
  }),
  [scheduleKey('chau', 'jordan')]: schedule({
    2: [AFTERNOON_1530_1930],
  }),
  [scheduleKey('cheung', 'jordan')]: schedule({
    4: [MORNING_1100_1400],
  }),
  [scheduleKey('hon', 'jordan')]: schedule({
    3: JORDAN_FULL_DAY,
    5: [MORNING_1100_1400],
  }),
  [scheduleKey('lee', 'jordan')]: schedule({
    1: [MORNING_1100_1400],
    2: [MORNING_1100_1400],
    5: [AFTERNOON_1530_1930],
    6: [MORNING_1100_1400, { start: '15:30', end: '18:30' }],
  }),
  [scheduleKey('wong', 'jordan')]: schedule({
    4: [{ start: '10:30', end: '13:00' }],
    6: [{ start: '14:30', end: '16:30' }],
  }),

  // 荃灣診所
  [scheduleKey('chan', 'tsuenwan')]: schedule({
    2: TSUENWAN_FULL_DAY,
    5: TSUENWAN_FULL_DAY,
    6: TSUENWAN_FULL_DAY,
  }),
  [scheduleKey('hon', 'tsuenwan')]: schedule({
    0: TSUENWAN_FULL_DAY,
    1: TSUENWAN_FULL_DAY,
  }),
  [scheduleKey('lee', 'tsuenwan')]: schedule({
    4: TSUENWAN_FULL_DAY,
  }),
};

function normalizeEffectiveFrom(raw: string | undefined): string {
  if (raw && ISO_DATE_REGEX.test(raw)) {
    return raw;
  }
  return EFFECTIVE_FROM;
}

async function main() {
  loadDotenv({ path: '.env.local' });
  loadDotenv();

  const effectiveFrom = normalizeEffectiveFrom(process.argv.find((arg) => arg.startsWith('--effective-from='))?.split('=')[1]);
  const dryRun = process.argv.includes('--dry-run');

  if (effectiveFrom !== EFFECTIVE_FROM) {
    throw new Error(`This script is only for ${EFFECTIVE_FROM}; received ${effectiveFrom}`);
  }

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const doctorSeedRows = DOCTORS.map((doctor) => ({
    id: doctor.id,
    name: doctor.nameEn,
    name_zh: doctor.nameZh,
    title: doctorTitleEn(doctor.id),
    title_zh: doctorTitleZh(doctor.id),
    is_active: true,
  }));

  if (dryRun) {
    console.log(`upsert doctors count=${doctorSeedRows.length}`);
  } else {
    const { error: doctorUpsertError } = await supabase
      .from('doctors')
      .upsert(doctorSeedRows, { onConflict: 'id' });
    if (doctorUpsertError) {
      throw new Error(`Failed to upsert doctors: ${doctorUpsertError.message}`);
    }
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('doctor_schedules')
    .select('id, doctor_id, clinic_id')
    .eq('effective_from', effectiveFrom);

  if (existingRowsError) {
    throw new Error(`Failed to read existing ${effectiveFrom} doctor_schedules: ${existingRowsError.message}`);
  }

  const existingByKey = new Map<string, ExistingScheduleRow>();
  for (const row of (existingRows || []) as ExistingScheduleRow[]) {
    existingByKey.set(scheduleKey(row.doctor_id, row.clinic_id), row);
  }

  const { data: dbDoctorRows, error: doctorRowsError } = await supabase
    .from('doctors')
    .select('id');

  if (doctorRowsError) {
    throw new Error(`Failed to read doctors: ${doctorRowsError.message}`);
  }

  const registeredDoctorIds = new Set(
    (dbDoctorRows || [])
      .map((row) => (typeof row.id === 'string' ? row.id.trim() : ''))
      .filter(Boolean)
  );
  if (dryRun) {
    for (const row of doctorSeedRows) {
      registeredDoctorIds.add(row.id);
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let skippedCount = 0;

  for (const mapping of CALENDAR_MAPPINGS) {
    const key = scheduleKey(mapping.doctorId, mapping.clinicId);
    if (!registeredDoctorIds.has(mapping.doctorId)) {
      skippedCount += 1;
      console.log(`skip ${key} reason=doctor_not_in_db`);
      continue;
    }

    const nextSchedule = MAY_2026_SCHEDULES[key] || emptyWeeklySchedule();
    const isActive = mapping.isActive && hasAnySchedule(nextSchedule);
    if (isActive) {
      activeCount += 1;
    } else {
      inactiveCount += 1;
    }

    const payload = {
      doctor_id: mapping.doctorId,
      clinic_id: mapping.clinicId,
      calendar_id: mapping.calendarId,
      is_active: isActive,
      effective_from: effectiveFrom,
      schedule: nextSchedule,
    };

    const existing = existingByKey.get(key);
    if (dryRun) {
      console.log(`${existing ? 'update' : 'insert'} ${key} active=${isActive}`);
      continue;
    }

    if (existing) {
      const { error } = await supabase
        .from('doctor_schedules')
        .update(payload)
        .eq('id', existing.id);
      if (error) {
        throw new Error(`Failed to update doctor_schedules(${key}, ${effectiveFrom}): ${error.message}`);
      }
      updatedCount += 1;
      continue;
    }

    const { error } = await supabase.from('doctor_schedules').insert(payload);
    if (error) {
      throw new Error(`Failed to insert doctor_schedules(${key}, ${effectiveFrom}): ${error.message}`);
    }
    insertedCount += 1;
  }

  console.log(
    `May 2026 schedules ${dryRun ? 'dry-run' : 'upsert'} completed. effectiveFrom=${effectiveFrom}, active=${activeCount}, inactive=${inactiveCount}, skipped=${skippedCount}, inserted=${insertedCount}, updated=${updatedCount}`
  );
  console.log('Note: 張敏言醫師 appears on the source image, but no local doctor/calendar mapping exists yet, so this script does not create a bookable schedule for that doctor.');
}

main().catch((error) => {
  console.error('[upsert-may-2026-doctor-schedules] Error:', error);
  process.exit(1);
});
