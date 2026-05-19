import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWhatsappConfirmationText,
  buildWhatsappOnlineTemplateBodyParams,
  buildWhatsappTemplateBodyParams,
} from '@/lib/whatsapp-booking';

test('WhatsApp confirmation text includes Google Meet link for online bookings', () => {
  const text = buildWhatsappConfirmationText({
    bookingId: 'booking-123',
    patientName: '陳大文',
    doctorNameZh: '張天慧醫師',
    clinicNameZh: '網上',
    appointmentDate: '2026-05-13',
    appointmentTime: '21:30',
    visitType: 'followup',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    onlineConsultUrl: 'https://edenchatbot-booking.vercel.app/online-consult?token=online123',
  });

  assert.match(text, /網上診症流程/);
  assert.match(text, /預約時間前 5 分鐘/);
  assert.match(text, /網上診症入口：https:\/\/edenchatbot-booking\.vercel\.app\/online-consult\?token=online123/);
  assert.match(text, /Google Meet 連結：https:\/\/meet\.google\.com\/abc-defg-hij/);
});

test('WhatsApp template params omit Meet link unless template is explicitly configured for it', () => {
  const original = process.env.CHATWOOT_WHATSAPP_CONFIRMATION_TEMPLATE_INCLUDE_MEET_LINK;
  delete process.env.CHATWOOT_WHATSAPP_CONFIRMATION_TEMPLATE_INCLUDE_MEET_LINK;

  try {
    const params = buildWhatsappTemplateBodyParams({
      bookingId: 'booking-123',
      patientName: '陳大文',
      doctorNameZh: '張天慧醫師',
      clinicNameZh: '網上',
      appointmentDate: '2026-05-13',
      appointmentTime: '21:30',
      visitType: 'followup',
      meetLink: 'https://meet.google.com/abc-defg-hij',
    });

    assert.equal(params.meet_link, undefined);
  } finally {
    if (original === undefined) {
      delete process.env.CHATWOOT_WHATSAPP_CONFIRMATION_TEMPLATE_INCLUDE_MEET_LINK;
    } else {
      process.env.CHATWOOT_WHATSAPP_CONFIRMATION_TEMPLATE_INCLUDE_MEET_LINK = original;
    }
  }
});

test('WhatsApp online template params match the current Meta template variables', () => {
  const params = buildWhatsappOnlineTemplateBodyParams({
    bookingId: 'booking-123',
    patientName: '陳大文',
    doctorNameZh: '張天慧醫師',
    clinicNameZh: '網上',
    appointmentDate: '2026-05-13',
    appointmentTime: '21:30',
    visitType: 'followup',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    onlineConsultUrl: 'https://edenchatbot-booking.vercel.app/online-consult?token=online123',
  });

  assert.equal(params.meet_link, undefined);
  assert.equal(params.online_consult_url, 'https://edenchatbot-booking.vercel.app/online-consult?token=online123');
  assert.equal(params.doctor_name, '張天慧醫師（預約時間：2026年5月13日星期三 21:30）');
  assert.equal(params.appointment_datetime, '2026年5月13日星期三 21:30');
  assert.equal(params.clinic_name, '網上');
  assert.equal(params.booking_id, 'booking-123');
});
