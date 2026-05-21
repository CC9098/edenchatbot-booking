import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { sendDoctorOnlineConsultReadyWhatsapp } from '@/lib/chatwoot-whatsapp';
import { getConfiguredDoctorNotificationWhatsapps } from '@/lib/doctor-notification-whatsapp';
import { sendDoctorOnlineConsultReadyEmail } from '@/lib/gmail';
import { getEvent, patchEventPrivateMetadata } from '@/lib/google-calendar';
import {
  ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_AT_KEY,
  ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_OWNER_KEY,
  ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_CHANNEL_KEY,
  ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_KEY,
  isFreshOnlineConsultDoctorNotificationPending,
} from '@/lib/online-consult-doctor-notification-core';
import { ONLINE_CONSULT_PATIENT_OPENED_KEY } from '@/lib/online-consult-no-show-reminder-core';
import { verifyOnlineConsultToken } from '@/lib/online-consult-token';
import { createServiceClient } from '@/lib/supabase';
import { DOCTOR_BY_ID, type DoctorId } from '@/shared/clinic-data';

export const runtime = 'nodejs';

const notifySchema = z.object({
  token: z.string().trim().min(1),
});

const DOCTOR_NOTIFY_PUBLIC_ERROR = '暫時未能自動通知醫師，請先開啟 Google Meet。如需協助，請回覆 WhatsApp 訊息。';
const DOCTOR_NOTIFY_LOCK_SETTLE_MS = 800;

type BookingIntakeReadyRow = {
  id: string;
  status: string | null;
  google_event_id: string | null;
  calendar_id: string | null;
  doctor_id: string;
  doctor_name_zh: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number | null;
  patient_name: string;
  phone: string;
  email: string | null;
};

