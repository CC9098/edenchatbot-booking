import { NextResponse } from 'next/server';

import { getPublicBookableScheduleData } from '@/lib/bookable-schedule-data-server';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const doctors = await getPublicBookableScheduleData();
    return NextResponse.json({ doctors });
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
