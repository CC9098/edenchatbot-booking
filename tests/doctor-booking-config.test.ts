import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCTOR_BY_ID,
  getDoctorBookingGroupLabel,
  getDoctorBookingPractitionerGroup,
  getDoctorBookingRoleLabel,
  getDoctorBookingSlotMinutes,
  getDoctorBookingSupportNote,
  getDoctorBookingTreatmentLabel,
  getDoctorBookingTreatmentOptions,
  isSupportBookingPractitioner,
} from '@/shared/clinic-data';

test('Dr. Lee shows acupuncture only on booking pages', () => {
  assert.equal(getDoctorBookingTreatmentLabel('lee'), '針灸 Acupuncture');
  assert.deepEqual(
    getDoctorBookingTreatmentOptions('lee').map((option) => option.id),
    ['acupuncture']
  );
});

test('Dr. Hon and Dr. Chau use 30-minute booking slots', () => {
  assert.equal(getDoctorBookingSlotMinutes('hon'), 30);
  assert.equal(getDoctorBookingSlotMinutes('chau'), 30);
});

test('other doctors keep the default treatment label and 15-minute slots', () => {
  assert.equal(
    getDoctorBookingTreatmentLabel('chan'),
    '針灸/治療手法/中藥處方/其他（請註明） Acupuncture / Manual therapy / Chinese herbal prescription / Other (please specify)'
  );
  assert.deepEqual(
    getDoctorBookingTreatmentOptions('chan').map((option) => option.id),
    ['acupuncture', 'manual_therapy', 'herbal_prescription', 'other']
  );
  assert.equal(getDoctorBookingSlotMinutes('chan'), 15);
  assert.equal(getDoctorBookingSlotMinutes('cheung'), 15);
});

test('Dr. Cheung Min Yin is a separate acupuncture practitioner', () => {
  assert.equal(DOCTOR_BY_ID.cheungmy.nameZh, '張敏言醫師');
  assert.equal(getDoctorBookingTreatmentLabel('cheungmy'), '針灸 Acupuncture');
  assert.deepEqual(
    getDoctorBookingTreatmentOptions('cheungmy').map((option) => option.id),
    ['acupuncture']
  );
  assert.equal(getDoctorBookingSlotMinutes('cheungmy'), 15);
});

test('Dr. Chan has a configured avatar for booking profile cards', () => {
  assert.equal(DOCTOR_BY_ID.chan.avatarSrc, '/doctor-avatars/chan.jpg');
  assert.equal(DOCTOR_BY_ID.chan.avatarObjectPosition, '82% center');
});

test('Dr. Wong is treated as a support chiropractic service in booking lists', () => {
  assert.equal(getDoctorBookingPractitionerGroup('wong'), 'support');
  assert.equal(isSupportBookingPractitioner('wong'), true);
  assert.equal(getDoctorBookingGroupLabel('wong'), '協作脊醫服務');
  assert.equal(getDoctorBookingRoleLabel('wong'), '協作脊醫');
  assert.match(getDoctorBookingSupportNote('wong') || '', /協作脊醫服務/);
  assert.equal(isSupportBookingPractitioner('chan'), false);
});
