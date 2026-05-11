import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendDoctorOnlineConsultReadyWhatsapp } from '@/lib/chatwoot-whatsapp';
import { sendDoctorOnlineConsultReadyEmail } from '@/lib/gmail';
import { verifyOnlineConsultToken } from '@/lib/online-consult-token';
import { createServiceClient } from '@/lib/supabase';
import { DOCTOR_BY_ID, type DoctorId } from '@/shared/clinic-data';

export const runtime = 'nodejs';

const notifySchema = z.object({
  token: z.string().trim().min(1),
});

const CHEUNG_DOCTOR_WHATSAPP_FALLBACK = '+85260260716';

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
  email: string;
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
      typeof row.email === 'string',
  );
}

function normalizeDoctorEnvKey(doctorId: string): string {
  return doctorId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function getConfiguredDoctorNotificationWhatsapp(doctorId: string): string {
  const normalizedRawDoctorId = doctorId.trim().toLowerCase();
  const normalizedDoctorId = normalizeDoctorEnvKey(doctorId);
  const doctorSpecificWhatsapp = process.env[`DOCTOR_NOTIFICATION_WHATSAPP_${normalizedDoctorId}`]?.trim();
  const legacyCheungWhatsapp = normalizedRawDoctorId === 'cheung'
    ? process.env.CHEUNG_DOCTOR_WHATSAPP?.trim() || CHEUNG_DOCTOR_WHATSAPP_FALLBACK
    : '';

  return (
    doctorSpecificWhatsapp ||
    legacyCheungWhatsapp ||
    process.env.CLINIC_NOTIFICATION_WHATSAPP?.trim() ||
    ''
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

    const doctor = DOCTOR_BY_ID[data.doctor_id as DoctorId];
    const notificationPayload = {
      bookingId: payload.bookingId,
      calendarId: payload.calendarId,
      doctorId: data.doctor_id,
      doctorName: doctor?.nameEn || data.doctor_name_zh,
      doctorNameZh: data.doctor_name_zh,
      patientName: data.patient_name,
      patientPhone: data.phone,
      patientEmail: data.email,
      date: data.appointment_date,
      time: data.appointment_time,
      durationMinutes: data.duration_minutes || undefined,
      meetLink: payload.meetLink,
      notifiedAtIso: new Date().toISOString(),
    };

    const doctorWhatsappPhone = getConfiguredDoctorNotificationWhatsapp(data.doctor_id);
    let whatsappError = '';
    if (doctorWhatsappPhone) {
      const whatsappResult = await sendDoctorOnlineConsultReadyWhatsapp({
        ...notificationPayload,
        doctorWhatsappPhone,
      });

      if (whatsappResult.success) {
        return NextResponse.json({
          success: true,
          channel: 'whatsapp',
          conversationId: whatsappResult.conversationId,
        });
      }

      whatsappError = whatsappResult.error || '未能透過 WhatsApp 通知醫師。';
      console.warn(`[online-consult/notify] doctor WhatsApp notification failed: ${whatsappError}`);
    }

    const emailResult = await sendDoctorOnlineConsultReadyEmail(notificationPayload);

    if (!emailResult.success) {
      return NextResponse.json(
        { error: whatsappError || emailResult.error || '未能通知醫師。' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, channel: 'email' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '通知醫師時發生錯誤。' },
      { status: 500 },
    );
  }
}
