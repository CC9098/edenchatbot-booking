import { NextRequest, NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import { invalidateTimetableConsumers } from '@/lib/timetable-cache-invalidation';
import {
  buildWeeklyScheduleFromDayInputs,
  createEmptyDayInputs,
  type DayInputMap,
} from '@/lib/timetable-admin-utils';
import { isClinicId, isDoctorId } from '@/shared/clinic-data';

export const dynamic = 'force-dynamic';

interface DoctorScheduleRow {
  id: string;
}

function normalizeDayInputs(raw: unknown): DayInputMap {
  const defaults = createEmptyDayInputs();
  if (!raw || typeof raw !== 'object') return defaults;

  const row = raw as Record<string, unknown>;
  return {
    '0': typeof row['0'] === 'string' ? row['0'] : '',
    '1': typeof row['1'] === 'string' ? row['1'] : '',
    '2': typeof row['2'] === 'string' ? row['2'] : '',
    '3': typeof row['3'] === 'string' ? row['3'] : '',
    '4': typeof row['4'] === 'string' ? row['4'] : '',
    '5': typeof row['5'] === 'string' ? row['5'] : '',
    '6': typeof row['6'] === 'string' ? row['6'] : '',
  };
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const body = await request.json();

    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const doctorId = typeof body.doctorId === 'string' ? body.doctorId.trim() : '';
    const clinicId = typeof body.clinicId === 'string' ? body.clinicId.trim() : '';
    const calendarId = typeof body.calendarId === 'string' ? body.calendarId.trim() : '';
    const isActive = body.isActive !== false;

    if (!isDoctorId(doctorId)) {
      return NextResponse.json({ error: 'Invalid doctorId' }, { status: 400 });
    }
    if (!isClinicId(clinicId)) {
      return NextResponse.json({ error: 'Invalid clinicId' }, { status: 400 });
    }
    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    const dayInputs = normalizeDayInputs(body.dayInputs);
    const schedule = buildWeeklyScheduleFromDayInputs(dayInputs);
    const supabase = createServiceClient();

    if (id) {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .update({
          doctor_id: doctorId,
          clinic_id: clinicId,
          calendar_id: calendarId,
          is_active: isActive,
          schedule,
        })
        .eq('id', id)
        .select('id')
        .single();

      if (error || !data) {
        console.error('[PUT /api/doctor/timetable/schedules] update error:', error?.message);
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
      }

      invalidateTimetableConsumers();
      return NextResponse.json({ id: data.id });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('doctor_schedules')
      .select('id')
      .eq('doctor_id', doctorId)
      .eq('clinic_id', clinicId)
      .limit(1);

    if (existingError) {
      console.error('[PUT /api/doctor/timetable/schedules] existing query error:', existingError.message);
      return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }

    const existingId = (existingRows as DoctorScheduleRow[] | null)?.[0]?.id;
    if (existingId) {
      const { data, error } = await supabase
        .from('doctor_schedules')
        .update({
          calendar_id: calendarId,
          is_active: isActive,
          schedule,
        })
        .eq('id', existingId)
        .select('id')
        .single();

      if (error || !data) {
        console.error('[PUT /api/doctor/timetable/schedules] fallback update error:', error?.message);
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
      }

      invalidateTimetableConsumers();
      return NextResponse.json({ id: data.id });
    }

    const { data, error } = await supabase
      .from('doctor_schedules')
      .insert({
        doctor_id: doctorId,
        clinic_id: clinicId,
        calendar_id: calendarId,
        is_active: isActive,
        schedule,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[PUT /api/doctor/timetable/schedules] insert error:', error?.message);
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    invalidateTimetableConsumers();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[PUT /api/doctor/timetable/schedules] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
