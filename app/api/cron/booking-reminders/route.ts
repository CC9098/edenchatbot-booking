import { NextRequest, NextResponse } from 'next/server';

import { buildBookingReminderPayload } from '@/lib/booking-reminder-payload';
import { listEventsInRange, patchEventPrivateMetadata } from '@/lib/google-calendar';
import { sendBookingReminderWhatsapp } from '@/lib/chatwoot-whatsapp';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { sendBookingReminderEmail } from '@/lib/gmail';
import { getActiveCalendarIds } from '@/lib/doctor-schedule-store';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { createManageAccessToken } from '@/lib/widget-booking-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REMINDER_SENT_KEY = 'eden_reminder_24h_sent_at';
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
    emailAlreadySent: 0,
    whatsappAlreadySent: 0,
    emailSkippedMissing: 0,
    skippedInvalid: 0,
    emailWouldSend: 0,
    whatsappWouldSend: 0,
    emailSent: 0,
    whatsappSent: 0,
    emailSendFailed: 0,
    whatsappSendFailed: 0,
    whatsappSkippedInvalid: 0,
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

      const emailAlreadySentAt = event?.extendedProperties?.private?.[EMAIL_REMINDER_SENT_KEY];
      const whatsappAlreadySentAt = event?.extendedProperties?.private?.[WHATSAPP_REMINDER_SENT_KEY];

      const payload = buildBookingReminderPayload(event, calendarId);
      if (!payload) {
        summary.skippedInvalid += 1;
        continue;
      }

      summary.eligible += 1;

      const shouldSendEmail = !emailAlreadySentAt;
      const shouldSendWhatsapp = !whatsappAlreadySentAt;

      if (!shouldSendEmail) {
        summary.emailAlreadySent += 1;
      }

      if (!shouldSendWhatsapp) {
        summary.whatsappAlreadySent += 1;
      }

      if (!shouldSendEmail && !shouldSendWhatsapp) {
        continue;
      }

      if (dryRun) {
        if (shouldSendEmail) {
          if (payload.patientEmail) {
            summary.emailWouldSend += 1;
          } else {
            summary.emailSkippedMissing += 1;
          }
        }

        if (shouldSendWhatsapp) {
          if (payload.patientPhone) {
            summary.whatsappWouldSend += 1;
          } else {
            summary.whatsappSkippedInvalid += 1;
          }
        }
        continue;
      }

      const metadataToPatch: Record<string, string> = {};

      if (shouldSendEmail) {
        if (!payload.patientEmail) {
          summary.emailSkippedMissing += 1;
        } else {
          const emailResult = await sendBookingReminderEmail(payload);
          if (!emailResult.success) {
            summary.emailSendFailed += 1;
          } else {
            summary.emailSent += 1;
            metadataToPatch[EMAIL_REMINDER_SENT_KEY] = nowIso;
          }
        }
      }

      if (shouldSendWhatsapp) {
        if (!payload.patientPhone) {
          summary.whatsappSkippedInvalid += 1;
        } else {
          const phoneDigits = normalizePhoneForSearch(payload.patientPhone);
          const manageAccessToken = phoneDigits ? createManageAccessToken(phoneDigits) : undefined;

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
            clinicWhatsappPhone: payload.clinicId ? getClinicWhatsappPhone(payload.clinicId) : null,
            manageAccessToken,
          });

          if (!whatsappResult.success) {
            summary.whatsappSendFailed += 1;
          } else {
            summary.whatsappSent += 1;
            metadataToPatch[WHATSAPP_REMINDER_SENT_KEY] = nowIso;
          }
        }
      }

      if (Object.keys(metadataToPatch).length > 0) {
        const markResult = await patchEventPrivateMetadata(calendarId, payload.eventId, metadataToPatch);
        if (markResult.success) {
          summary.marked += 1;
        } else {
          summary.markFailed += 1;
        }
      }
    }
  }

  return NextResponse.json({ success: true, summary });
}
