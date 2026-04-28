import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeBookingReminderCronRequest } from '@/lib/booking-reminder-cron-auth';

test('booking reminder cron auth accepts CRON_SECRET for normal runs', () => {
  const result = authorizeBookingReminderCronRequest({
    authHeader: 'Bearer cron-secret',
    dryRun: false,
    cronSecret: 'cron-secret',
    dryRunTestSecret: 'test-secret',
  });

  assert.deepEqual(result, { success: true, mode: 'cron' });
});

test('booking reminder cron auth accepts test secret for dry runs only', () => {
  const dryRunResult = authorizeBookingReminderCronRequest({
    authHeader: 'Bearer test-secret',
    dryRun: true,
    cronSecret: 'cron-secret',
    dryRunTestSecret: 'test-secret',
  });
  const liveRunResult = authorizeBookingReminderCronRequest({
    authHeader: 'Bearer test-secret',
    dryRun: false,
    cronSecret: 'cron-secret',
    dryRunTestSecret: 'test-secret',
  });

  assert.deepEqual(dryRunResult, { success: true, mode: 'dry-run-test' });
  assert.deepEqual(liveRunResult, { success: false, status: 401, error: 'Unauthorized' });
});

test('booking reminder cron auth reports missing CRON_SECRET unless dry-run test auth matches', () => {
  const dryRunResult = authorizeBookingReminderCronRequest({
    authHeader: 'Bearer test-secret',
    dryRun: true,
    cronSecret: '',
    dryRunTestSecret: 'test-secret',
  });
  const unauthorizedResult = authorizeBookingReminderCronRequest({
    authHeader: 'Bearer wrong-secret',
    dryRun: true,
    cronSecret: '',
    dryRunTestSecret: 'test-secret',
  });

  assert.deepEqual(dryRunResult, { success: true, mode: 'dry-run-test' });
  assert.deepEqual(unauthorizedResult, {
    success: false,
    status: 500,
    error: 'CRON_SECRET is not configured',
  });
});
