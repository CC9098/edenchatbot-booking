import { NextRequest, NextResponse } from 'next/server';

import { authorizeBookingReminderCronRequest } from '@/lib/booking-reminder-cron-auth';
import { createChatwootClientFromEnv } from '@/lib/chatwoot-agent-bot';
import { runChatwootHandoffAudit } from '@/lib/chatwoot-handoff-watchdog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readExpectedId(primary: string | undefined, fallback: string | undefined, defaultValue: number) {
  const parsed = Number(primary || fallback || defaultValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export async function GET(request: NextRequest) {
  const authResult = authorizeBookingReminderCronRequest({
    authHeader: request.headers.get('authorization'),
    dryRun: false,
    cronSecret: process.env.CRON_SECRET,
    dryRunTestSecret: undefined,
  });

  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const accountId = readExpectedId(
    process.env.CHATWOOT_WATCHDOG_ACCOUNT_ID,
    process.env.CHATWOOT_ACCOUNT_ID,
    2,
  );
  const inboxId = readExpectedId(
    process.env.CHATWOOT_WATCHDOG_INBOX_ID,
    process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    2,
  );

  try {
    const summary = await runChatwootHandoffAudit({
      client: createChatwootClientFromEnv(),
      accountId,
      inboxId,
    });

    console.info('[cron/chatwoot-handoff-audit] completed', {
      accountId,
      inboxId,
      ...summary,
    });
    return NextResponse.json(
      { success: summary.failures.length === 0, summary },
      { status: summary.failures.length === 0 ? 200 : 500 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Chatwoot handoff audit error';
    console.error('[cron/chatwoot-handoff-audit] failed', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
