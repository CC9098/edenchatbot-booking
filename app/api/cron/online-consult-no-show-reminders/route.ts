import { NextRequest, NextResponse } from 'next/server';

import { authorizeBookingReminderCronRequest } from '@/lib/booking-reminder-cron-auth';
import { runOnlineConsultNoShowReminderJob } from '@/lib/online-consult-no-show-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const authResult = authorizeBookingReminderCronRequest({
    authHeader: request.headers.get('authorization'),
    dryRun,
    cronSecret: process.env.CRON_SECRET,
    dryRunTestSecret: process.env.BOOKING_REMINDER_TEST_SECRET,
  });

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const targetDate = request.nextUrl.searchParams.get('targetDate')?.trim() || undefined;
  if (targetDate && !isDateOnly(targetDate)) {
    return NextResponse.json({ error: 'targetDate must be YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const summary = await runOnlineConsultNoShowReminderJob({
      targetDate,
      dryRun,
      delayMinutes: parsePositiveInt(request.nextUrl.searchParams.get('delayMinutes')),
      lookbackMinutes: parsePositiveInt(request.nextUrl.searchParams.get('lookbackMinutes')),
    });

    return NextResponse.json({
      success: true,
      authMode: authResult.mode,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown online consult reminder error';
    console.error('[cron/online-consult-no-show-reminders] failed:', message);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
