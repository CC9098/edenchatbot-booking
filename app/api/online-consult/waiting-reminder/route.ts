import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendPatientOnlineConsultWaitingWhatsapp } from '@/lib/chatwoot-whatsapp';
import { getEvent, patchEventPrivateMetadata } from '@/lib/google-calendar';
import { verifyOnlineConsultToken } from '@/lib/online-consult-token';
import { createServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

const WAITING_REMINDER_SENT_KEY = 'eden_online_consult_waiting_reassurance_sent_at';
const DEFAULT_WAITING_MINUTES = 5;

const waitingReminderSchema = z.object({
  token: z.string().trim().min(1),
});

type BookingIntakeWaitingReminderRow = {
  id: string;
  status: string | null;
  google_event_id: string | null;
  calendar_id: string | null;
  doctor_name_zh: string;
  appointment_date: string;
  appointment_time: string;
  patient_name: string;
  phone: string;
  email: string | null;
};

function isBookingIntakeWaitingReminderRow(value: unknown): value is BookingIntakeWaitingReminderRow {
  const row = value as Partial<BookingIntakeWaitingReminderRow> | null;
  return Boolean(
    row &&
      typeof row.id === 'string' &&
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
    const parsed = waitingReminderSchema.safeParse(body);
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
      .select('id, status, google_event_id, calendar_id, doctor_name_zh, appointment_date, appointment_time, patient_name, phone, email')
      .eq('google_event_id', payload.bookingId)
      .eq('calendar_id', payload.calendarId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: '暫時未能讀取預約資料。' }, { status: 500 });
    }

    if (!isBookingIntakeWaitingReminderRow(data)) {
      return NextResponse.json({ error: '找不到此網上診症預約。' }, { status: 404 });
    }

    if (data.status !== 'confirmed') {
      return NextResponse.json({ error: '此預約不是有效狀態。' }, { status: 409 });
    }

    const eventResult = await getEvent(payload.calendarId, payload.bookingId);
    if (!eventResult.success) {
      return NextResponse.json(
        { error: eventResult.error || '暫時未能確認等候訊息狀態。' },
        { status: 502 },
      );
    }

    if (eventResult.event?.extendedProperties?.private?.[WAITING_REMINDER_SENT_KEY]) {
      return NextResponse.json({ success: true, alreadySent: true });
    }

    const whatsappResult = await sendPatientOnlineConsultWaitingWhatsapp({
      bookingId: payload.bookingId,
      calendarId: payload.calendarId,
      patientName: data.patient_name,
      phone: data.phone,
      email: data.email || '',
      doctorNameZh: data.doctor_name_zh,
      appointmentDate: data.appointment_date,
      appointmentTime: data.appointment_time,
      waitingMinutes: DEFAULT_WAITING_MINUTES,
    });

    if (!whatsappResult.success) {
      return NextResponse.json(
        { error: whatsappResult.error || '暫時未能發送等候提示。' },
        { status: 502 },
      );
    }

    const markResult = await patchEventPrivateMetadata(payload.calendarId, payload.bookingId, {
      [WAITING_REMINDER_SENT_KEY]: new Date().toISOString(),
    });
    if (!markResult.success) {
      console.warn(
        `[online-consult/waiting-reminder] sent but failed to mark ${payload.calendarId}/${payload.bookingId}: ${markResult.error || 'unknown error'}`,
      );
    }

    return NextResponse.json({
      success: true,
      channel: 'whatsapp',
      conversationId: whatsappResult.conversationId,
      metadataMarked: markResult.success,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '發送等候提示時發生錯誤。' },
      { status: 500 },
    );
  }
}
