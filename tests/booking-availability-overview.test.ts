import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookingDatesBetween,
  earliestAvailabilitySummary,
  scanBookingOverview,
  type AvailabilityState,
} from '../lib/booking-availability-overview';

const stateMap = (states: Record<string, AvailabilityState>) => (date: string) => states[date];

test('bookingDatesBetween spans month and year boundaries inclusively', () => {
  assert.deepEqual(bookingDatesBetween('2026-08-30', '2026-09-02'), [
    '2026-08-30',
    '2026-08-31',
    '2026-09-01',
    '2026-09-02',
  ]);
  assert.deepEqual(bookingDatesBetween('2026-12-31', '2027-01-01'), ['2026-12-31', '2027-01-01']);
  assert.deepEqual(bookingDatesBetween('2026-10-21', '2026-10-21'), ['2026-10-21']);
});

test('bookingDatesBetween returns an empty range for inverted or invalid input', () => {
  assert.deepEqual(bookingDatesBetween('2026-10-22', '2026-10-21'), []);
  assert.deepEqual(bookingDatesBetween('', '2026-10-21'), []);
});

test('earliest date can fall in a later month', () => {
  const dates = bookingDatesBetween('2026-08-30', '2026-09-03');
  const summary = earliestAvailabilitySummary(
    dates,
    stateMap({
      '2026-08-30': 'unavailable',
      '2026-08-31': 'unavailable',
      '2026-09-01': 'available',
      '2026-09-02': 'available',
    }),
    false
  );
  assert.deepEqual(summary, { label: '最早 1/9 可約', tone: 'available' });
});

test('an available date is shown even while later dates are still loading', () => {
  const dates = bookingDatesBetween('2026-10-21', '2026-10-25');
  const summary = earliestAvailabilitySummary(
    dates,
    stateMap({ '2026-10-21': 'unavailable', '2026-10-22': 'available' }),
    true
  );
  assert.deepEqual(summary, { label: '最早 22/10 可約', tone: 'available' });
});

test('an unknown earlier date blocks a later date from being claimed earliest', () => {
  const dates = bookingDatesBetween('2026-10-30', '2026-11-02');
  const states = stateMap({
    '2026-10-30': 'unavailable',
    '2026-10-31': 'unknown',
    '2026-11-01': 'available',
  });
  assert.deepEqual(earliestAvailabilitySummary(dates, states, false), {
    label: '暫時未能確認最早時段',
    tone: 'unknown',
  });
  assert.equal(earliestAvailabilitySummary(dates, states, true).tone, 'loading');
});

test('a not-yet-scanned earlier date shows loading instead of a later date', () => {
  const dates = bookingDatesBetween('2026-10-30', '2026-11-02');
  const summary = earliestAvailabilitySummary(
    dates,
    stateMap({ '2026-10-30': 'unavailable', '2026-11-01': 'available' }),
    true
  );
  assert.deepEqual(summary, { label: '正在查詢最早時段', tone: 'loading' });
});

test('nothing available in the whole range', () => {
  const dates = bookingDatesBetween('2026-10-30', '2026-11-02');
  const summary = earliestAvailabilitySummary(dates, () => 'unavailable', false);
  assert.deepEqual(summary, { label: '可預約日期內暫無時段', tone: 'unavailable' });
});

test('empty range is reported as unknown, not as fully booked', () => {
  assert.equal(earliestAvailabilitySummary([], () => undefined, false).tone, 'unknown');
  assert.equal(earliestAvailabilitySummary([], () => undefined, true).tone, 'loading');
});

test('scan stops looking at later months once a clinic slot is found, but fills the shown month', async () => {
  const dates = bookingDatesBetween('2026-10-29', '2026-11-30');
  const requested: string[] = [];
  const available = new Set(['a|2026-10-30', 'b|2026-11-02']);

  const result = await scanBookingOverview({
    dates,
    clinics: ['a', 'b'],
    concurrency: 1,
    isPriorityDate: (date) => date.startsWith('2026-10-'),
    isCancelled: () => false,
    request: async (date, clinic) => {
      requested.push(`${clinic}|${date}`);
      return available.has(`${clinic}|${date}`) ? 'available' : 'unavailable';
    },
  });

  // Shown month (Oct) scanned for both clinics.
  for (const date of ['2026-10-29', '2026-10-30', '2026-10-31']) {
    assert.ok(requested.includes(`a|${date}`));
    assert.ok(requested.includes(`b|${date}`));
  }
  // Clinic a found in October: no November requests.
  assert.equal(requested.filter((job) => job.startsWith('a|2026-11-')).length, 0);
  // Clinic b scanned until its first November slot, then stopped.
  assert.deepEqual(
    requested.filter((job) => job.startsWith('b|2026-11-')),
    ['b|2026-11-01', 'b|2026-11-02']
  );
  assert.equal(result['2026-11-02']?.b, 'available');
  assert.equal(
    earliestAvailabilitySummary(dates, (date) => result[date]?.b, false).label,
    '最早 2/11 可約'
  );
});

test('scan keeps checking earlier dates when a later shown-month date is found first', async () => {
  const dates = bookingDatesBetween('2026-10-30', '2026-12-05');
  const requested: string[] = [];

  const result = await scanBookingOverview({
    dates,
    clinics: ['a'],
    concurrency: 1,
    // Calendar showing December.
    isPriorityDate: (date) => date.startsWith('2026-12-'),
    isCancelled: () => false,
    request: async (date) => {
      requested.push(date);
      return date === '2026-12-02' || date === '2026-11-03' ? 'available' : 'unavailable';
    },
  });

  assert.ok(requested.includes('2026-11-03'));
  assert.ok(!requested.includes('2026-11-04'));
  assert.equal(
    earliestAvailabilitySummary(dates, (date) => result[date]?.a, false).label,
    '最早 3/11 可約'
  );
});

test('scan reuses known results, retries unknown, and stops when cancelled', async () => {
  const dates = bookingDatesBetween('2026-10-21', '2026-10-24');
  const requested: string[] = [];
  let cancelled = false;

  const result = await scanBookingOverview({
    dates,
    clinics: ['a'],
    concurrency: 1,
    known: { '2026-10-21': { a: 'unavailable' }, '2026-10-22': { a: 'unknown' } },
    isCancelled: () => cancelled,
    request: async (date) => {
      requested.push(date);
      if (date === '2026-10-23') cancelled = true;
      return 'unavailable';
    },
  });

  assert.deepEqual(requested, ['2026-10-22', '2026-10-23']);
  assert.equal(result['2026-10-21']?.a, 'unavailable');
  assert.equal(result['2026-10-22']?.a, 'unavailable');
  assert.equal(result['2026-10-23'], undefined);
});

test('scan treats a thrown request as unknown and respects the concurrency bound', async () => {
  const dates = bookingDatesBetween('2026-10-21', '2026-10-30');
  let inFlight = 0;
  let maxInFlight = 0;
  let priorityDone = 0;

  const result = await scanBookingOverview({
    dates,
    clinics: ['a', 'b'],
    concurrency: 3,
    isPriorityDate: () => true,
    isCancelled: () => false,
    onPriorityComplete: () => {
      priorityDone += 1;
    },
    request: async (date, clinic) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      if (clinic === 'b' && date === '2026-10-21') throw new Error('network');
      return 'unavailable';
    },
  });

  assert.ok(maxInFlight <= 3);
  assert.equal(priorityDone, 1);
  assert.equal(result['2026-10-21']?.b, 'unknown');
});
