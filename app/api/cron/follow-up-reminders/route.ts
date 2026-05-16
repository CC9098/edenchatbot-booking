import { NextRequest, NextResponse } from 'next/server';

import { authorizeBookingReminderCronRequest } from '@/lib/booking-reminder-cron-auth';
import { runFollowUpReminderJob } from '@/lib/follow-up-reminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseLookaheadDays(value: string | null): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 60) {
    return undefined;
  }

  return parsed;
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
    const summary = await runFollowUpReminderJob({
      targetDate,
      lookaheadDays: parseLookaheadDays(request.nextUrl.searchParams.get('lookaheadDays')),
      dryRun,
    });

    return NextResponse.json({
      success: true,
      authMode: authResult.mode,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown follow-up reminder error';
    console.error('[cron/follow-up-reminders] failed:', message);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
