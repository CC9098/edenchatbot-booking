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
  getDoctorBookingVisitOption,
  getDoctorBookingVisitOptions,
  isSupportBookingPractitioner,
} from '@/shared/clinic-data';
import { GROUP_BOOKING_POLICIES } from '@/lib/group-booking-policy';
import { CALENDAR_MAPPINGS } from '@/shared/schedule-config';

test('Dr. Lee shows acupuncture only on booking pages', () => {
  assert.equal(getDoctorBookingTreatmentLabel('lee'), '針灸 Acupuncture');
  assert.deepEqual(
    getDoctorBookingTreatmentOptions('lee').map((option) => option.id),
    ['acupuncture']
  );
});

test('Dr. Hon and Dr. Chau use 15-minute booking slots', () => {
  assert.equal(getDoctorBookingSlotMinutes('hon'), 15);
  assert.equal(getDoctorBookingSlotMinutes('chau'), 15);
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
});

test('Dr. Cheung Tin Wai online consultation uses 20-minute evening slots', () => {
  assert.equal(DOCTOR_BY_ID.cheung.nameZh, '張天慧醫師');
  assert.equal(getDoctorBookingSlotMinutes('cheung'), 20);

  const mapping = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'cheung' && candidate.clinicId === 'online'
  );
  assert.equal(mapping?.effectiveFrom, '2026-05-01');
  assert.deepEqual(mapping?.schedule[3], [{ start: '21:30', end: '23:30' }]);
  assert.deepEqual(mapping?.schedule[4], [{ start: '21:30', end: '23:30' }]);
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

test('Dr. Wong booking keeps two simple chiropractic services and first-visit promotion', () => {
  const visitOptions = getDoctorBookingVisitOptions('wong');
  assert.deepEqual(
    visitOptions.map((option) => option.visitType),
    ['first', 'followup']
  );

  const firstVisit = getDoctorBookingVisitOption('wong', 'first');
  assert.equal(firstVisit?.serviceNameZh, '脊醫首診： 檢查及治療');
  assert.equal(firstVisit?.serviceNameEn, 'Standard Chiropractic Examination');
  assert.equal(firstVisit?.durationMinutes, 30);
  assert.equal(firstVisit?.priceHkd, 490);
  assert.equal(firstVisit?.originalPriceHkd, 980);
  assert.equal(firstVisit?.promotionLabel, '中醫聯乘優惠');
  assert.equal(firstVisit?.note, '凡正接受醫天圓中醫診症的病人，可享首次半價優惠。');

  const followUp = getDoctorBookingVisitOption('wong', 'followup');
  assert.equal(followUp?.serviceNameZh, '脊醫覆診： 跟進治療');
  assert.equal(followUp?.serviceNameEn, 'Standard Follow Up Visit');
  assert.equal(followUp?.durationMinutes, 15);
  assert.equal(followUp?.priceHkd, 880);

  assert.equal(getDoctorBookingSlotMinutes('wong', 'first'), 30);
  assert.equal(getDoctorBookingSlotMinutes('wong', 'followup'), 15);
  assert.equal(getDoctorBookingSlotMinutes('wong'), 30);
});

test('Dr. Wong Jordan schedule matches the May 2026 poster hours', () => {
  const mapping = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'wong' && candidate.clinicId === 'jordan'
  );
  assert.deepEqual(mapping?.schedule[4], [{ start: '11:00', end: '14:00' }]);
  assert.deepEqual(mapping?.schedule[6], [{ start: '14:30', end: '16:30' }]);

  const policy = GROUP_BOOKING_POLICIES.find(
    (candidate) => candidate.doctorId === 'wong' && candidate.clinicId === 'jordan'
  );
  assert.deepEqual(policy?.sessions, [
    { dayOfWeek: 4, start: '11:00', end: '14:00' },
    { dayOfWeek: 6, start: '14:30', end: '16:30' },
  ]);
});
