import { NextResponse } from 'next/server';

import { getPublicBookableScheduleData } from '@/lib/bookable-schedule-data-server';
import { getDoctorScheduleLoadInfo } from '@/lib/doctor-schedule-store';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const doctors = await getPublicBookableScheduleData();
    const loadInfo = getDoctorScheduleLoadInfo();

    return NextResponse.json(
      { doctors },
      {
        headers: {
          'x-doctor-schedule-count': String(loadInfo.mappingCount),
          'x-doctor-schedule-loaded-at': loadInfo.loadedAt
            ? new Date(loadInfo.loadedAt).toISOString()
            : 'unknown',
          'x-doctor-schedule-source': loadInfo.source,
        },
      }
    );
  } catch (error) {
    console.error(
      `[api/public/bookable-schedules] Error: ${getSafeErrorMessage(error)}`
    );
    return NextResponse.json(
      { error: 'Failed to load bookable schedules' },
      { status: 500 }
    );
  }
}
