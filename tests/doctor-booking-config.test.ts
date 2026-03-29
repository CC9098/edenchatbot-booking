import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDoctorBookingSlotMinutes,
  getDoctorBookingTreatmentLabel,
} from '@/shared/clinic-data';

test('Dr. Lee shows acupuncture only on booking pages', () => {
  assert.equal(getDoctorBookingTreatmentLabel('lee'), '針灸 Acupuncture');
});

test('Dr. Hon and Dr. Chau use 30-minute booking slots', () => {
  assert.equal(getDoctorBookingSlotMinutes('hon'), 30);
  assert.equal(getDoctorBookingSlotMinutes('chau'), 30);
});

test('other doctors keep the default treatment label and 15-minute slots', () => {
  assert.equal(
    getDoctorBookingTreatmentLabel('chan'),
    '針灸/治療手法 Acupuncture / Manual therapy'
  );
  assert.equal(getDoctorBookingSlotMinutes('chan'), 15);
  assert.equal(getDoctorBookingSlotMinutes('cheung'), 15);
});
