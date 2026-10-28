import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingUrl, buildManageBookingUrl } from '../lib/public-url';

test('published English outbound links use the public website without moving Chinese or embedded bookings', () => {
  const keys = ['EDEN_ENGLISH_PUBLICATION', 'VERCEL_ENV', 'NEXT_PUBLIC_BASE_URL'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://app.edenclinic.hk';
    process.env.VERCEL_ENV = 'production';
    delete process.env.EDEN_ENGLISH_PUBLICATION;
    assert.equal(new URL(buildBookingUrl({ locale: 'en' })).origin, 'https://app.edenclinic.hk');
    process.env.EDEN_ENGLISH_PUBLICATION = 'published';
    const booking = new URL(buildBookingUrl({ locale: 'en', doctorId: 'chan', clinicId: 'central' }));
    assert.equal(booking.origin, 'https://www.edenclinic.hk');
    assert.equal(booking.pathname, '/en/booking');
    assert.equal(booking.searchParams.get('doctor'), 'chan');
    const manage = new URL(buildManageBookingUrl({ locale: 'en', action: 'cancel', token: 'signed+token' }));
    assert.equal(manage.origin, 'https://www.edenclinic.hk');
    assert.equal(manage.pathname, '/en/manage-booking');
    assert.equal(manage.searchParams.get('token'), 'signed+token');
    assert.equal(new URL(buildBookingUrl({ locale: 'zh' })).origin, 'https://app.edenclinic.hk');
    assert.equal(new URL(buildManageBookingUrl({ locale: 'en', embed: true })).origin, 'https://app.edenclinic.hk');
    process.env.VERCEL_ENV = 'preview';
    assert.equal(new URL(buildManageBookingUrl({ locale: 'en' })).origin, 'https://app.edenclinic.hk');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
