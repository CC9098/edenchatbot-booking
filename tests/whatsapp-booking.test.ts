import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWhatsappRescheduleTemplateBodyParams } from '@/lib/whatsapp-booking';

test('buildWhatsappRescheduleTemplateBodyParams uses Meta-safe short datetime keys', () => {
  const params = buildWhatsappRescheduleTemplateBodyParams({
    bookingId: 'BK123456',
    patientName: '陳小明',
    doctorNameZh: '梁仲威醫師',
    clinicNameZh: '佐敦',
    oldDate: '2026-04-03',
    oldTime: '14:30',
    newDate: '2026-04-05',
    newTime: '16:00',
  });

  assert.equal(params.patient_name, '陳小明');
  assert.equal(params.doctor_name, '梁仲威醫師');
  assert.equal(params.clinic_name, '佐敦');
  assert.equal(params.booking_id, 'BK123456');
  assert.equal(typeof params.manage_url, 'string');
  assert.equal(params.old_datetime?.includes('14:30'), true);
  assert.equal(params.new_datetime?.includes('16:00'), true);
  assert.equal('old_appointment_datetime' in params, false);
  assert.equal('new_appointment_datetime' in params, false);
});
