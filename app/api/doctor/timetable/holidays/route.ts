import { NextRequest, NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import { isClinicId, isDoctorId } from '@/shared/clinic-data';

export const dynamic = 'force-dynamic';

function normalizeOptionalEntityId(raw: unknown, type: 'doctor' | 'clinic') {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') {
    throw new Error(`${type}Id must be a string or empty`);
  }

  const value = raw.trim();
  if (!value) return null;
  if (type === 'doctor' && !isDoctorId(value)) {
    throw new Error('Invalid doctorId');
  }
  if (type === 'clinic' && !isClinicId(value)) {
    throw new Error('Invalid clinicId');
  }
  return value;
}

function normalizeDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error('holidayDate must use YYYY-MM-DD');
  }
  return value.trim();
}

function normalizeTime(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value.trim())) {
    throw new Error(`${fieldName} must use HH:mm`);
  }
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const body = await request.json();

    const doctorId = normalizeOptionalEntityId(body.doctorId, 'doctor');
    const clinicId = normalizeOptionalEntityId(body.clinicId, 'clinic');
    const holidayDate = normalizeDate(body.holidayDate);
    const startTime = normalizeTime(body.startTime, 'startTime');
    const endTime = normalizeTime(body.endTime, 'endTime');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';

    if ((startTime && !endTime) || (!startTime && endTime)) {
      return NextResponse.json({ error: 'startTime and endTime must be provided together' }, { status: 400 });
    }
    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json({ error: 'startTime must be earlier than endTime' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('holidays')
      .insert({
        doctor_id: doctorId,
        clinic_id: clinicId,
        holiday_date: holidayDate,
        start_time: startTime,
        end_time: endTime,
        reason: reason || null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[POST /api/doctor/timetable/holidays] insert error:', error?.message);
      return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[POST /api/doctor/timetable/holidays] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
