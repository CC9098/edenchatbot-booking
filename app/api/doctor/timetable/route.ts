import { NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import {
  createEmptyDayInputs,
  normalizeDbTime,
  type DayInputMap,
} from '@/lib/timetable-admin-utils';
import { CLINICS, DOCTORS } from '@/shared/clinic-data';
import type { WeeklySchedule } from '@/shared/schedule-config';

export const dynamic = 'force-dynamic';

interface DoctorScheduleRow {
  id: string;
  doctor_id: string;
  clinic_id: string;
  calendar_id: string;
  is_active: boolean;
  schedule: WeeklySchedule | null;
}

interface HolidayRow {
  id: string;
  doctor_id: string | null;
  clinic_id: string | null;
  holiday_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

function mapDayInputs(schedule: WeeklySchedule | null): DayInputMap {
  const next = createEmptyDayInputs();
  if (!schedule) return next;

  for (const dayKey of Object.keys(next) as Array<keyof DayInputMap>) {
    const ranges = schedule[Number(dayKey)];
    next[dayKey] = Array.isArray(ranges)
      ? ranges.map((range) => `${range.start}-${range.end}`).join(', ')
      : '';
  }

  return next;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const supabase = createServiceClient();

    const [{ data: scheduleRows, error: scheduleError }, { data: holidayRows, error: holidayError }] =
      await Promise.all([
        supabase
          .from('doctor_schedules')
          .select('id, doctor_id, clinic_id, calendar_id, is_active, schedule')
          .order('doctor_id', { ascending: true })
          .order('clinic_id', { ascending: true }),
        supabase
          .from('holidays')
          .select('id, doctor_id, clinic_id, holiday_date, start_time, end_time, reason, created_at')
          .order('holiday_date', { ascending: true })
          .order('created_at', { ascending: false }),
      ]);

    if (scheduleError) {
      console.error('[GET /api/doctor/timetable] doctor_schedules query error:', scheduleError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (holidayError) {
      console.error('[GET /api/doctor/timetable] holidays query error:', holidayError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const schedules = ((scheduleRows ?? []) as DoctorScheduleRow[]).map((row) => ({
      id: row.id,
      doctorId: row.doctor_id,
      clinicId: row.clinic_id,
      calendarId: row.calendar_id,
      isActive: Boolean(row.is_active),
      dayInputs: mapDayInputs(row.schedule),
    }));

    const holidays = ((holidayRows ?? []) as HolidayRow[]).map((row) => ({
      id: row.id,
      doctorId: row.doctor_id,
      clinicId: row.clinic_id,
      holidayDate: row.holiday_date,
      startTime: normalizeDbTime(row.start_time),
      endTime: normalizeDbTime(row.end_time),
      reason: row.reason ?? '',
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      role: staffRole.role,
      doctors: DOCTORS.map((doctor) => ({
        id: doctor.id,
        nameZh: doctor.nameZh,
        nameEn: doctor.nameEn,
      })),
      clinics: CLINICS.map((clinic) => ({
        id: clinic.id,
        nameZh: clinic.nameZh,
        nameEn: clinic.nameEn,
      })),
      schedules,
      holidays,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[GET /api/doctor/timetable] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
