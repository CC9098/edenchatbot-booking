import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedEnglishBookingTemplates } from '@/lib/booking-notification-locale';
import { buildWhatsappConfirmationText, buildWhatsappReminderText, buildWhatsappCancellationText, buildWhatsappRescheduleText, buildWhatsappTemplateBodyParams } from '@/lib/whatsapp-booking';
import { buildWhatsappManageAccessText, buildWhatsappManageVerificationText } from '@/lib/whatsapp-manage';
import { buildBookingReminderPayload, buildBookingReminderPayloadFromIntake } from '@/lib/booking-reminder-payload';
import { getInPersonReminderTemplateName } from '@/lib/whatsapp-booking';

const booking = {
  locale: 'en' as const, bookingId: 'synthetic-booking', patientName: 'Test Patient',
  doctorNameZh: '陳家富醫師', clinicNameZh: '佐敦', appointmentDate: '2026-11-12',
  appointmentTime: '10:30', visitType: 'first' as const, manageAccessToken: 'synthetic-token',
};

test('in-person reminder includes localized payment and the applicable arrival instructions', () => {
  const firstAndLast = { ...booking, isLastSessionBooking: true };
  assert.match(buildWhatsappReminderText(firstAndLast), /cash, FPS.*bank transfer only/);
  assert.match(buildWhatsappReminderText(firstAndLast), /last of this session/);
  assert.match(buildWhatsappReminderText(firstAndLast), /bring your identity card/);
  const followup = { ...booking, locale: 'zh' as const, visitType: 'followup' as const };
  assert.match(buildWhatsappReminderText(followup), /現金、轉數快（FPS）及銀行轉帳/);
  assert.doesNotMatch(buildWhatsappReminderText(followup), /最後一個看診時段|身份證/);
  assert.doesNotMatch(buildWhatsappReminderText({ ...firstAndLast, clinicId: 'online' }), /cash|last of this session|identity card/);
  assert.equal(getInPersonReminderTemplateName(followup), 'booking_reminder_visit_v2');
  assert.equal(getInPersonReminderTemplateName(booking), 'booking_reminder_visit_v2_first');
  assert.equal(getInPersonReminderTemplateName({ ...followup, isLastSessionBooking: true }), 'booking_reminder_visit_v2_last');
  assert.equal(getInPersonReminderTemplateName(firstAndLast), 'booking_reminder_visit_v2_first_last');
  assert.equal(getInPersonReminderTemplateName({ ...firstAndLast, clinicId: 'online' }), undefined);
});

test('all English booking messages use English labels and preserve the English management route', () => {
  const messages = [
    buildWhatsappConfirmationText(booking), buildWhatsappReminderText(booking),
    buildWhatsappCancellationText(booking),
    buildWhatsappRescheduleText({ ...booking, oldDate: '2026-11-11', oldTime: '11:00', newDate: '2026-11-12', newTime: '10:30' }),
    buildWhatsappManageAccessText({ locale: 'en', patientName: 'Test Patient' }),
    buildWhatsappManageVerificationText({ locale: 'en', patientName: 'Test Patient', code: '123456' }),
  ];
  for (const message of messages) {
    assert.doesNotMatch(message, /[\u3400-\u9fff]/);
    assert.match(message, /\/en\/manage-booking/);
  }
  assert.match(messages[0], /Dr\. Chan/);
  assert.match(messages[0], /Jordan/);
  assert.match(messages[0], /Hong Kong time/);
  assert.match(messages[0], /synthetic-token/);
});

test('English template parameters localize facts but preserve patient input and identifiers', () => {
  const params = buildWhatsappTemplateBodyParams({ ...booking, patientName: '陳 Test Patient' });
  assert.equal(params.patient_name, '陳 Test Patient');
  assert.equal(params.booking_id, booking.bookingId);
  assert.equal(params.doctor_name, 'Dr. Chan');
  assert.equal(params.clinic_name, 'Jordan');
  assert.equal(params.visit_type, 'First visit');
  assert.match(params.manage_url, /\/en\/manage-booking/);
});

test('English template selection excludes Chinese, unapproved and unrelated templates', () => {
  const templates = [
    { name: 'booking_confirm', language: 'zh_HK', status: 'approved' },
    { name: 'booking_confirm', language: 'en_US', status: 'approved' },
    { name: 'booking_confirm_en', language: 'en', status: 'pending' },
    { name: 'unrelated', language: 'en', status: 'approved' },
  ];
  assert.deepEqual(approvedEnglishBookingTemplates(templates, ['booking_confirm']), [
    { name: 'booking_confirm', language: 'en_US', category: 'UTILITY' },
  ]);
  assert.deepEqual(approvedEnglishBookingTemplates(templates.slice(0, 1), ['booking_confirm']), []);
});

