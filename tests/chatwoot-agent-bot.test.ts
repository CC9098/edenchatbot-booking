import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHATWOOT_MAIN_MENU_ITEMS,
  CHATWOOT_GENERAL_INQUIRY_PROMPT,
  CHATWOOT_MAIN_MENU_MESSAGE,
  CHATWOOT_MAIN_MENU_PROMPT,
  ChatwootClient,
  buildChatwootRuntimeCopy,
  buildChatwootSystemMessageSet,
  buildChatwootBookingDoctorReply,
  buildDirectBookingReply,
  getFlowState,
  getPreviousVisibleConversationMessage,
  mergeIncomingEventIntoConversationMessages,
  mapConversationMessagesToLegacyChat,
  persistChatwootFlowState,
  resolveBookingMenuSelection,
  resolveClinicMenuSelection,
  resolveGeneralMenuSelection,
  resolveMenuSelection,
  sendChatwootBookingDoctorReply,
  shouldAllowGeneralAiReply,
  shouldDeferToHumanAfterAgentReply,
  shouldSilenceUnmatchedChatwootMessage,
} from '@/lib/chatwoot-agent-bot';
import { DEFAULT_WIDGET_CHATBOT_SETTINGS } from '@/lib/widget-chatbot-settings';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('resolveBookingMenuSelection recognizes booking, reschedule, and cancel actions', () => {
  assert.equal(resolveBookingMenuSelection('立即預約')?.kind, 'new_booking');
  assert.equal(resolveBookingMenuSelection('更期')?.kind, 'reschedule_booking');
  assert.equal(resolveBookingMenuSelection('取消')?.kind, 'cancel_booking');
  assert.equal(resolveBookingMenuSelection('返回主選單')?.kind, 'main');
});

test('main menu uses booking service label and routes manage intents separately', () => {
  assert.equal(CHATWOOT_MAIN_MENU_ITEMS[1]?.title, '預約服務');
  assert.equal(CHATWOOT_MAIN_MENU_MESSAGE.includes('2. 預約服務'), true);
  assert.equal(resolveMenuSelection('menu')?.kind, 'main');
  assert.equal(resolveMenuSelection('主選單')?.kind, 'main');
  assert.equal(resolveMenuSelection('2', { allowNumeric: true })?.kind, 'booking');
  assert.equal(resolveMenuSelection('預約管理')?.kind, 'booking');
  assert.equal(resolveMenuSelection('更期')?.kind, 'reschedule');
  assert.equal(resolveMenuSelection('取消')?.kind, 'cancel');
});

test('unmatched WhatsApp text is silenced instead of reopening bot prompts', () => {
  assert.equal(shouldSilenceUnmatchedChatwootMessage('menu'), true);
  assert.equal(shouldSilenceUnmatchedChatwootMessage('general_menu'), true);
  assert.equal(shouldSilenceUnmatchedChatwootMessage('clinic_menu'), true);
  assert.equal(shouldSilenceUnmatchedChatwootMessage('booking_menu'), true);
  assert.equal(shouldSilenceUnmatchedChatwootMessage('human'), true);
  assert.equal(shouldSilenceUnmatchedChatwootMessage('general_ai'), false);
});

