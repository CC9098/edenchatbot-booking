import assert from 'node:assert/strict';

import { getMonthlyUnavailableSummaryLabel } from '../lib/booking-availability-labels';

assert.equal(
  getMonthlyUnavailableSummaryLabel({
    calendarMonthKey: '2026-03',
    currentMonthKey: '2026-03',
  }),
  '本月餘下日子暫滿'
);

assert.equal(
  getMonthlyUnavailableSummaryLabel({
    calendarMonthKey: '2026-04',
    currentMonthKey: '2026-03',
  }),
  '本月暫滿'
);

console.log('booking-availability-labels.test.ts passed');
