import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPage, analyticsReferrer, bookingCompletedParams, recordPageView, type AnalyticsBrowser } from '../lib/analytics';
import { englishPath, englishRoutes } from '../content/english/site';

const origin = 'https://app.edenclinic.hk';
const id = 'G-TEST123';
const pages = englishRoutes.filter(route => route.path !== '/book/').map(route => ({ path: englishPath(route.path), title: route.title }));
function commands(browser: AnalyticsBrowser) { return (browser.dataLayer || []).map(args => Array.from(args as ArrayLike<unknown>)); }
function views(browser: AnalyticsBrowser) { return commands(browser).filter(args => args[0] === 'event' && args[1] === 'page_view'); }

test('all maintained English pages receive the explicit English content language', () => {
  for (const page of pages) {
    const result = analyticsPage(page.path, null, origin, pages)!;
    assert.equal(result.content_language, 'en', page.path);
    assert.equal(result.page_path, page.path);
    assert.equal(result.page_title, page.title);
  }
  assert.equal(analyticsPage('/booking', 'en', origin)?.content_language, 'en');
  assert.equal(analyticsPage('/embed/booking', 'en', origin)?.content_language, 'en');
  assert.equal(analyticsPage('/booking', null, origin)?.content_language, 'zh-Hant');
});

test('analytics URL, titles and referrer never contain request parameters or private titles', () => {
  const page = analyticsPage('/en/booking?token=SIGNED&name=TEST#private', 'en', origin)!;
  assert.equal(page.page_location, `${origin}/en/booking`);
  assert.equal(page.page_title, 'Book an appointment | Eden Clinic');
  assert.equal(analyticsReferrer('https://www.edenclinic.hk/manage?token=SIGNED&email=patient@example.com#private'), 'https://www.edenclinic.hk');
  assert.equal(analyticsReferrer('javascript:alert(1)'), '');
  assert.equal(analyticsReferrer('not a URL'), '');
  const dynamic = analyticsPage('/articles/patient@example.com', null, origin)!;
  assert.equal(dynamic.page_location, `${origin}/articles/[article]`);
});

test('private, staff, signed management, and unknown English routes are excluded', () => {
  for (const path of ['/doctor/booking', '/nurse', '/login', '/my-bookings', '/manage-booking', '/en/manage-booking', '/manage/SIGNED', '/online-consult', '/conversations', '/oauth/callback', '/en/not-a-real-page']) {
    assert.equal(analyticsPage(path, 'en', origin, pages), null, path);
  }
  assert.equal(analyticsPage('/embed', 'en', origin, [], 'manage-booking'), null);
});

test('one page view per public route/language survives StrictMode and query-only language changes', () => {
  const browser: AnalyticsBrowser = {};
  const zh = analyticsPage('/booking', null, origin)!;
  const en = analyticsPage('/booking', 'en', origin)!;
  recordPageView(browser, id, zh, 'https://google.com/search?q=PRIVATE');
  recordPageView(browser, id, zh, 'https://google.com/search?q=PRIVATE');
  recordPageView(browser, id, en);
  recordPageView(browser, id, en);
  assert.equal(views(browser).length, 2);
  assert.equal((views(browser)[0][2] as Record<string, unknown>).content_language, 'zh-Hant');
  assert.equal((views(browser)[1][2] as Record<string, unknown>).content_language, 'en');
  assert.equal((views(browser)[1][2] as Record<string, unknown>).page_referrer, `${origin}/booking`);
  const configs = commands(browser).filter(args => args[0] === 'config');
  assert.ok(configs.every(args => (args[2] as Record<string, unknown>).send_page_view === false));
  assert.equal((configs[1][2] as Record<string, unknown>).update, true);
  assert.ok(!JSON.stringify(commands(browser)).includes('PRIVATE'));
});

test('private navigation disables delivery and returning to public content counts a fresh view', () => {
  const browser: AnalyticsBrowser = {};
  const page = analyticsPage('/en', null, origin)!;
  recordPageView(browser, id, page);
  assert.equal(recordPageView(browser, id, null), false);
  assert.equal(browser[`ga-disable-${id}`], true);
  assert.equal(views(browser).length, 1);
  recordPageView(browser, id, page);
  assert.equal(browser[`ga-disable-${id}`], false);
  assert.equal(views(browser).length, 2);
  assert.equal(recordPageView({}, '', page), false);
});

test('booking completion retains its key-event name and only public enum parameters', () => {
  const page = analyticsPage('/booking', 'en', origin)!;
  const safe = bookingCompletedParams(page, {
    doctor_id: 'chan', clinic_id: 'central', booking_flow: 'whatsapp',
    booking_id: 'PATIENT-ID', token: 'SIGNED', email: 'patient@example.com', phone: '12345678', symptoms: 'PRIVATE', page_location: '?token=SIGNED',
  })!;
  assert.deepEqual(safe, { ...page, doctor_id: 'chan', clinic_id: 'central', booking_flow: 'whatsapp' });
  assert.equal(safe.content_language, 'en');
  assert.equal(bookingCompletedParams(page, { booking_flow: 'staff' }), null);
  assert.equal(bookingCompletedParams(analyticsPage('/en', null, origin), {}), null);
  assert.equal(bookingCompletedParams(null, {}), null);
  assert.deepEqual(bookingCompletedParams(page, { doctor_id: 'PATIENT-ID', clinic_id: 'patient@example.com' }), page);
});
