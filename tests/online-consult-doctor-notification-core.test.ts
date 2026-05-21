import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_TTL_MS,
  isFreshOnlineConsultDoctorNotificationPending,
} from '@/lib/online-consult-doctor-notification-core';

test('online consult doctor notification pending lock suppresses immediate repeats', () => {
  const pendingAt = '2026-05-21T14:54:17.500Z';

  assert.equal(
    isFreshOnlineConsultDoctorNotificationPending(
      pendingAt,
      new Date('2026-05-21T14:54:18.000Z'),
    ),
    true,
  );

  assert.equal(
    isFreshOnlineConsultDoctorNotificationPending(
      pendingAt,
      new Date(Date.parse(pendingAt) + ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_TTL_MS),
    ),
    false,
  );
});

test('online consult doctor notification pending lock ignores missing or invalid timestamps', () => {
  const now = new Date('2026-05-21T14:54:18.000Z');

  assert.equal(isFreshOnlineConsultDoctorNotificationPending(undefined, now), false);
  assert.equal(isFreshOnlineConsultDoctorNotificationPending('', now), false);
  assert.equal(isFreshOnlineConsultDoctorNotificationPending('not-a-date', now), false);
});
