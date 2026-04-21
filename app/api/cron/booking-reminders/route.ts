import { NextRequest, NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';

import { buildBookingReminderPayloadFromIntake } from '@/lib/booking-reminder-payload';
import { listConfirmedBookingReminderCandidatesByDate } from '@/lib/booking-intake-storage';
import { getEvent, patchEventPrivateMetadata } from '@/lib/google-calendar';
import { sendBookingReminderWhatsapp } from '@/lib/chatwoot-whatsapp';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { createManageAccessToken } from '@/lib/widget-booking-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const WHATSAPP_REMINDER_SENT_KEY = 'eden_reminder_24h_whatsapp_sent_at';

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
  const targetDate = formatInTimeZone(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    HONG_KONG_TIMEZONE,
    'yyyy-MM-dd'
  );
  const nowIso = now.toISOString();

  const summary = {
    now: nowIso,
    timezone: HONG_KONG_TIMEZONE,
    targetDate,
    dryRun,
    intakeCandidates: 0,
    eventChecks: 0,
    eventMissing: 0,
    eventCancelled: 0,
    eligible: 0,
    whatsappAlreadySent: 0,
    skippedInvalid: 0,
    whatsappWouldSend: 0,
    whatsappSent: 0,
    whatsappSendFailed: 0,
    whatsappSkippedInvalid: 0,
    marked: 0,
    markFailed: 0,
    intakeErrors: [] as string[],
    eventErrors: [] as string[],
    sendErrors: [] as string[],
  };

  const intakeResult = await listConfirmedBookingReminderCandidatesByDate(targetDate);
  if (!intakeResult.success) {
    summary.intakeErrors.push(intakeResult.error || 'unknown error');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load booking reminder candidates',
        summary,
      },
      { status: 500 },
    );
  }

  summary.intakeCandidates = intakeResult.items.length;

  for (const candidate of intakeResult.items) {
    const payload = buildBookingReminderPayloadFromIntake(candidate);
    if (!payload) {
      summary.skippedInvalid += 1;
      continue;
    }

    const eventResult = await getEvent(payload.calendarId, payload.eventId);
    if (!eventResult.success || !eventResult.event) {
      summary.eventMissing += 1;
      if (summary.eventErrors.length < 10) {
        summary.eventErrors.push(
          `${payload.calendarId}/${payload.eventId}: ${eventResult.error || 'missing event'}`
        );
      }
      continue;
    }

    summary.eventChecks += 1;
    const event = eventResult.event;

    if (event?.status === 'cancelled') {
      summary.eventCancelled += 1;
      continue;
    }

    const whatsappAlreadySentAt = event?.extendedProperties?.private?.[WHATSAPP_REMINDER_SENT_KEY];
    summary.eligible += 1;

    const shouldSendWhatsapp = !whatsappAlreadySentAt;

    if (!shouldSendWhatsapp) {
      summary.whatsappAlreadySent += 1;
    }

    if (!shouldSendWhatsapp) {
      continue;
    }

    if (dryRun) {
      if (payload.patientPhone) {
        summary.whatsappWouldSend += 1;
      } else {
        summary.whatsappSkippedInvalid += 1;
      }
      continue;
    }

    const metadataToPatch: Record<string, string> = {};

    if (!payload.patientPhone) {
      summary.whatsappSkippedInvalid += 1;
    } else {
      const phoneDigits = normalizePhoneForSearch(payload.patientPhone);
      const manageAccessToken = phoneDigits ? createManageAccessToken(phoneDigits) : undefined;
      const reminderClinicId = candidate.notificationClinicId || payload.clinicId;

      const whatsappResult = await sendBookingReminderWhatsapp({
        bookingId: payload.eventId,
        patientName: payload.patientName,
        phone: payload.patientPhone,
        email: payload.patientEmail,
        doctorNameZh: payload.doctorNameZh,
        clinicNameZh: payload.clinicNameZh,
        appointmentDate: payload.date,
        appointmentTime: payload.time,
        visitType: payload.visitType,
        clinicWhatsappPhone: reminderClinicId ? getClinicWhatsappPhone(reminderClinicId) : null,
        manageAccessToken,
      });

      if (!whatsappResult.success) {
        summary.whatsappSendFailed += 1;
        if (summary.sendErrors.length < 10) {
          summary.sendErrors.push(
            `${payload.calendarId}/${payload.eventId}: ${whatsappResult.error || 'send failed'}`
          );
        }
      } else {
        summary.whatsappSent += 1;
        metadataToPatch[WHATSAPP_REMINDER_SENT_KEY] = nowIso;
      }
    }

    if (Object.keys(metadataToPatch).length > 0) {
      const markResult = await patchEventPrivateMetadata(
        payload.calendarId,
        payload.eventId,
        metadataToPatch,
      );
      if (markResult.success) {
        summary.marked += 1;
      } else {
        summary.markFailed += 1;
      }
    }
  }

  return NextResponse.json({ success: true, summary });
}
