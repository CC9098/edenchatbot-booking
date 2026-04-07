import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveLegacyManageBookingRedirect } from '@/lib/legacy-manage-link';

test('resolveLegacyManageBookingRedirect normalizes legacy placeholder manage-booking path', () => {
  const redirectUrl = resolveLegacyManageBookingRedirect({
    pathSegments: ['{{1}}', 'manage-booking'],
    token: 'abc123',
  });

  assert.equal(
    redirectUrl,
    'https://edenchatbot-booking.vercel.app/manage-booking?token=abc123',
  );
});

test('resolveLegacyManageBookingRedirect extracts token from legacy placeholder-prefixed path segment', () => {
  const redirectUrl = resolveLegacyManageBookingRedirect({
    pathSegments: ['{{1}}abc123'],
  });

  assert.equal(
    redirectUrl,
    'https://edenchatbot-booking.vercel.app/manage-booking?token=abc123',
  );
});

test('resolveLegacyManageBookingRedirect returns null for unrelated legacy paths', () => {
  const redirectUrl = resolveLegacyManageBookingRedirect({
    pathSegments: ['anything-else'],
  });

  assert.equal(redirectUrl, null);
});
