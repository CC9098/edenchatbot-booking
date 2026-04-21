import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBookingReminderPayloadFromIntake,
  buildBookingReminderPayload,
  extractBookingReminderMetadata,
} from '@/lib/booking-reminder-payload';

test('extractBookingReminderMetadata keeps WhatsApp-only bookings eligible', () => {
  const metadata = extractBookingReminderMetadata({
    summary: '預約 - 陳小明',
    description: [
      'Patient / 病人: 陳小明',
      'Phone / 電話: 96563420',
      'Doctor / 醫師: 梁仲威醫師 (Dr. Leung)',
      'Clinic / 診所: 佐敦 (Jordan)',
      'Visit Type / 類型: 覆診',
    ].join('\n'),
  });

  assert.ok(metadata);
  assert.equal(metadata.patientName, '陳小明');
  assert.equal(metadata.patientPhone, '96563420');
  assert.equal(metadata.patientEmail, '');
  assert.equal(metadata.doctorNameZh, '梁仲威醫師');
  assert.equal(metadata.clinicNameZh, '佐敦');
  assert.equal(metadata.visitType, 'followup');
});

test('buildBookingReminderPayload returns payload without requiring email', () => {
  const payload = buildBookingReminderPayload(
    {
      id: 'evt_123',
      summary: '預約 - 陳小明',
      description: [
        'Patient / 病人: 陳小明',
        'Phone / 電話: 96563420',
        'Doctor / 醫師: 梁仲威醫師 (Dr. Leung)',
        'Clinic / 診所: 佐敦 (Jordan)',
      ].join('\n'),
      start: {
        dateTime: '2026-04-16T10:00:00+08:00',
      },
    },
    'calendar_abc',
  );

  assert.ok(payload);
  assert.equal(payload.patientEmail, '');
  assert.equal(payload.patientPhone, '96563420');
  assert.equal(payload.eventId, 'evt_123');
  assert.equal(payload.calendarId, 'calendar_abc');
  assert.equal(payload.date, '2026-04-16');
  assert.equal(payload.time, '10:00');
});

test('buildBookingReminderPayloadFromIntake uses confirmed booking_intake data directly', () => {
  const payload = buildBookingReminderPayloadFromIntake({
    intakeId: 'intake_123',
    googleEventId: 'evt_456',
    calendarId: 'calendar_abc',
    patientName: '陳小明',
    patientPhone: '96563420',
    patientEmail: '',
    doctorNameZh: '梁仲威醫師',
    clinicId: 'jordan',
    clinicNameZh: '佐敦',
    visitType: 'followup',
    appointmentDate: '2026-04-16',
    appointmentTime: '10:00',
    notificationClinicId: 'jordan',
  });

  assert.ok(payload);
  assert.equal(payload.patientEmail, '');
  assert.equal(payload.patientPhone, '96563420');
  assert.equal(payload.eventId, 'evt_456');
  assert.equal(payload.calendarId, 'calendar_abc');
  assert.equal(payload.date, '2026-04-16');
  assert.equal(payload.time, '10:00');
  assert.equal(payload.clinicId, 'jordan');
});

test('buildBookingReminderPayloadFromIntake rejects incomplete booking_intake rows', () => {
  const payload = buildBookingReminderPayloadFromIntake({
    intakeId: 'intake_123',
    googleEventId: '',
    calendarId: 'calendar_abc',
    patientName: '陳小明',
    patientPhone: '96563420',
    patientEmail: '',
    doctorNameZh: '梁仲威醫師',
    clinicId: 'jordan',
    clinicNameZh: '佐敦',
    visitType: 'followup',
    appointmentDate: '2026-04-16',
    appointmentTime: '10:00',
  });

  assert.equal(payload, null);
});
