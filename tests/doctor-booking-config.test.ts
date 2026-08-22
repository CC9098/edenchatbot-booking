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

test('Dr. Cheung Min Yin uses dedicated Jordan and Tsuen Wan calendars', () => {
  const jordanMapping = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'cheungmy' && candidate.clinicId === 'jordan'
  );
  const tsuenWanMapping = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'cheungmy' && candidate.clinicId === 'tsuenwan'
  );
  const cheungTinWaiJordan = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'cheung' && candidate.clinicId === 'jordan'
  );
  const leungTsuenWan = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'leung' && candidate.clinicId === 'tsuenwan'
  );

  assert.equal(
    jordanMapping?.calendarId,
    '02340d736967498edcb5f3d62ff286e79ea51e63cb6f992393d28ffc91c0e38f@group.calendar.google.com'
  );
  assert.equal(
    tsuenWanMapping?.calendarId,
    'abff9765dbe5f9b5b39c0809afc3ec41500331c1afbf55e9797efbb31b5b7185@group.calendar.google.com'
  );
  assert.notEqual(jordanMapping?.calendarId, cheungTinWaiJordan?.calendarId);
  assert.notEqual(tsuenWanMapping?.calendarId, leungTsuenWan?.calendarId);
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

test('Dr. Wong booking keeps two simple chiropractic services without public discount or duration labels', () => {
  const visitOptions = getDoctorBookingVisitOptions('wong');
  assert.deepEqual(
    visitOptions.map((option) => option.visitType),
    ['first', 'followup']
  );

  const firstVisit = getDoctorBookingVisitOption('wong', 'first');
  assert.equal(firstVisit?.serviceNameZh, '脊醫首診： 檢查及治療');
  assert.equal(firstVisit?.serviceNameEn, 'Standard Chiropractic Examination');
  assert.equal(firstVisit?.durationMinutes, 30);
  assert.equal(firstVisit?.hideDurationLabel, true);
  assert.equal(firstVisit?.priceHkd, 980);
  assert.equal(firstVisit?.originalPriceHkd, undefined);
  assert.equal(firstVisit?.promotionLabel, undefined);
  assert.equal(firstVisit?.note, undefined);

  const followUp = getDoctorBookingVisitOption('wong', 'followup');
  assert.equal(followUp?.serviceNameZh, '脊醫覆診： 跟進治療');
  assert.equal(followUp?.serviceNameEn, 'Standard Follow Up Visit');
  assert.equal(followUp?.durationMinutes, 15);
  assert.equal(followUp?.hideDurationLabel, true);
  assert.equal(followUp?.priceHkd, 880);

  assert.equal(getDoctorBookingSlotMinutes('wong', 'first'), 30);
  assert.equal(getDoctorBookingSlotMinutes('wong', 'followup'), 15);
  assert.equal(getDoctorBookingSlotMinutes('wong'), 30);
});

test('Dr. Wong Jordan schedule matches the May 2026 poster hours without group minimum policy', () => {
  const mapping = CALENDAR_MAPPINGS.find(
    (candidate) => candidate.doctorId === 'wong' && candidate.clinicId === 'jordan'
  );
  assert.equal(
    mapping?.calendarId,
    'bb9e3b864e99dd1dda3e828e40f2545f245c8e2fd01bd459390c3409e46db4d3@group.calendar.google.com'
  );
  assert.deepEqual(mapping?.schedule[4], [{ start: '11:00', end: '14:00' }]);
  assert.deepEqual(mapping?.schedule[6], [{ start: '14:30', end: '16:30' }]);

  const policy = GROUP_BOOKING_POLICIES.find(
    (candidate) => candidate.doctorId === 'wong' && candidate.clinicId === 'jordan'
  );
  assert.equal(policy, undefined);
});