test('human handoff persists the flow state and opens a pending AgentBot conversation', async () => {
  const originalFetch = global.fetch;
  const requests: Array<{ method: string; path: string; body: unknown }> = [];

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    requests.push({
      method: init?.method || 'GET',
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (init?.method === 'GET') {
      return jsonResponse({ id: 1409, status: 'open' });
    }
    return jsonResponse({ success: true });
  }) as typeof global.fetch;

  try {
    await persistChatwootFlowState({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      accountId: 2,
      conversationId: 1409,
      currentStatus: 'pending',
      currentAttributes: { existing: 'kept' },
      nextState: 'human',
      incomingMessageId: 16499,
    });

    assert.deepEqual(requests, [
      {
        method: 'POST',
        path: '/api/v1/accounts/2/conversations/1409/toggle_status',
        body: { status: 'open' },
      },
      {
        method: 'GET',
        path: '/api/v1/accounts/2/conversations/1409',
        body: null,
      },
      {
        method: 'POST',
        path: '/api/v1/accounts/2/conversations/1409/custom_attributes',
        body: {
          custom_attributes: {
            existing: 'kept',
            eden_flow_state: 'human',
            eden_last_incoming_message_id: '16499',
          },
        },
      },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('failed human handoff does not persist the incoming-message dedupe marker', async () => {
  const originalFetch = global.fetch;
  const requestedPaths: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    requestedPaths.push(new URL(typeof input === 'string' ? input : input.toString()).pathname);
    return jsonResponse({ error: 'temporary failure' }, 503);
  }) as typeof global.fetch;

  try {
    await assert.rejects(
      persistChatwootFlowState({
        client: new ChatwootClient('https://chatwoot.example', 'test-token'),
        accountId: 2,
        conversationId: 1409,
        currentStatus: 'pending',
        currentAttributes: {},
        nextState: 'human',
        incomingMessageId: 16500,
      }),
      /503/,
    );

    assert.deepEqual(requestedPaths, [
      '/api/v1/accounts/2/conversations/1409/toggle_status',
      '/api/v1/accounts/2/conversations/1409',
      '/api/v1/accounts/2/conversations/1409/toggle_status',
      '/api/v1/accounts/2/conversations/1409',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('bot-owned pending flow stays pending while its state is persisted', async () => {
  const originalFetch = global.fetch;
  const requestedPaths: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    requestedPaths.push(new URL(typeof input === 'string' ? input : input.toString()).pathname);
    return jsonResponse({ success: true });
  }) as typeof global.fetch;

  try {
    await persistChatwootFlowState({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      accountId: 2,
      conversationId: 1500,
      currentStatus: 'pending',
      currentAttributes: {},
      nextState: 'menu',
      incomingMessageId: 17000,
    });

    assert.deepEqual(requestedPaths, [
      '/api/v1/accounts/2/conversations/1500/custom_attributes',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('human flow already open does not toggle the conversation again', async () => {
  const originalFetch = global.fetch;
  const requestedPaths: string[] = [];

  global.fetch = (async (input: RequestInfo | URL) => {
    requestedPaths.push(new URL(typeof input === 'string' ? input : input.toString()).pathname);
    return jsonResponse({ success: true });
  }) as typeof global.fetch;

  try {
    await persistChatwootFlowState({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      accountId: 2,
      conversationId: 1426,
      currentStatus: 'open',
      currentAttributes: {},
      nextState: 'human',
      incomingMessageId: 16474,
    });

    assert.deepEqual(requestedPaths, [
      '/api/v1/accounts/2/conversations/1426/custom_attributes',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('booking menu copy points users to booking page while legacy booking state still resolves', async () => {
  assert.equal(buildDirectBookingReply().includes('/booking-whatsapp'), true);
  assert.equal(buildDirectBookingReply().includes('更期或取消'), true);
  assert.equal(getFlowState({ eden_flow_state: 'booking' }), 'booking_menu');

  const originalFetch = global.fetch;
  const originalEnv = {
    WIDGET_BOOKING_MANAGE_SECRET: process.env.WIDGET_BOOKING_MANAGE_SECRET,
  };

  process.env.WIDGET_BOOKING_MANAGE_SECRET = 'test-secret';

  global.fetch = (async () => {
    throw new Error('No fetch expected');
  }) as typeof global.fetch;

  try {
    const client = new ChatwootClient('https://chatwoot.example', 'test-token');
    const rescheduleReply = await buildChatwootBookingDoctorReply({
      client,
      accountId: 1,
      contactId: null,
      contactPhone: '+85296322476',
      action: 'reschedule',
    });
    const cancelReply = await buildChatwootBookingDoctorReply({
      client,
      accountId: 1,
      contactId: null,
      contactPhone: '+85296322476',
      action: 'cancel',
    });

    assert.equal(rescheduleReply.includes('更期：https://'), true);
    assert.equal(rescheduleReply.includes('action=reschedule'), true);
    assert.equal(cancelReply.includes('取消：https://'), true);
    assert.equal(cancelReply.includes('action=cancel'), true);
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
      action: 'reschedule',
    });

    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_manage_link');
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter.startsWith('/manage-booking?action=reschedule&token='),
      true,
    );
    assert.equal(
      String(sentMessagePayloads[0]?.content || '').includes('更期'),
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
      action: 'cancel',
    });

    assert.equal(sentMessagePayloads.length > 1, true);
    assert.equal(
      sentMessagePayloads.at(-1)?.template_params,
      undefined,
    );
    assert.equal(
      String(sentMessagePayloads.at(-1)?.content || '').includes('取消：https://'),
      true,
    );
    assert.equal(
      String(sentMessagePayloads.at(-1)?.content || '').includes('action=cancel'),
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

test('shouldAllowGeneralAiReply only when the incoming message directly follows the AI opt-in prompt', () => {
  const armedMessages = [
    {
      id: 101,
      content: CHATWOOT_GENERAL_INQUIRY_PROMPT,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'user',
    },
    {
      id: 102,
      content: '我想問針灸會唔會好痛',
      created_at: 200,
      message_type: 'incoming',
      sender_type: 'contact',
    },
  ];

  const staleMessages = [
    {
      id: 201,
      content: CHATWOOT_GENERAL_INQUIRY_PROMPT,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'user',
    },
    {
      id: 202,
      content: '我幫你跟進，請稍等。',
      created_at: 150,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 203,
      content: '好呀',
      created_at: 200,
      message_type: 'incoming',
      sender_type: 'contact',
    },
  ];

  assert.equal(shouldAllowGeneralAiReply(armedMessages, 102), true);
  assert.equal(shouldAllowGeneralAiReply(staleMessages, 203), false);
});

test('getPreviousVisibleConversationMessage falls back to the latest visible message when Chatwoot has not yet returned the incoming row', () => {
  const messages = [
    {
      id: 301,
      content: CHATWOOT_GENERAL_INQUIRY_PROMPT,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'user',
    },
  ];

  assert.equal(
    getPreviousVisibleConversationMessage(messages, 999)?.content,
    CHATWOOT_GENERAL_INQUIRY_PROMPT,
  );
});

test('mergeIncomingEventIntoConversationMessages adds the webhook row when Chatwoot history is stale', () => {
  const staleMessages = [
    {
      id: 10,
      content: CHATWOOT_GENERAL_INQUIRY_PROMPT,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
  ];

  const mergedMessages = mergeIncomingEventIntoConversationMessages(staleMessages, {
    accountId: 1,
    conversationId: 42,
    messageId: 999,
    content: '我想問診金',
    contactId: 7,
    contactPhone: '+85261234567',
  });

  assert.equal(mergedMessages.length, 2);
  assert.equal(mergedMessages.at(-1)?.id, 999);
  assert.equal(mergedMessages.at(-1)?.sender_type, 'contact');
  assert.equal(
    getPreviousVisibleConversationMessage(mergedMessages, 999)?.content,
    CHATWOOT_GENERAL_INQUIRY_PROMPT,
  );
  assert.deepEqual(
    mapConversationMessagesToLegacyChat(mergedMessages, new Set()),
    [
      { role: 'assistant', content: CHATWOOT_GENERAL_INQUIRY_PROMPT },
      { role: 'user', content: '我想問診金' },
    ],
  );
});

test('shouldDeferToHumanAfterAgentReply suppresses menu replies after a visible staff message', () => {
  const messages = [
    {
      id: 501,
      content: CHATWOOT_MAIN_MENU_MESSAGE,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 502,
      content: '我幫你跟進，請稍等。',
      created_at: 200,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 503,
      content: '好呀，唔該',
      created_at: 300,
      message_type: 'incoming',
      sender_type: 'contact',
    },
  ];

  assert.equal(shouldDeferToHumanAfterAgentReply(messages, 503), true);
});

test('shouldDeferToHumanAfterAgentReply keeps menu prompts active', () => {
  const messages = [
    {
      id: 601,
      content: CHATWOOT_MAIN_MENU_PROMPT,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 602,
      content: '想問價錢',
      created_at: 200,
      message_type: 'incoming',
      sender_type: 'contact',
    },
  ];

  assert.equal(shouldDeferToHumanAfterAgentReply(messages, 602), false);
});

test('chatwoot runtime copy follows customized widget labels for menu resolution', () => {
  const customSettings = {
    ...DEFAULT_WIDGET_CHATBOT_SETTINGS,
    menu: {
      items: DEFAULT_WIDGET_CHATBOT_SETTINGS.menu.items.map((item) => {
        if (item.id === 'fees') return { ...item, label: '價目表' };
        if (item.id === 'clinic') return { ...item, label: '診所資料' };
        if (item.id === 'timetable') return { ...item, label: '出診時間' };
        if (item.id === 'other') return { ...item, label: '自由提問' };
        return item;
      }),
    },
    flows: {
      ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows,
      clinic: {
        ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic,
        hoursButtonLabel: '開診時間',
        addressesButtonLabel: '位置地圖',
        backButtonLabel: '回主選單',
      },
      common: {
        ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common,
        returnMainButtonLabel: '回到主頁',
      },
    },
  };

  const runtimeCopy = buildChatwootRuntimeCopy(customSettings);

  assert.equal(resolveGeneralMenuSelection('價目表', {
    labels: {
      fees: runtimeCopy.generalMenuItems[0]?.title,
      clinic: runtimeCopy.generalMenuItems[1]?.title,
      timetable: runtimeCopy.generalMenuItems[2]?.title,
      other: runtimeCopy.generalMenuItems[3]?.title,
      main: runtimeCopy.generalMenuItems[4]?.title,
    },
  })?.kind, 'fees');
  assert.equal(resolveGeneralMenuSelection('自由提問', {
    labels: {
      fees: runtimeCopy.generalMenuItems[0]?.title,
      clinic: runtimeCopy.generalMenuItems[1]?.title,
      timetable: runtimeCopy.generalMenuItems[2]?.title,
      other: runtimeCopy.generalMenuItems[3]?.title,
      main: runtimeCopy.generalMenuItems[4]?.title,
    },
  })?.kind, 'other');
  assert.equal(resolveClinicMenuSelection('開診時間', {
    labels: {
      hours: runtimeCopy.clinicMenuItems[0]?.title,
      addresses: runtimeCopy.clinicMenuItems[1]?.title,
      main: runtimeCopy.clinicMenuItems[2]?.title,
    },
  })?.kind, 'hours');
  assert.equal(resolveClinicMenuSelection('回主選單', {
    labels: {
      hours: runtimeCopy.clinicMenuItems[0]?.title,
      addresses: runtimeCopy.clinicMenuItems[1]?.title,
      main: runtimeCopy.clinicMenuItems[2]?.title,
    },
  })?.kind, 'main');
});

test('chatwoot runtime system messages are excluded from AI history after widget copy changes', () => {
  const customSettings = {
    ...DEFAULT_WIDGET_CHATBOT_SETTINGS,
    menu: {
      items: DEFAULT_WIDGET_CHATBOT_SETTINGS.menu.items.map((item) => {
        if (item.id === 'other') return { ...item, label: '自由提問' };
        return item;
      }),
    },
    flows: {
      ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows,
      fees: {
        ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.fees,
        reply: '最新收費版本',
      },
      clinic: {
        ...DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic,
        prompt: '你想查診所邊方面？',
      },
      timetable: {
        reply: '最新時間表版本',
      },
    },
  };
  const runtimeCopy = buildChatwootRuntimeCopy(customSettings);
  const systemMessages = buildChatwootSystemMessageSet(runtimeCopy);

  const messages = [
    {
      id: 401,
      content: runtimeCopy.generalMenuMessage,
      created_at: 100,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 402,
      content: '我想知針灸痛唔痛',
      created_at: 200,
      message_type: 'incoming',
      sender_type: 'contact',
    },
    {
      id: 403,
      content: runtimeCopy.feesMessage,
      created_at: 300,
      message_type: 'outgoing',
      sender_type: 'agent',
    },
    {
      id: 404,
      content: '另外想問有冇夜診',
      created_at: 400,
      message_type: 'incoming',
      sender_type: 'contact',
    },
  ];

  assert.deepEqual(
    mapConversationMessagesToLegacyChat(messages, systemMessages),
    [
      { role: 'user', content: '我想知針灸痛唔痛' },
      { role: 'user', content: '另外想問有冇夜診' },
    ],
  );
});
