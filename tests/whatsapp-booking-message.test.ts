import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWhatsappConfirmationText,
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
  });

  assert.match(text, /Google Meet 網上應診連結：https:\/\/meet\.google\.com\/abc-defg-hij/);
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
