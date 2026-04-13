import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHATWOOT_MAIN_MENU_ITEMS,
  CHATWOOT_MAIN_MENU_MESSAGE,
  ChatwootClient,
  buildDirectBookingReply,
  getFlowState,
  resolveBookingMenuSelection,
  resolveMenuSelection,
  sendChatwootBookingDoctorReply,
} from '@/lib/chatwoot-agent-bot';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('resolveBookingMenuSelection recognizes new booking and manage booking actions', () => {
  assert.equal(resolveBookingMenuSelection('立即預約')?.kind, 'new_booking');
  assert.equal(resolveBookingMenuSelection('管理預約')?.kind, 'manage_booking');
  assert.equal(resolveBookingMenuSelection('返回主選單')?.kind, 'main');
});

test('main menu uses booking service label and routes manage intents separately', () => {
  assert.equal(CHATWOOT_MAIN_MENU_ITEMS[1]?.title, '預約服務');
  assert.equal(CHATWOOT_MAIN_MENU_MESSAGE.includes('2. 預約服務'), true);
  assert.equal(resolveMenuSelection('2', { allowNumeric: true })?.kind, 'booking');
  assert.equal(resolveMenuSelection('預約管理')?.kind, 'manage');
});

test('booking menu copy points users to booking page while legacy booking state still resolves', () => {
  assert.equal(buildDirectBookingReply().includes('/booking-whatsapp'), true);
  assert.equal(buildDirectBookingReply().includes('管理預約'), true);
  assert.equal(getFlowState({ eden_flow_state: 'booking' }), 'booking_menu');
});

test('sendChatwootBookingDoctorReply prefers manage-link templates in the current conversation', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY,
    WIDGET_BOOKING_MANAGE_SECRET: process.env.WIDGET_BOOKING_MANAGE_SECRET,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME = 'booking_manage_link';
  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY = 'UTILITY';
  process.env.WIDGET_BOOKING_MANAGE_SECRET = 'test-secret';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(requestUrl);
    const method = init?.method || 'GET';
    const path = `${parsedUrl.pathname}${parsedUrl.search}`;

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);
      return jsonResponse({
        id: 501,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 501,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const client = new ChatwootClient('https://chatwoot.example', 'test-token');

    await sendChatwootBookingDoctorReply({
      client,
      accountId: 1,
      conversationId: 42,
      contactId: null,
      contactPhone: '+85296322476',
    });

    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_manage_link');
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter.startsWith('/manage-booking?token='),
      true,
    );
    assert.equal(
      String(sentMessagePayloads[0]?.content || '').includes('如果你想直接搵姑娘跟進'),
      true,
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

test('sendChatwootBookingDoctorReply falls back to plain text when manage-link templates fail', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY,
    WIDGET_BOOKING_MANAGE_SECRET: process.env.WIDGET_BOOKING_MANAGE_SECRET,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME = 'booking_manage_link';
  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY = 'UTILITY';
  process.env.WIDGET_BOOKING_MANAGE_SECRET = 'test-secret';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const parsedUrl = new URL(requestUrl);
    const method = init?.method || 'GET';
    const path = `${parsedUrl.pathname}${parsedUrl.search}`;

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      if (payload.template_params) {
        throw new Error('template not found');
      }

      return jsonResponse({
        id: 701,
        status: 'sent',
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const client = new ChatwootClient('https://chatwoot.example', 'test-token');

    await sendChatwootBookingDoctorReply({
      client,
      accountId: 1,
      conversationId: 42,
      contactId: null,
      contactPhone: '+85296322476',
    });

    assert.equal(sentMessagePayloads.length > 1, true);
    assert.equal(
      sentMessagePayloads.at(-1)?.template_params,
      undefined,
    );
    assert.equal(
      String(sentMessagePayloads.at(-1)?.content || '').includes('管理預約：https://'),
      true,
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
