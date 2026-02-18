import { NextRequest, NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';

import { listEventsInRange, patchEventPrivateMetadata } from '@/lib/google-calendar';
import { sendBookingReminderEmail } from '@/lib/gmail';
import { getActiveCalendarIds } from '@/lib/doctor-schedule-store';
import { CLINIC_ID_BY_NAME_ZH, getClinicAddress } from '@/shared/clinic-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const REMINDER_SENT_KEY = 'eden_reminder_24h_sent_at';

function parseLineValue(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() || '';
}

function extractBookingEmailMetadata(event: any) {
  const description = typeof event?.description === 'string' ? event.description : '';
  const summary = typeof event?.summary === 'string' ? event.summary : '';

  const patientName =
    parseLineValue(description, 'Patient / 病人') ||
    summary.split(' - ').slice(1).join(' - ').trim();
  const patientEmail = parseLineValue(description, 'Email / 電郵');

  const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
  const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);

  const doctorNameZh = doctorMatch?.[1]?.trim() || '';
  const doctorName = doctorMatch?.[2]?.trim() || doctorNameZh;
  const clinicNameZh = clinicMatch?.[1]?.trim() || '';
  const clinicName = clinicMatch?.[2]?.trim() || clinicNameZh;

  if (!patientName || !patientEmail || !doctorNameZh || !clinicNameZh) {
    return null;
  }

  const clinicId = CLINIC_ID_BY_NAME_ZH[clinicNameZh];
  const clinicAddress = clinicId ? getClinicAddress(clinicId) : '';

  return {
    patientName,
    patientEmail,
    doctorName,
    doctorNameZh,
    clinicName,
    clinicNameZh,
    clinicAddress,
  };
}

function buildReminderPayload(event: any, calendarId: string) {
  const metadata = extractBookingEmailMetadata(event);
  if (!metadata) return null;

  const eventId = typeof event?.id === 'string' ? event.id : '';
  const startDateTime = typeof event?.start?.dateTime === 'string' ? event.start.dateTime : '';
  if (!eventId || !startDateTime) return null;

  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) return null;

  return {
    ...metadata,
    date: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'yyyy-MM-dd'),
    time: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'HH:mm'),
    eventId,
    calendarId,
  };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const nowIso = now.toISOString();

  const summary = {
    now: nowIso,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    dryRun,
    calendars: 0,
    eventsScanned: 0,
    eligible: 0,
    alreadySent: 0,
    skippedInvalid: 0,
    wouldSend: 0,
    sent: 0,
    sendFailed: 0,
    marked: 0,
    markFailed: 0,
    calendarErrors: [] as string[],
  };

  const calendarIds = await getActiveCalendarIds();
  summary.calendars = calendarIds.length;

  for (const calendarId of calendarIds) {
    const listResult = await listEventsInRange(calendarId, windowStart, windowEnd);
    if (!listResult.success) {
      summary.calendarErrors.push(`${calendarId}: ${listResult.error || 'unknown error'}`);
      continue;
    }

    for (const event of listResult.events) {
      summary.eventsScanned += 1;

      if (event?.status === 'cancelled') continue;

      const alreadySentAt = event?.extendedProperties?.private?.[REMINDER_SENT_KEY];
      if (alreadySentAt) {
        summary.alreadySent += 1;
        continue;
      }

      const payload = buildReminderPayload(event, calendarId);
      if (!payload) {
        summary.skippedInvalid += 1;
        continue;
      }

      summary.eligible += 1;

      if (dryRun) {
        summary.wouldSend += 1;
        continue;
      }

      const sendResult = await sendBookingReminderEmail(payload);
      if (!sendResult.success) {
        summary.sendFailed += 1;
        continue;
      }
      summary.sent += 1;

      const markResult = await patchEventPrivateMetadata(calendarId, payload.eventId, {
        [REMINDER_SENT_KEY]: nowIso,
      });
      if (markResult.success) {
        summary.marked += 1;
      } else {
        summary.markFailed += 1;
      }
    }
  }

  return NextResponse.json({ success: true, summary });
}