function isBookingIntakeReadyRow(value: unknown): value is BookingIntakeReadyRow {
  const row = value as Partial<BookingIntakeReadyRow> | null;
  return Boolean(
    row &&
      typeof row.id === 'string' &&
      typeof row.doctor_id === 'string' &&
      typeof row.doctor_name_zh === 'string' &&
      typeof row.appointment_date === 'string' &&
      typeof row.appointment_time === 'string' &&
      typeof row.patient_name === 'string' &&
      typeof row.phone === 'string' &&
      (typeof row.email === 'string' || row.email === null),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireDoctorNotificationLock(input: {
  calendarId: string;
  bookingId: string;
  now: Date;
}): Promise<
  | { type: 'acquired'; owner: string }
  | { type: 'already_notified' }
  | { type: 'notification_pending' }
  | { type: 'error'; error: string }
> {
  const eventResult = await getEvent(input.calendarId, input.bookingId);
  if (!eventResult.success || !eventResult.event) {
    return {
      type: 'error',
      error: eventResult.error || '暫時未能確認醫師通知狀態。',
    };
  }

  const privateMetadata = eventResult.event.extendedProperties?.private || {};
  if (privateMetadata[ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_KEY]) {
    return { type: 'already_notified' };
  }

  if (
    isFreshOnlineConsultDoctorNotificationPending(
      privateMetadata[ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_AT_KEY],
      input.now,
    )
  ) {
    return { type: 'notification_pending' };
  }

  const owner = randomUUID();
  const pendingAt = input.now.toISOString();
  const markResult = await patchEventPrivateMetadata(input.calendarId, input.bookingId, {
    [ONLINE_CONSULT_PATIENT_OPENED_KEY]: pendingAt,
    [ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_AT_KEY]: pendingAt,
    [ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_OWNER_KEY]: owner,
  });
  if (!markResult.success) {
    return {
      type: 'error',
      error: markResult.error || '暫時未能標記醫師通知狀態。',
    };
  }

  await sleep(DOCTOR_NOTIFY_LOCK_SETTLE_MS);

  const confirmResult = await getEvent(input.calendarId, input.bookingId);
  if (!confirmResult.success || !confirmResult.event) {
    return {
      type: 'error',
      error: confirmResult.error || '暫時未能確認醫師通知狀態。',
    };
  }

  const confirmedPrivate = confirmResult.event.extendedProperties?.private || {};
  if (confirmedPrivate[ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_KEY]) {
    return { type: 'already_notified' };
  }

  if (confirmedPrivate[ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_OWNER_KEY] !== owner) {
    return { type: 'notification_pending' };
  }

  return { type: 'acquired', owner };
}

async function markDoctorNotificationSent(input: {
  calendarId: string;
  bookingId: string;
  channel: 'whatsapp' | 'email';
  now: Date;
}): Promise<void> {
  const markResult = await patchEventPrivateMetadata(input.calendarId, input.bookingId, {
    [ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_KEY]: input.now.toISOString(),
    [ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_CHANNEL_KEY]: input.channel,
  });

  if (!markResult.success) {
    console.warn(
      `[online-consult/notify] sent ${input.channel} but failed to mark doctor notified ${input.calendarId}/${input.bookingId}: ${markResult.error || 'unknown error'}`,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = notifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 });
    }

    const tokenResult = verifyOnlineConsultToken(parsed.data.token);
    if (!tokenResult.success) {
      return NextResponse.json({ error: tokenResult.error }, { status: 400 });
    }

    const payload = tokenResult.payload;
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('booking_intake')
      .select('id, status, google_event_id, calendar_id, doctor_id, doctor_name_zh, appointment_date, appointment_time, duration_minutes, patient_name, phone, email')
      .eq('google_event_id', payload.bookingId)
      .eq('calendar_id', payload.calendarId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: '暫時未能讀取預約資料。' }, { status: 500 });
    }

    if (!isBookingIntakeReadyRow(data)) {
      return NextResponse.json({ error: '找不到此網上診症預約。' }, { status: 404 });
    }

    if (data.status !== 'confirmed') {
      return NextResponse.json({ error: '此預約不是有效狀態。' }, { status: 409 });
    }

    const requestedAt = new Date();
    const lockResult = await acquireDoctorNotificationLock({
      calendarId: payload.calendarId,
      bookingId: payload.bookingId,
      now: requestedAt,
    });

    if (lockResult.type === 'already_notified' || lockResult.type === 'notification_pending') {
      return NextResponse.json({
        success: true,
        channel: 'whatsapp',
        alreadyNotified: true,
      });
    }

    if (lockResult.type === 'error') {
      console.warn(
        `[online-consult/notify] failed to acquire doctor notification lock ${payload.calendarId}/${payload.bookingId}: ${lockResult.error}`,
      );
      return NextResponse.json(
        { error: DOCTOR_NOTIFY_PUBLIC_ERROR },
        { status: 502 },
      );
    }

    const doctor = DOCTOR_BY_ID[data.doctor_id as DoctorId];
    const notificationPayload = {
      bookingId: payload.bookingId,
      calendarId: payload.calendarId,
      doctorId: data.doctor_id,
      doctorName: doctor?.nameEn || data.doctor_name_zh,
      doctorNameZh: data.doctor_name_zh,
      patientName: data.patient_name,
      patientPhone: data.phone,
      patientEmail: data.email || '',
      date: data.appointment_date,
      time: data.appointment_time,
      durationMinutes: data.duration_minutes || undefined,
      meetLink: payload.meetLink,
      notifiedAtIso: requestedAt.toISOString(),
    };

    const doctorWhatsappPhones = getConfiguredDoctorNotificationWhatsapps(data.doctor_id);
    let whatsappError = '';
    if (doctorWhatsappPhones.length > 0) {
      const whatsappResults = [];
      for (const doctorWhatsappPhone of doctorWhatsappPhones) {
        const whatsappResult = await sendDoctorOnlineConsultReadyWhatsapp({
          ...notificationPayload,
          doctorWhatsappPhone,
        });
        whatsappResults.push({ doctorWhatsappPhone, ...whatsappResult });
      }

      const successfulWhatsappResults = whatsappResults.filter((result) => result.success);
      if (successfulWhatsappResults.length > 0) {
        await markDoctorNotificationSent({
          calendarId: payload.calendarId,
          bookingId: payload.bookingId,
          channel: 'whatsapp',
          now: new Date(),
        });

        const failedWhatsappResults = whatsappResults.filter((result) => !result.success);
        if (failedWhatsappResults.length > 0) {
          console.warn(
            `[online-consult/notify] doctor WhatsApp notification partially failed: ${failedWhatsappResults
              .map((result) => `${result.doctorWhatsappPhone}: ${result.error || 'unknown error'}`)
              .join('; ')}`,
          );
        }

        return NextResponse.json({
          success: true,
          channel: 'whatsapp',
          conversationId: successfulWhatsappResults[0]?.conversationId,
          conversationIds: successfulWhatsappResults
            .map((result) => result.conversationId)
            .filter(Boolean),
          deliveryStatuses: successfulWhatsappResults
            .map((result) => result.deliveryStatus)
            .filter(Boolean),
        });
      }

      whatsappError = whatsappResults
        .map((result) => `${result.doctorWhatsappPhone}: ${result.error || '未能透過 WhatsApp 通知醫師。'}`)
        .join('; ');
      console.warn(`[online-consult/notify] doctor WhatsApp notification failed: ${whatsappError}`);
    }

    const emailResult = await sendDoctorOnlineConsultReadyEmail(notificationPayload);

    if (!emailResult.success) {
      console.warn(
        `[online-consult/notify] doctor notification failed; whatsapp=${whatsappError || 'not attempted'}; email=${emailResult.error || 'unknown error'}`,
      );
      return NextResponse.json(
        { error: DOCTOR_NOTIFY_PUBLIC_ERROR },
        { status: 502 },
      );
    }

    await markDoctorNotificationSent({
      calendarId: payload.calendarId,
      bookingId: payload.bookingId,
      channel: 'email',
      now: new Date(),
    });

    return NextResponse.json({ success: true, channel: 'email' });
  } catch (error) {
    console.warn(
      `[online-consult/notify] unexpected failure: ${error instanceof Error ? error.message : String(error)}`,
    );
    return NextResponse.json(
      { error: DOCTOR_NOTIFY_PUBLIC_ERROR },
      { status: 500 },
    );
  }
}
