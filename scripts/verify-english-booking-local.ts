/** Local-only, intercepted browser checks. This script cannot send booking or patient-message requests. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
import { detailedBookingSchema } from '@/shared/booking-intake-schema';

async function main() {
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3128';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Use a local development server only.');
const date = new Date(Date.now() + 86400000);
const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(date);
const mutations: Array<{ path: string; body: Record<string, unknown> }> = [];
const browser = await chromium.launch({ headless: true });
const checks: string[] = [];
const booking = { bookingId: 'mock-booking-en', status: 'confirmed', patientName: 'TEST Patient 頭痛', doctorId: 'chan', doctorNameZh: '陳家富醫師', clinicId: 'central', clinicNameZh: '中環', appointmentDate: tomorrow, appointmentTime: '11:00', durationMinutes: 15, visitType: 'followup', clinicWhatsappUrl: 'https://wa.me/85259269537', canSelfManage: true, message: '', manageToken: 'mock-signed-management-token' };
const schedules = [{ doctorId: 'chan', doctorNameZh: '陳家富醫師', doctorNameEn: 'Dr. Chan', clinics: [{ clinicId: 'central', clinicNameZh: '中環', clinicNameEn: 'Central', schedule: {} }, { clinicId: 'jordan', clinicNameZh: '佐敦', clinicNameEn: 'Jordan', schedule: {} }] }];

async function newPage(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      return route.continue();
    }
    const body = request.postDataJSON() || {};
    const path = url.pathname;
    if (!['GET', 'HEAD'].includes(request.method()) && path !== '/api/availability') mutations.push({ path, body });
    if (path === '/api/availability') return route.fulfill({ json: { success: true, slots: ['11:00', '11:15'], isClosed: false } });
    if (path === '/api/booking-whatsapp') {
      detailedBookingSchema.parse(body);
      return route.fulfill({ json: { success: true, bookingId: 'mock-booking-en', intakeSaved: true, whatsappSent: true } });
    }
    if (path === '/api/public/bookable-schedules') return route.fulfill({ json: { doctors: schedules } });
    if (path === '/api/widget-booking/verify-token') return route.fulfill({ json: { success: true, bookings: [booking], message: '已驗證，可選擇要更改或取消的預約。' } });
    if (path === '/api/widget-booking/request-link') return route.fulfill({ json: { success: true, maskedPhone: '****0000', message: '登入連結已發送。' } });
    if (path === '/api/widget-booking/reschedule') return route.fulfill({ json: { success: true, booking: { ...booking, appointmentDate: body.date, appointmentTime: body.time, clinicId: body.clinicId }, message: '預約已更改成功。' } });
    if (path === '/api/widget-booking/cancel') return route.fulfill({ json: { success: true, booking, message: '預約已取消。如需重新安排，可以重新開始預約流程。' } });
    return route.fulfill({ status: 401, json: {} });
  });
  return context.newPage();
}

async function chooseAppointment(page: Page) {
  await page.getByRole('button', { name: 'Next: date and time', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${tomorrow}`) }).click();
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await page.getByRole('button', { name: 'Next: your details', exact: true }).click();
}

try {
  const first = await newPage();
  await first.goto(`${base}/en/booking?doctor=chan&clinic=central&source=english-local-test`, { waitUntil: 'domcontentloaded' });
  await first.getByRole('heading', { name: 'Book an appointment', exact: true }).waitFor();
  await chooseAppointment(first);
  await first.getByLabel('Given name *', { exact: true }).fill('English');
  await first.getByLabel('Family name *', { exact: true }).fill('TEST');
  await first.getByLabel('WhatsApp phone number *', { exact: true }).fill('00000000');
  await first.getByLabel('Date of birth *', { exact: true }).fill('1990-01-15');
  await first.getByLabel('Gender *').selectOption('other');
  await first.getByLabel('Allergies *', { exact: true }).fill('none');
  await first.getByLabel('Current medicines / supplements *', { exact: true }).fill('none');
  await first.getByLabel('Main symptoms *', { exact: true }).fill('頭痛 — original patient text');
  await first.getByLabel('How did you hear about us? *').selectOption('google');
  await first.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await first.getByRole('heading', { name: 'Appointment booked', exact: true }).waitFor();
  const submitted = mutations.find((m) => m.path === '/api/booking-whatsapp')!.body;
  assert.equal(submitted.locale, 'en');
  assert.equal(submitted.doctorNameZh, '陳家富醫師');
  assert.equal(submitted.clinicNameZh, '中環');
  assert.equal(submitted.symptoms, '頭痛 — original patient text');
  assert.equal(submitted.visitType, 'first');
  assert.match(String(submitted.notes), /english-local-test/);
  await first.screenshot({ path: 'output/english-booking-localization/first-visit-success-desktop.png', fullPage: true });
  checks.push('English first visit: selection, date/time, intake, strict payload, success; original clinical input preserved');

  const followup = await newPage({ width: 390, height: 844 });
  await followup.goto(`${base}/en/booking?doctor=chan&clinic=central&visitType=followup`, { waitUntil: 'domcontentloaded' });
  await chooseAppointment(followup);
  assert.equal(await followup.getByText('First visit details (required)', { exact: true }).count(), 0);
  await followup.getByLabel('Given name *', { exact: true }).fill('English');
  await followup.getByLabel('Family name *', { exact: true }).fill('TEST');
  await followup.getByLabel('WhatsApp phone number *', { exact: true }).fill('00000000');
  await followup.getByRole('button', { name: 'Confirm appointment', exact: true }).click();
  await followup.getByRole('heading', { name: 'Appointment booked', exact: true }).waitFor();
  assert.equal(mutations.filter((m) => m.path === '/api/booking-whatsapp').at(-1)!.body.visitType, 'followup');
  assert.ok(await followup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await followup.screenshot({ path: 'output/english-booking-localization/followup-success-mobile.png', fullPage: true });
  checks.push('English follow-up: mobile intake/success, no first-visit fields, no horizontal overflow');

  const link = await newPage();
  await link.goto(`${base}/en/manage-booking?action=reschedule`, { waitUntil: 'domcontentloaded' });
  await link.getByLabel('WhatsApp phone number', { exact: true }).fill('00000000');
  await link.getByRole('button', { name: 'Send sign-in link', exact: true }).click();
  await link.getByText('Sign-in link sent.', { exact: true }).waitFor();
  assert.equal(mutations.find((m) => m.path === '/api/widget-booking/request-link')!.body.locale, 'en');
  const tabs = await link.locator('nav[aria-label="Appointments"] a').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  assert.ok(tabs.every((href) => href?.startsWith('/en')));
  checks.push('English management sign-in link: localized response, locale in request, all internal tabs stay on preview origin');

  for (const action of ['reschedule', 'cancel'] as const) {
    const page = await newPage({ width: 390, height: 844 });
    await page.goto(`${base}/en/manage-booking?action=${action}&token=mock-access-token`, { waitUntil: 'domcontentloaded' });
    await page.getByText('TEST Patient 頭痛').waitFor();
    if (action === 'reschedule') {
      await page.getByRole('button', { name: new RegExp(`^${tomorrow}`) }).click();
      await page.getByRole('button', { name: '11:15', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm reschedule', exact: true }).click();
      await page.getByRole('heading', { name: 'Appointment rescheduled', exact: true }).waitFor();
    } else {
      await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await page.getByRole('heading', { name: 'Appointment cancelled', exact: true }).waitFor();
    }
    const submitted = mutations.find((m) => m.path === `/api/widget-booking/${action}`)!.body;
    assert.equal(submitted.locale, 'en');
    assert.equal(submitted.manageToken, booking.manageToken);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: `output/english-booking-localization/${action}-success-mobile.png`, fullPage: true });
    checks.push(`English ${action}: verified management link, original patient identity, signed per-booking token, localized mobile confirmation/success`);
  }

  const chinese = await newPage();
  await chinese.goto(`${base}/booking`, { waitUntil: 'domcontentloaded' });
  await chinese.getByRole('heading', { name: '預約服務', exact: true }).waitFor();
  assert.equal(await chinese.locator('main[lang]').getAttribute('lang'), 'zh-Hant-HK');
  checks.push('Existing Chinese booking entry still renders the Chinese flow');
  await fs.writeFile('output/english-booking-localization/browser-checks.json', JSON.stringify({ base, checks, interceptedMutationPaths: mutations.map((m) => m.path), noLiveWritesOrMessages: true }, null, 2));
  console.log(JSON.stringify({ checks, noLiveWritesOrMessages: true }, null, 2));
} finally {
  await browser.close();
}

}

main().catch((error) => { console.error(error); process.exitCode = 1; });
