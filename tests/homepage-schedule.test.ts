import assert from 'node:assert/strict';

import { toHomepageSchedule } from '../lib/homepage-schedule';

const doctors = [
  {
    doctorId: 'chan',
    doctorNameZh: '陳家富醫師',
    bookingPractitionerGroup: 'tcm',
    bookingTreatmentOptions: [{ id: 'acupuncture' }, { id: 'herbal_prescription' }],
    clinics: [
      { clinicId: 'central', schedule: { 0: null, 1: [{ start: '11:00', end: '14:00' }], 2: null, 3: null, 4: null, 5: null, 6: null } },
      { clinicId: 'tsuenwan', schedule: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } },
    ],
  },
] as never;

const notices = [
  { startDate: '2026-10-29', endDate: '2026-10-29', bookingText: '29/10員工活動日，全線休息' },
  { doctorId: 'chan', clinicId: 'central', startDate: '2026-11-03', endDate: '2026-11-03', timeLabel: '15:30-19:30', bookingText: '陳醫師下午休息' },
] as never;

const out = toHomepageSchedule(doctors, notices, new Date('2026-10-28T00:00:00Z'));

assert.equal(out.fetchedAt, '2026-10-28T00:00:00.000Z');
assert.deepEqual(out.doctors[0], {
  id: 'chan',
  name: '陳家富醫師',
  group: 'tcm',
  treatments: ['acupuncture', 'herbal_prescription'],
  clinics: [{ id: 'central', schedule: { 0: null, 1: [{ start: '11:00', end: '14:00' }], 2: null, 3: null, 4: null, 5: null, 6: null } }],
});
assert.deepEqual(out.notices, [
  { doctor: null, clinic: null, start: '2026-10-29', end: '2026-10-29', allDay: true, text: '29/10員工活動日，全線休息' },
  { doctor: 'chan', clinic: 'central', start: '2026-11-03', end: '2026-11-03', allDay: false, text: '陳醫師下午休息' },
]);

console.log('homepage-schedule tests passed');
