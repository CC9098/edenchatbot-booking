import { NextRequest, NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import { invalidateTimetableConsumers } from '@/lib/timetable-cache-invalidation';
import { HolidayScopeError, isMissingHolidayAuditColumnError, parseHolidayScopeInput } from '@/lib/holiday-scope';

export const dynamic = 'force-dynamic';

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

    // Scope must be chosen explicitly: a doctor/clinic id, or "all" (stored as NULL).
    const doctorId = parseHolidayScopeInput(body.doctorId, 'doctor');
    const clinicId = parseHolidayScopeInput(body.clinicId, 'clinic');
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
    const baseRow = {
      doctor_id: doctorId,
      clinic_id: clinicId,
      holiday_date: holidayDate,
      start_time: startTime,
      end_time: endTime,
      reason: reason || null,
    };
    const insertHoliday = (row: Record<string, unknown>) =>
      supabase.from('holidays').insert(row).select('id').single();

    let { data, error } = await insertHoliday({
      ...baseRow,
      created_by: user.id,
      created_by_email: user.email ?? null,
    });
    if (error && isMissingHolidayAuditColumnError(error)) {
      // Audit columns not migrated yet: keep creating closures without them.
      ({ data, error } = await insertHoliday(baseRow));
    }

    if (error || !data) {
      console.error('[POST /api/doctor/timetable/holidays] insert error:', error?.message);
      return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 });
    }

    invalidateTimetableConsumers();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof HolidayScopeError) {
      return NextResponse.json({ error: error.message, field: `${error.kind}Id` }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('[POST /api/doctor/timetable/holidays] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
