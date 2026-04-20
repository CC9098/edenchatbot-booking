import { NextResponse } from 'next/server';

import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase';
import {
  createEmptyDayInputs,
  getTodayIsoInHongKong,
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
  effective_from: string;
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

function selectVisibleScheduleRows(rows: DoctorScheduleRow[]): DoctorScheduleRow[] {
  const today = getTodayIsoInHongKong();
  const rowsByKey = new Map<string, DoctorScheduleRow[]>();

  for (const row of rows) {
    const key = `${row.doctor_id}:${row.clinic_id}`;
    const current = rowsByKey.get(key);
    if (current) {
      current.push(row);
    } else {
      rowsByKey.set(key, [row]);
    }
  }

  const visibleRows: DoctorScheduleRow[] = [];

  for (const group of rowsByKey.values()) {
    const sorted = [...group].sort((left, right) => left.effective_from.localeCompare(right.effective_from));
    const current = [...sorted]
      .reverse()
      .find((row) => row.effective_from <= today);
    const future = sorted.filter((row) => row.effective_from > today);

    if (current) {
      visibleRows.push(current);
    }
    visibleRows.push(...future);
  }

  return visibleRows.sort((left, right) => {
    if (left.clinic_id !== right.clinic_id) {
      return left.clinic_id.localeCompare(right.clinic_id);
    }
    if (left.doctor_id !== right.doctor_id) {
      return left.doctor_id.localeCompare(right.doctor_id);
    }
    return left.effective_from.localeCompare(right.effective_from);
  });
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const supabase = createServiceClient();

    let scheduleRows: DoctorScheduleRow[] | null = null;
    let scheduleError: { message: string } | null = null;
    const [{ data: initialScheduleRows, error: initialScheduleError }, { data: holidayRows, error: holidayError }] =
      await Promise.all([
        supabase
          .from('doctor_schedules')
          .select('id, doctor_id, clinic_id, calendar_id, is_active, effective_from, schedule')
          .order('doctor_id', { ascending: true })
          .order('clinic_id', { ascending: true })
          .order('effective_from', { ascending: true }),
        supabase
          .from('holidays')
          .select('id, doctor_id, clinic_id, holiday_date, start_time, end_time, reason, created_at')
          .order('holiday_date', { ascending: true })
          .order('created_at', { ascending: false }),
      ]);

    if (initialScheduleError && isMissingEffectiveFromColumnError(initialScheduleError)) {
      const fallbackResult = await supabase
        .from('doctor_schedules')
        .select('id, doctor_id, clinic_id, calendar_id, is_active, schedule')
        .order('doctor_id', { ascending: true })
        .order('clinic_id', { ascending: true });

      scheduleRows = Array.isArray(fallbackResult.data)
        ? (fallbackResult.data as Omit<DoctorScheduleRow, 'effective_from'>[]).map((row) => ({
            ...row,
            effective_from: getTodayIsoInHongKong(),
          }))
        : null;
      scheduleError = fallbackResult.error;
    } else {
      scheduleRows = Array.isArray(initialScheduleRows) ? (initialScheduleRows as DoctorScheduleRow[]) : null;
      scheduleError = initialScheduleError;
    }

    if (scheduleError) {
      console.error('[GET /api/doctor/timetable] doctor_schedules query error:', scheduleError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (holidayError) {
      console.error('[GET /api/doctor/timetable] holidays query error:', holidayError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const schedules = selectVisibleScheduleRows(scheduleRows ?? []).map((row) => ({
      id: row.id,
      doctorId: row.doctor_id,
      clinicId: row.clinic_id,
      calendarId: row.calendar_id,
      isActive: Boolean(row.is_active),
      effectiveFrom: row.effective_from,
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
