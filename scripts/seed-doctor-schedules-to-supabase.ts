import { config as loadDotenv } from 'dotenv';

import { createClient } from '@supabase/supabase-js';

import { DOCTORS } from '../shared/clinic-data';
import { CALENDAR_MAPPINGS } from '../shared/schedule-config';

interface ExistingScheduleRow {
  id: string;
  doctor_id: string;
  clinic_id: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function main() {
  loadDotenv({ path: '.env.local' });
  loadDotenv();

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const doctorRows = DOCTORS.map((doctor) => ({
    id: doctor.id,
    name: doctor.nameEn,
    name_zh: doctor.nameZh,
    title: 'Doctor',
    title_zh: '醫師',
    is_active: true,
  }));

  const { error: doctorUpsertError } = await supabase
    .from('doctors')
    .upsert(doctorRows, { onConflict: 'id' });
  if (doctorUpsertError) {
    throw new Error(`Failed to upsert doctors: ${doctorUpsertError.message}`);
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('doctor_schedules')
    .select('id, doctor_id, clinic_id');
  if (existingRowsError) {
    throw new Error(`Failed to read existing doctor_schedules: ${existingRowsError.message}`);
  }

  const existingByKey = new Map<string, ExistingScheduleRow>();
  for (const row of (existingRows || []) as ExistingScheduleRow[]) {
    const key = `${row.doctor_id}:${row.clinic_id}`;
    if (!existingByKey.has(key)) {
      existingByKey.set(key, row);
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const mapping of CALENDAR_MAPPINGS) {
    const payload = {
      doctor_id: mapping.doctorId,
      clinic_id: mapping.clinicId,
      calendar_id: mapping.calendarId,
      is_active: mapping.isActive,
      schedule: mapping.schedule,
    };
    const key = `${mapping.doctorId}:${mapping.clinicId}`;
    const existing = existingByKey.get(key);

    if (!existing) {
      const { error } = await supabase.from('doctor_schedules').insert(payload);
      if (error) {
        throw new Error(`Failed to insert doctor_schedules(${key}): ${error.message}`);
      }
      insertedCount += 1;
      continue;
    }

    const { error } = await supabase
      .from('doctor_schedules')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      throw new Error(`Failed to update doctor_schedules(${key}): ${error.message}`);
    }
    updatedCount += 1;
  }

  console.log(`Seed completed. doctors=${doctorRows.length}, inserted=${insertedCount}, updated=${updatedCount}`);
}

main().catch((error) => {
  console.error('[seed-doctor-schedules-to-supabase] Error:', error);
  process.exit(1);
});
