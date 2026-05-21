import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnlineConsultNoShowReminderNote,
  decideOnlineConsultNoShowReminder,
  isWithinNoShowReminderWindow,
} from '@/lib/online-consult-no-show-reminder-core';

const baseCandidate = {
  id: 'booking-1',
  googleEventId: 'event-1',
  calendarId: 'calendar-1',
  status: 'confirmed',
  appointmentDate: '2026-05-21',
  appointmentTime: '15:00',
  patientPhone: '9750 2595',
};

test('online consult no-show window opens after the configured delay', () => {
  assert.equal(
    isWithinNoShowReminderWindow({
      appointmentDate: '2026-05-21',
      appointmentTime: '15:00',
      now: new Date('2026-05-21T07:04:59.000Z'),
      delayMinutes: 5,
      lookbackMinutes: 35,
    }),
    false,
  );

  assert.equal(
    isWithinNoShowReminderWindow({
      appointmentDate: '2026-05-21',
      appointmentTime: '15:00',
      now: new Date('2026-05-21T07:05:00.000Z'),
      delayMinutes: 5,
      lookbackMinutes: 35,
    }),
    true,
  );
});

test('online consult no-show decision sends only when patient has not opened the waiting page', () => {
  assert.deepEqual(
    decideOnlineConsultNoShowReminder({
      candidate: baseCandidate,
      now: new Date('2026-05-21T07:05:00.000Z'),
      delayMinutes: 5,
      lookbackMinutes: 35,
      meetLink: 'https://meet.google.com/abc-defg-hij',
    }),
    { type: 'send' },
  );

  assert.deepEqual(
    decideOnlineConsultNoShowReminder({
      candidate: baseCandidate,
      now: new Date('2026-05-21T07:05:00.000Z'),
      delayMinutes: 5,
      lookbackMinutes: 35,
      meetLink: 'https://meet.google.com/abc-defg-hij',
      patientOpenedAt: '2026-05-21T07:00:30.000Z',
    }),
    { type: 'skip', reason: 'patient_opened' },
  );
});

test('online consult no-show reminder note reuses the waiting link', () => {
  const note = buildOnlineConsultNoShowReminderNote({
    doctorNameZh: '張醫師',
  });

  assert.match(note, /張醫師已準備網上診症/);
  assert.match(note, /請按以下連結進入候診。/);
  assert.doesNotMatch(note, /https?:\/\//);
});