test('reminders preserve the language from both intake JSON and calendar metadata', () => {
  const intake = buildBookingReminderPayloadFromIntake({
    locale: 'en', intakeId: 'synthetic-intake', googleEventId: 'synthetic-event', calendarId: 'synthetic-calendar',
    patientName: 'Test Patient', patientPhone: '', patientEmail: '', doctorNameZh: booking.doctorNameZh,
    clinicId: 'jordan', clinicNameZh: '佐敦', visitType: 'first', appointmentDate: '2026-11-12', appointmentTime: '10:30',
  });
  assert.equal(intake?.locale, 'en');
  const calendar = buildBookingReminderPayload({
    id: 'synthetic-event', description: 'Patient / 病人: Test Patient\nDoctor / 醫師: 陳家富醫師 (Dr. Chan)\nClinic / 診所: 佐敦 (Jordan)',
    extendedProperties: { private: { locale: 'en' } }, start: { dateTime: '2026-11-12T10:30:00+08:00' },
  }, 'synthetic-calendar');
  assert.equal(calendar?.locale, 'en');
  assert.equal(calendar?.time, '10:30');
});

test('legacy bookings retain Chinese output by default', () => {
  const message = buildWhatsappConfirmationText({ ...booking, locale: undefined });
  assert.match(message, /預約確認/);
  assert.match(message, /\/manage-booking/);
  assert.doesNotMatch(message, /\/en\//);
});

import { sendBookingConfirmationWhatsapp, sendBookingReminderWhatsapp } from '@/lib/chatwoot-whatsapp';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Chatwoot sends approved English booking templates and falls back to the legacy reminder while approval is pending', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];
  let reminderStatus = 'pending';

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm';
  delete process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE;
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY = 'UTILITY';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(requestUrl);
    const method = init?.method || 'GET';
    const path = `${parsedUrl.pathname}${parsedUrl.search}`;

    if (method === 'GET' && path === '/api/v1/profile') {
      return jsonResponse({ account_id: 1 });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/inboxes') {
      return jsonResponse({
        payload: [{
          id: 7,
          channel_type: 'Channel::Whatsapp',
          phone_number: '+85267333801',
          message_templates: [
            {
              name: 'booking_confirm',
              language: 'en',
              status: 'approved',
              category: 'UTILITY',
            },
            { name: 'booking_reminder_24h', language: 'en', status: 'approved', category: 'UTILITY' },
            { name: 'booking_reminder_visit_v2_first_last', language: 'zh_HK', status: 'approved', category: 'UTILITY' },
            { name: 'booking_reminder_visit_v2_first_last', language: 'en', status: reminderStatus, category: 'UTILITY' },
            {
              name: 'booking_confirm',
              language: 'zh_HK',
              status: 'approved',
              category: 'UTILITY',
            },
          ],
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/inboxes/7/sync_templates') {
      return jsonResponse({ message: 'ok' });
    }

    if (method === 'GET' && path.startsWith('/api/v1/accounts/1/contacts/search?')) {
      return jsonResponse({
        payload: [{
          id: 99,
          phone_number: '+85290000000',
          email: 'synthetic@example.invalid',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85290000000',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({
        payload: [{
          id: 42,
          inbox_id: 7,
          status: 'resolved',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 201,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 201,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      locale: 'en',
      bookingId: 'synthetic-booking-en',
      patientName: 'Synthetic Patient',
      phone: '90000000',
      email: 'synthetic@example.invalid',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '荃灣',
      appointmentDate: '2026-03-29',
      appointmentTime: '13:45',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'en');
    assert.match(sentMessagePayloads[0]?.content, /appointment confirmed/);
    assert.match(sentMessagePayloads[0]?.content, /\/en\/manage-booking/);
    assert.equal(sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter, '/en/manage-booking?token=abc123');

    const reminder = {
      ...booking, phone: '90000000', email: 'synthetic@example.invalid', isLastSessionBooking: true,
    };
    assert.equal((await sendBookingReminderWhatsapp(reminder)).success, true);
    assert.equal(sentMessagePayloads[1]?.template_params?.name, 'booking_reminder_24h');
    assert.doesNotMatch(sentMessagePayloads[1]?.content, /cash|identity card/);

    reminderStatus = 'approved';
    assert.equal((await sendBookingReminderWhatsapp(reminder)).success, true);
    assert.equal(sentMessagePayloads[2]?.template_params?.name, 'booking_reminder_visit_v2_first_last');
    assert.equal(sentMessagePayloads[2]?.template_params?.language, 'en');
    assert.match(sentMessagePayloads[2]?.content, /cash.*\n.*\n.*\n.*last of this session/);
    const enhancedParams = sentMessagePayloads[2]?.template_params?.processed_params;
    assert.deepEqual(Object.keys(enhancedParams), ['body']);
    assert.equal(Object.keys(enhancedParams.body).length, 7);
    assert.match(enhancedParams.body.manage_url, /\/en\/manage-booking/);
  } finally {
    global.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
