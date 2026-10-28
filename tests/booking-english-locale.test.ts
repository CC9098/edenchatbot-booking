import assert from 'node:assert/strict';
import React, { createElement } from 'react';
Object.assign(globalThis, { React });
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { BookingTabFlow } from '@/components/booking/BookingTabFlow';
import { ManageBookingFlow } from '@/components/booking/ManageBookingFlow';
import { bookingFeedback, bookingText, parseBookingLocale } from '@/shared/booking-locale';
import { buildBookingUrl, buildManageBookingUrl } from '@/lib/public-url';
import { earliestAvailabilitySummary } from '@/lib/booking-availability-overview';
import { detailedBookingSchema } from '@/shared/booking-intake-schema';
import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';

const doctor: BookableDoctorSchedule = {
  doctorId: 'chan', doctorNameZh: '陳家富醫師', doctorNameEn: 'Dr. Chan', bookingPractitionerGroup: 'tcm',
  bookingGroupLabel: '中醫主診醫師', bookingRoleLabel: '中醫師', bookingTreatmentLabel: '針灸 Acupuncture',
  bookingTreatmentOptions: [{ id: 'acupuncture', labelZh: '針灸', labelEn: 'Acupuncture' }], bookingSlotMinutes: 15,
  bookingVisitOptions: [], summary: '', clinics: [{ clinicId: 'central', clinicNameZh: '中環', clinicNameEn: 'Central', schedule: { 1: [{ start: '11:00', end: '14:00' }] }, summary: '' }],
};

test('locale parsing accepts only supported values and preserves Chinese default', () => {
  assert.equal(parseBookingLocale(['en', 'zh']), 'en');
  assert.equal(parseBookingLocale('EN'), 'zh');
  assert.equal(parseBookingLocale(undefined), 'zh');
  assert.equal(bookingText('首診'), '首診');
  assert.equal(bookingText('首診', 'en'), 'First visit');
});

test('interpolated copy preserves clinical/user values without translating them', () => {
  assert.equal(bookingText('主要症狀: {0}', 'en', ['其他']), 'Main symptoms: 其他');
  assert.equal(bookingText('預約編號：{0}', 'en', ['signed-token-123']), 'Booking reference: signed-token-123');
  assert.equal(bookingFeedback('這個時段剛剛已滿，請選擇其他時段。', 'en'), 'This time is no longer available. Please select another time.');
});

test('English booking and management URLs preserve selection, actions and signed tokens', () => {
  const booking = new URL(buildBookingUrl({ locale: 'en', doctorId: 'chan', clinicId: 'central', visitType: 'followup', source: 'english' }));
  assert.equal(booking.pathname, '/en/booking');
  assert.equal(booking.searchParams.get('doctor'), 'chan');
  assert.equal(booking.searchParams.get('visitType'), 'followup');
  const manage = new URL(buildManageBookingUrl({ locale: 'en', action: 'cancel', token: 'signed.token+safe' }));
  assert.equal(manage.pathname, '/en/manage-booking');
  assert.equal(manage.searchParams.get('token'), 'signed.token+safe');
  assert.equal(manage.searchParams.get('action'), 'cancel');
  assert.equal(new URL(buildManageBookingUrl()).pathname, '/manage-booking');
  assert.equal(new URL(buildBookingUrl({ embed: true, locale: 'en' })).searchParams.get('lang'), 'en');
});

test('shared booking SSR renders localized setup and keeps existing Chinese setup', () => {
  const en = renderToStaticMarkup(createElement(BookingTabFlow, { doctors: [doctor], locale: 'en', initialSelection: { doctorId: 'chan', clinicId: 'central' } }));
  assert.match(en, /Book an appointment/);
  assert.match(en, /Select a clinic/);
  assert.match(en, /First visit/);
  assert.match(en, /Acupuncture/);
  assert.doesNotMatch(en, />首診</);
  assert.doesNotMatch(en, />一</);
  const zh = renderToStaticMarkup(createElement(BookingTabFlow, { doctors: [doctor] }));
  assert.match(zh, /預約服務/);
  assert.match(zh, /請選擇醫師及服務/);
});

test('shared management SSR renders English action and request-link form', () => {
  const en = renderToStaticMarkup(createElement(ManageBookingFlow, { action: 'reschedule', locale: 'en' }));
  assert.match(en, /WhatsApp sign-in link/);
  assert.match(en, /Send sign-in link/);
  assert.match(en, /Reschedule/);
  assert.doesNotMatch(en, /驗證電話/);
});

test('earliest availability keeps Chinese default and localizes English without changing date order', () => {
  assert.equal(earliestAvailabilitySummary(['2026-11-03'], () => 'available', false).label, '最早 3/11 可約');
  assert.equal(earliestAvailabilitySummary(['2026-11-03'], () => 'available', false, 'en').label, 'Earliest: 3/11');
});

test('detailed booking schema retains optional locale across strict validation', () => {
  const payload = { doctorId: 'chan', doctorName: 'Dr. Chan', doctorNameZh: '陳家富醫師', clinicId: 'central', clinicName: 'Central', clinicNameZh: '中環', date: '2026-11-03', time: '11:00', patientName: 'Test Patient', phone: '00000000', email: '', visitType: 'followup', needReceipt: 'no', medicationPickup: 'none', locale: 'en' };
  const parsed = detailedBookingSchema.parse(payload);
  assert.equal(parsed.locale, 'en');
  assert.equal(parsed.clinicNameZh, '中環');
  assert.equal(detailedBookingSchema.safeParse({ ...payload, locale: 'fr' }).success, false);
  assert.equal(detailedBookingSchema.safeParse({ ...payload, unknownField: true }).success, false);
});
