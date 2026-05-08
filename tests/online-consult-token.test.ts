import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createOnlineConsultToken,
  verifyOnlineConsultToken,
} from '@/lib/online-consult-token';

test('online consult token verifies signed booking and Meet payload', () => {
  const token = createOnlineConsultToken({
    bookingId: 'booking-123',
    calendarId: 'calendar@example.com',
    doctorId: 'cheung',
    doctorNameZh: '張天慧醫師',
    appointmentDate: '2026-05-13',
    appointmentTime: '21:30',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    ttlMs: 60_000,
  });

  const result = verifyOnlineConsultToken(token);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.payload.bookingId, 'booking-123');
    assert.equal(result.payload.doctorId, 'cheung');
    assert.equal(result.payload.meetLink, 'https://meet.google.com/abc-defg-hij');
  }
});

test('online consult token rejects tampered signatures', () => {
  const token = createOnlineConsultToken({
    bookingId: 'booking-123',
    calendarId: 'calendar@example.com',
    doctorNameZh: '張天慧醫師',
    appointmentDate: '2026-05-13',
    appointmentTime: '21:30',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    ttlMs: 60_000,
  });
  const tamperedToken = `${token.slice(0, -2)}xx`;

  const result = verifyOnlineConsultToken(tamperedToken);
  assert.equal(result.success, false);
});

test('online consult token rejects expired payloads', () => {
  const token = createOnlineConsultToken({
    bookingId: 'booking-123',
    calendarId: 'calendar@example.com',
    doctorNameZh: '張天慧醫師',
    appointmentDate: '2026-05-13',
    appointmentTime: '21:30',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    expiresAtMs: Date.now() - 1_000,
  });

  const result = verifyOnlineConsultToken(token);
  assert.equal(result.success, false);
});
