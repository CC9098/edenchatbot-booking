import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendBookingCancellationWhatsapp,
  sendBookingConfirmationWhatsapp,
} from '@/lib/chatwoot-whatsapp';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('sendBookingConfirmationWhatsapp retries when Chatwoot later marks a template message as failed', async () => {
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
  const deletedMessagePaths: string[] = [];
  let messageListCalls = 0;

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE = 'zh_HK';
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
          message_templates: [{
            name: 'booking_confirm',
            language: 'zh_HK',
            status: 'approved',
            category: 'UTILITY',
          }],
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
          phone_number: '+85296563420',
          email: 'edenethel333@gmail.com',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296563420',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({
        id: 42,
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: sentMessagePayloads.length === 1 ? 101 : 102,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      messageListCalls += 1;

      if (messageListCalls === 1) {
        return jsonResponse({
          payload: [{
            id: 101,
            status: 'failed',
          }],
        });
      }

      return jsonResponse({
        payload: [{
          id: 102,
          status: 'delivered',
        }],
      });
    }

    if (method === 'DELETE' && path === '/api/v1/accounts/1/conversations/42/messages/101') {
      deletedMessagePaths.push(path);
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'j3r4mkhvunba0g4nsgnes4lu8k',
      patientName: 'e testing',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '佐敦',
      appointmentDate: '2026-03-30',
      appointmentTime: '13:45',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 2);
    assert.equal(deletedMessagePaths.length, 1);

    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      'abc123',
    );
    assert.equal(
      sentMessagePayloads[1]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/manage-booking?token=abc123',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.manage_url,
      undefined,
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.name,
      'booking_confirm',
    );
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

test('sendBookingConfirmationWhatsapp prefers templates even when a Chatwoot conversation is already open', async () => {
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

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE = 'zh_HK';
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
          message_templates: [{
            name: 'booking_confirm',
            language: 'zh_HK',
            status: 'approved',
            category: 'UTILITY',
          }],
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
          phone_number: '+85296563420',
          email: 'edenethel333@gmail.com',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296563420',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({
        payload: [{
          id: 42,
          inbox_id: 7,
          status: 'open',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 301,
        status: 'sent',
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-active-conversation',
      patientName: 'Tin CHUNG WAI',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '荃灣',
      appointmentDate: '2026-03-29',
      appointmentTime: '13:45',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_confirm');
    assert.equal(typeof sentMessagePayloads[0]?.content, 'string');
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

test('sendBookingConfirmationWhatsapp prefers zh_HK templates when no explicit language is configured', async () => {
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
          phone_number: '+85296563420',
          email: 'edenethel333@gmail.com',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296563420',
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
      bookingId: 'booking-zh-hk',
      patientName: 'e testing',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '荃灣',
      appointmentDate: '2026-03-29',
      appointmentTime: '13:45',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
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

test('sendBookingCancellationWhatsapp falls back to appointment_cancel when booking_cancelled is unavailable', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  delete process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_NAME;
  delete process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_LANGUAGE;
  delete process.env.CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_CATEGORY;

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
          message_templates: [{
            name: 'appointment_cancel',
            language: 'zh_HK',
            status: 'approved',
            category: 'UTILITY',
          }],
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
          phone_number: '+85296563420',
          email: 'edenethel333@gmail.com',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296563420',
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
        id: 401,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 401,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingCancellationWhatsapp({
      bookingId: 'booking-cancel-fallback',
      patientName: 'e testing',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '佐敦',
      appointmentDate: '2026-04-01',
      appointmentTime: '13:45',
      clinicWhatsappPhone: '+85267333801',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'appointment_cancel');
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
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
