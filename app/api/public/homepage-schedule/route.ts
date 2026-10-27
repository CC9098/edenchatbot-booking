import { NextResponse } from 'next/server';

import { getPublicBookableScheduleData } from '@/lib/bookable-schedule-data-server';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import { getUpcomingHolidayNotices } from '@/lib/holiday-notices';
import { toHomepageSchedule } from '@/lib/homepage-schedule';

export const dynamic = 'force-dynamic';
const ALLOWED_ORIGINS = new Set(['https://www.edenclinic.hk', 'https://edenclinic.hk']);

// Read-only weekly schedule + upcoming closures for the edenclinic.hk homepage booking box.
export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  try {
    const [doctors, notices] = await Promise.all([getPublicBookableScheduleData(), getUpcomingHolidayNotices()]);
    return NextResponse.json(toHomepageSchedule(doctors, notices), { headers });
  } catch (error) {
    console.error(`[api/public/homepage-schedule] Error: ${getSafeErrorMessage(error)}`);
    return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500, headers });
  }
}
