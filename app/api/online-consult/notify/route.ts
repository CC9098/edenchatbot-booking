import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendDoctorOnlineConsultReadyWhatsapp } from '@/lib/chatwoot-whatsapp';
import { getConfiguredDoctorNotificationWhatsapps } from '@/lib/doctor-notification-whatsapp';
import { sendDoctorOnlineConsultReadyEmail } from '@/lib/gmail';
import { patchEventPrivateMetadata } from '@/lib/google-calendar';
import { ONLINE_CONSULT_PATIENT_OPENED_KEY } from '@/lib/online-consult-no-show-reminder-core';
import { verifyOnlineConsultToken } from '@/lib/online-consult-token';
import { createServiceClient } from '@/lib/supabase';
import { DOCTOR_BY_ID, type DoctorId } from '@/shared/clinic-data';

export const runtime = 'nodejs';

const notifySchema = z.object({
  token: z.string().trim().min(1),
});

const DOCTOR_NOTIFY_PUBLIC_ERROR = '暫時未能自動通知醫師，請先開啟 Google Meet。如需協助，請回覆 WhatsApp 訊息。';

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

    const openedMarkResult = await patchEventPrivateMetadata(payload.calendarId, payload.bookingId, {
      [ONLINE_CONSULT_PATIENT_OPENED_KEY]: new Date().toISOString(),
    });
    if (!openedMarkResult.success) {
      console.warn(
        `[online-consult/notify] failed to mark patient opened ${payload.calendarId}/${payload.bookingId}: ${openedMarkResult.error || 'unknown error'}`,
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
      notifiedAtIso: new Date().toISOString(),
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
