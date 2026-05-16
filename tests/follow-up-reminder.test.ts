import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFollowUpReminderNote,
  decideFollowUpReminder,
  findCalendarBookingPresence,
  getPhoneDigitVariants,
  phoneDigitsMatch,
} from '@/lib/follow-up-reminder-core';

test('phone variant matching treats local HK and 852-prefixed numbers as the same patient', () => {
  assert.deepEqual(new Set(getPhoneDigitVariants('9123 4567')), new Set(['91234567', '85291234567']));
  assert.equal(phoneDigitsMatch('+852 9123 4567', '91234567'), true);
  assert.equal(phoneDigitsMatch('85291234567', '91234567'), true);
  assert.equal(phoneDigitsMatch('85291234567', '61234567'), false);
});

test('calendar phone match is a confirmed existing booking', () => {
  const presence = findCalendarBookingPresence(
    {
      patientName: '陳小明',
      patientPhone: '9123 4567',
    },
    [
      {
        calendarId: 'doctor-calendar',
        event: {
          id: 'evt_123',
          summary: '舊平台預約 - Chan Siu Ming',
          description: '病人電話：+852 9123 4567',
          start: { dateTime: '2026-05-16T10:00:00+08:00' },
        },
      },
    ],
  );

  assert.deepEqual(presence, {
    status: 'confirmed',
    source: 'google_calendar',
    bookingId: 'evt_123',
    detail: 'doctor-calendar/evt_123: phone match',
  });
});

test('calendar name-only match is possible and blocks auto reminder for safety', () => {
  const presence = findCalendarBookingPresence(
    {
      patientName: '陳小明',
      patientPhone: '',
    },
    [
      {
        calendarId: 'doctor-calendar',
        event: {
          id: 'evt_456',
          summary: '陳小明 覆診',
          description: '',
          start: { dateTime: '2026-05-16T10:00:00+08:00' },
        },
      },
    ],
  );

  assert.equal(presence.status, 'possible');
  const decision = decideFollowUpReminder({
    alreadyReminded: false,
    hasContactPhone: false,
    bookingPresence: presence,
  });
  assert.deepEqual(decision, { type: 'skip', reason: 'possible_booking' });
});

test('reminder only sends when there is contact phone and no booking signal', () => {
  assert.deepEqual(
    decideFollowUpReminder({
      alreadyReminded: false,
      hasContactPhone: true,
      bookingPresence: { status: 'none' },
    }),
    { type: 'send' },
  );

  assert.deepEqual(
    decideFollowUpReminder({
      alreadyReminded: false,
      hasContactPhone: false,
      bookingPresence: { status: 'none' },
    }),
    { type: 'skip', reason: 'missing_contact' },
  );
});

test('follow-up reminder note keeps content minimal and links to booking', () => {
  const note = buildFollowUpReminderNote({
    suggestedDate: '2026-05-16',
    bookingUrl: 'https://eden.example/booking?visitType=followup',
  });

  assert.match(note, /2026-05-16/);
  assert.match(note, /https:\/\/eden\.example\/booking\?visitType=followup/);
  assert.doesNotMatch(note, /症狀|病情|處方/);
});
