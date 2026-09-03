import { NextRequest, NextResponse } from 'next/server';

import { createChatwootClientFromEnv } from '@/lib/chatwoot-agent-bot';
import {
  extractChatwootWatchdogIncomingEvent,
  runChatwootIncomingHandoffWatchdog,
  verifyTimestampedChatwootSignature,
} from '@/lib/chatwoot-handoff-watchdog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

function readExpectedId(primary: string | undefined, fallback: string | undefined, defaultValue: number) {
  const parsed = Number(primary || fallback || defaultValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = (process.env.CHATWOOT_WATCHDOG_WEBHOOK_SECRET || '').trim();

  if (!secret) {
    return NextResponse.json({ error: 'Watchdog webhook secret is not configured' }, { status: 500 });
  }

  const signatureIsValid = verifyTimestampedChatwootSignature({
    rawBody,
    signature: request.headers.get('x-chatwoot-signature'),
    timestamp: request.headers.get('x-chatwoot-timestamp'),
    secret,
  });

  if (!signatureIsValid) {
    return NextResponse.json({ error: 'Invalid Chatwoot signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const event = extractChatwootWatchdogIncomingEvent(payload);
  if (!event) {
    return NextResponse.json({ ok: true, ignored: 'unsupported_event' });
  }

  const expectedAccountId = readExpectedId(
    process.env.CHATWOOT_WATCHDOG_ACCOUNT_ID,
    process.env.CHATWOOT_ACCOUNT_ID,
    2,
  );
  const expectedInboxId = readExpectedId(
    process.env.CHATWOOT_WATCHDOG_INBOX_ID,
    process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    2,
  );

  if (event.accountId !== expectedAccountId || event.inboxId !== expectedInboxId) {
    return NextResponse.json({ ok: true, ignored: 'outside_watchdog_scope' });
  }

  try {
    const result = await runChatwootIncomingHandoffWatchdog({
      client: createChatwootClientFromEnv(),
      event,
    });

    console.info('[chatwoot/handoff-watchdog] checked incoming message', result);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown handoff watchdog error';
    console.error('[chatwoot/handoff-watchdog] failed', {
      accountId: event.accountId,
      inboxId: event.inboxId,
      conversationId: event.conversationId,
      messageId: event.messageId,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

