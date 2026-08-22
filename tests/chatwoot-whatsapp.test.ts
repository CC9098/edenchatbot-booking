import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sendBookingCancellationWhatsapp,
  sendBookingConfirmationWhatsapp,
  sendBookingRescheduleWhatsapp,
  sendDoctorOnlineConsultNoShowReminderWhatsapp,
  sendDoctorOnlineConsultReadyWhatsapp,
  sendPatientOnlineConsultWaitingWhatsapp,
  sendStaffPatientWhatsappMessage,
} from '@/lib/chatwoot-whatsapp';
import { buildStaffPatientTemplateBodyParams } from '@/lib/staff-patient-messages';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

test('buildStaffPatientTemplateBodyParams maps staff follow-up template to one staff note variable', () => {
  const params = buildStaffPatientTemplateBodyParams({
    patientName: '燕子',
    clinicNameZh: '荃灣',
    purpose: 'follow_up',
    note: '你要的收據已準備好，可以到診所領取。',
  });

  assert.deepEqual(params, {
    '1': '你要的收據已準備好，可以到診所領取。',
  });
});

test('buildStaffPatientTemplateBodyParams sends a neutral default follow-up note when optional note is blank', () => {
  const params = buildStaffPatientTemplateBodyParams({
    patientName: '燕子',
    clinicNameZh: '荃灣',
    purpose: 'follow_up',
    note: '',
  });

  assert.deepEqual(params, {
    '1': '診所有事項需要跟進。',
  });
});

test('buildStaffPatientTemplateBodyParams maps payment notice fields to online payment template variables', () => {
  const params = buildStaffPatientTemplateBodyParams({
    patientName: '高思穎',
    clinicNameZh: '荃灣',
    purpose: 'payment_notice',
    medicineDays: '7',
    consultationFee: '380',
    treatmentFee: '680',
    extraFee: '藥費',
    totalAmount: '1060',
  });

  assert.deepEqual(params, {
    '1': '高思穎',
    '2': '7',
    '3': '380',
    '4': '680',
    '5': '藥費',
    '6': '1060',
  });
});

test('sendStaffPatientWhatsappMessage sends an approved intake template with a URL button', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_NAME = 'staff_patient_intake_link';
  process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_INTAKE_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'staff_patient_intake_link',
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 101,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 101,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '陳小明',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'intake_link',
      linkUrl: 'https://edenclinic.hk/intake?case=abc',
      note: '請先填資料。',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'staff_patient_intake_link');
    assert.equal(sentMessagePayloads[0]?.template_params?.processed_params?.body?.patient_name, '陳小明');
    assert.equal(sentMessagePayloads[0]?.template_params?.processed_params?.body?.clinic_name, '佐敦');
    assert.equal(sentMessagePayloads[0]?.template_params?.processed_params?.body?.staff_note, '請先填資料。');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/intake?case=abc',
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

test('sendStaffPatientWhatsappMessage sends payment notices with the online payment template', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_NAME = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_LANGUAGE = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_PAYMENT_TEMPLATE_CATEGORY = '';

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
            name: 'online_payment',
            language: 'zh_HK',
            status: 'approved',
            category: 'MARKETING',
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 101,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 101,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '高思穎',
      phone: '91234567',
      clinicNameZh: '荃灣',
      purpose: 'payment_notice',
      medicineDays: '7',
      consultationFee: '380',
      treatmentFee: '680',
      extraFee: '藥費',
      totalAmount: '1060',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'online_payment');
    assert.equal(sentMessagePayloads[0]?.template_params?.category, 'MARKETING');
    assert.deepEqual(sentMessagePayloads[0]?.template_params?.processed_params?.body, {
      '1': '高思穎',
      '2': '7',
      '3': '380',
      '4': '680',
      '5': '藥費',
      '6': '1060',
    });
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

test('sendStaffPatientWhatsappMessage records campaign context on the same Chatwoot conversation', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];
  const labelPayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'staff_patient_follow_up',
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: payload.private ? 102 : 101,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 101,
          status: 'delivered',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/labels') {
      const payload = JSON.parse(String(init?.body || '{}'));
      labelPayloads.push(payload);
      return jsonResponse({ payload: payload.labels });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '陳小明',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: '如想報名請回覆此訊息。',
      campaignContext: {
        title: '2026夏季天灸',
        label: '2026夏季天灸',
        sentAt: '2026-06-08 11:23',
        source: 'Eden 群發',
        messagePreview: '🔥 【2026 三伏天灸】限時早鳥報名開始',
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.some((payload) => payload.template_params?.name === 'staff_patient_follow_up'), true);
    const privateNote = sentMessagePayloads.find((payload) => payload.private === true);
    assert.equal(typeof privateNote?.content, 'string');
    assert.match(privateNote?.content, /2026夏季天灸/);
    assert.match(privateNote?.content, /病人如回覆「報名」/);
    assert.deepEqual(labelPayloads, [{ labels: ['2026夏季天灸'] }]);
    const publicTemplateMessage = sentMessagePayloads.find((payload) => payload.template_params);
    assert.deepEqual(publicTemplateMessage?.template_params?.processed_params?.body, {
      '1': '如想報名請回覆此訊息。',
    });
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

test('sendStaffPatientWhatsappMessage uses staff_patient_follow_up as the one-variable follow-up template', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'staff_patient_follow_up',
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 101,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 101,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '陳小明',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: '你要的收據已準備好，可以到診所領取。',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'staff_patient_follow_up');
    assert.deepEqual(sentMessagePayloads[0]?.template_params?.processed_params?.body, {
      '1': '你要的收據已準備好，可以到診所領取。',
    });
    assert.deepEqual(Object.keys(sentMessagePayloads[0]?.template_params?.processed_params?.body || {}), ['1']);
    assert.equal('patient_name' in sentMessagePayloads[0]?.template_params?.processed_params?.body, false);
    assert.equal('clinic_name' in sentMessagePayloads[0]?.template_params?.processed_params?.body, false);
    assert.equal('staff_note' in sentMessagePayloads[0]?.template_params?.processed_params?.body, false);
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

test('sendStaffPatientWhatsappMessage creates a missing Chatwoot contact before sending template', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const createdContacts: Array<Record<string, any>> = [];
  const createdContactInboxes: Array<Record<string, any>> = [];
  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME = 'staff_patient_follow_up';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'staff_patient_follow_up',
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
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/contacts') {
      const payload = JSON.parse(String(init?.body || '{}'));
      createdContacts.push(payload);

      return jsonResponse({
        payload: {
          contact: {
            id: 123,
            phone_number: '+85291234567',
            email: '',
            contact_inboxes: [],
          },
        },
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/123/contactable_inboxes') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/contacts/123/contact_inboxes') {
      const payload = JSON.parse(String(init?.body || '{}'));
      createdContactInboxes.push(payload);
      return jsonResponse({
        source_id: '85291234567',
        inbox: { id: 7 },
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/123/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      return jsonResponse({
        id: 601,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 601,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '陳小明',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: '姑娘想確認你的預約資料。',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(createdContacts.length, 1);
    assert.equal(createdContacts[0]?.phone_number, '+85291234567');
    assert.deepEqual(createdContactInboxes[0], {
      inbox_id: 7,
      source_id: '85291234567',
    });
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'staff_patient_follow_up');
    assert.deepEqual(sentMessagePayloads[0]?.template_params?.processed_params?.body, {
      '1': '姑娘想確認你的預約資料。',
    });
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

test('sendStaffPatientWhatsappMessage falls back to text when Chatwoot confirms the conversation can reply', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME = 'staff_patient_follow_up';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY = 'UTILITY';

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
          message_templates: [],
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
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
          can_reply: true,
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      if (payload.template_params) {
        throw new Error('template not found');
      }

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
    const result = await sendStaffPatientWhatsappMessage({
      patientName: '陳小明',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: '姑娘想確認你的預約資料。',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(result.deliveryStatus, 'delivered');
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads.at(-1)?.template_params, undefined);
    const textContent = String(sentMessagePayloads.at(-1)?.content || '');
    assert.match(textContent, /以下是診所給你的跟進訊息：/);
    assert.match(textContent, /姑娘想確認你的預約資料。/);
    assert.doesNotMatch(textContent, /你好 陳小明/);
    assert.doesNotMatch(textContent, /診所：佐敦/);
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

test('sendStaffPatientWhatsappMessage blocks proactive staff text when no approved template exists', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  delete process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME;
  delete process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE;
  delete process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY;

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
          message_templates: [],
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/conversations') {
      return jsonResponse({ payload: [] });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

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
    const result = await sendStaffPatientWhatsappMessage({
      patientName: 'CHUNG WAI',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: 'TESTTTt',
    });

    assert.equal(result.success, false);
    assert.equal(result.whatsappSent, false);
    assert.match(result.error || '', /No approved WhatsApp template/);
    assert.equal(sentMessagePayloads.length, 0);
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

test('sendStaffPatientWhatsappMessage does not fall back to text when Chatwoot says can_reply is false', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];
  const deletedMessagePaths: string[] = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME = 'staff_patient_follow_up';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'staff_patient_follow_up',
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
          phone_number: '+85291234567',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85291234567',
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
          can_reply: false,
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations') {
      return jsonResponse({ id: 42 });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/42/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);

      if (payload.template_params) {
        return jsonResponse({
          id: 301,
          status: 'sent',
        });
      }

      return jsonResponse({
        id: 401,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 301,
          status: 'failed',
          content_attributes: {
            external_error: '131049: This message was not delivered to maintain healthy ecosystem engagement.',
          },
        }],
      });
    }

    if (method === 'DELETE' && path === '/api/v1/accounts/1/conversations/42/messages/301') {
      deletedMessagePaths.push(path);
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendStaffPatientWhatsappMessage({
      patientName: 'CHUNG WAI',
      phone: '91234567',
      clinicNameZh: '佐敦',
      purpose: 'follow_up',
      note: 'TESTTTt',
    });

    assert.equal(result.success, false);
    assert.equal(result.whatsappSent, false);
    assert.match(result.error || '', /WhatsApp template delivery failed for staff_patient_follow_up/);
    assert.match(result.error || '', /131049/);
    assert.doesNotMatch(result.error || '', /with params/);
    assert.equal(sentMessagePayloads.some((payload) => payload.template_params?.name === 'staff_patient_follow_up'), true);
    assert.equal(sentMessagePayloads.some((payload) => !payload.template_params), false);
    assert.equal(deletedMessagePaths.length > 0, true);
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
      '/manage-booking?token=abc123',
    );
    assert.equal(
      sentMessagePayloads[1]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      'abc123',
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

test('sendBookingConfirmationWhatsapp prefers the configured template name over synced legacy fallback templates', async () => {
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
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm_u';
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
          message_templates: [
            {
              name: 'booking_confirm',
              language: 'zh_HK',
              status: 'approved',
              category: 'UTILITY',
            },
            {
              name: 'booking_confirm_u',
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
        id: 211,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 211,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-template-cutover',
      patientName: 'e testing',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '中環',
      appointmentDate: '2026-04-02',
      appointmentTime: '15:30',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_confirm_u');
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

test('sendBookingConfirmationWhatsapp prefers manage-booking path parameters for WhatsApp URL buttons', async () => {
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
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm_u';
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
            name: 'booking_confirm_u',
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
          phone_number: '+85296322476',
          email: 'chetleung@gmail.com',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296322476',
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
        id: 611,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 611,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-manage-link-fix',
      patientName: '梁 仲威',
      phone: '96322476',
      email: 'chetleung@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '中環',
      appointmentDate: '2026-04-09',
      appointmentTime: '16:15',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/manage-booking?token=abc123',
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

test('sendBookingConfirmationWhatsapp falls back to body-only templates when the manage URL button was removed', async () => {
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
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm_u';
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
            name: 'booking_confirm_u',
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

      const processedParams = payload.template_params?.processed_params;
      const body = processedParams?.body;
      const isBodyOnlyTemplateShape = body
        && processedParams?.buttons === undefined
        && body.manage_url === undefined
        && body.patient_name === 'e testing';

      if (!isBodyOnlyTemplateShape) {
        return new Response('template shape mismatch', {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      return jsonResponse({
        id: 612,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 612,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-confirm-u-body-only',
      patientName: 'e testing',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '中環',
      appointmentDate: '2026-04-02',
      appointmentTime: '15:30',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.at(-1)?.template_params?.name, 'booking_confirm_u');
    assert.equal(sentMessagePayloads.at(-1)?.template_params?.processed_params?.buttons, undefined);
    assert.equal(
      sentMessagePayloads.at(-1)?.template_params?.processed_params?.body?.manage_url,
      undefined,
    );
    assert.equal(
      sentMessagePayloads.at(-1)?.template_params?.processed_params?.body?.booking_id,
      'booking-confirm-u-body-only',
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

test('sendBookingConfirmationWhatsapp falls back to active conversation text when template send fails', async () => {
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

      if (payload.template_params) {
        return new Response('template not found', {
          status: 404,
          statusText: 'Not Found',
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      return jsonResponse({
        id: 302,
        status: 'sent',
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-template-failure-fallback',
      patientName: 'Tin CHUNG WAI',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '中環',
      appointmentDate: '2026-04-02',
      appointmentTime: '15:30',
      visitType: 'followup',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.some((payload) => payload.template_params?.name === 'booking_confirm'), true);
    assert.equal(sentMessagePayloads.at(-1)?.template_params, undefined);
    assert.equal(typeof sentMessagePayloads.at(-1)?.content, 'string');
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

test('sendBookingConfirmationWhatsapp uses online template for active conversations so manage link can stay as a button', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME = 'booking_confirm_online';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'booking_confirm_online',
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
          phone_number: '+85296322476',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296322476',
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
      return jsonResponse({ id: 701, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 701,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-online-active',
      patientName: 'Codex測試',
      phone: '85296322476',
      email: '',
      doctorNameZh: '張天慧醫師',
      clinicNameZh: '網上',
      appointmentDate: '2026-05-13',
      appointmentTime: '21:50',
      visitType: 'followup',
      meetLink: 'https://meet.google.com/uud-rdxb-crk',
      onlineConsultUrl: 'https://edenchatbot-booking.vercel.app/online-consult?token=online123',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_confirm_online');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.meet_link,
      undefined,
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/online-consult?token=online123',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[1]?.parameter,
      '/manage-booking?token=abc123',
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

test('sendBookingConfirmationWhatsapp uses online templates when no active conversation exists', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME = 'booking_confirm_online';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'booking_confirm_online',
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
          phone_number: '+85296322476',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296322476',
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
      return jsonResponse({ id: 801, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 801,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-online-template',
      patientName: 'Codex測試',
      phone: '85296322476',
      email: '',
      doctorNameZh: '張天慧醫師',
      clinicNameZh: '網上',
      appointmentDate: '2026-05-13',
      appointmentTime: '21:50',
      visitType: 'followup',
      meetLink: 'https://meet.google.com/uud-rdxb-crk',
      onlineConsultUrl: 'https://edenchatbot-booking.vercel.app/online-consult?token=online123',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_confirm_online');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.meet_link,
      undefined,
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/online-consult?token=online123',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[1]?.parameter,
      '/manage-booking?token=abc123',
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

test('sendBookingConfirmationWhatsapp uses online fallback template when Meet link exists and online env name is unset', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME = 'booking_confirm';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY = 'UTILITY';
  delete process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_NAME;
  delete process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_LANGUAGE;
  delete process.env.CHATWOOT_WHATSAPP_ONLINE_TEMPLATE_CATEGORY;

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
              language: 'zh_HK',
              status: 'approved',
              category: 'UTILITY',
            },
            {
              name: 'booking_confirm_online',
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
          phone_number: '+85296322476',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/99/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296322476',
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
      return jsonResponse({ id: 901, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 901,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingConfirmationWhatsapp({
      bookingId: 'booking-online-fallback',
      patientName: 'Codex測試',
      phone: '85296322476',
      email: '',
      doctorNameZh: '張天慧醫師',
      clinicNameZh: '網上',
      appointmentDate: '2026-05-13',
      appointmentTime: '21:50',
      visitType: 'followup',
      meetLink: 'https://meet.google.com/uud-rdxb-crk',
      onlineConsultUrl: 'https://edenchatbot-booking.vercel.app/online-consult?token=online123',
      manageAccessToken: 'abc123',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 42);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'booking_confirm_online');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.meet_link,
      undefined,
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/online-consult?token=online123',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[1]?.parameter,
      '/manage-booking?token=abc123',
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
      manageAccessToken: 'cancel-abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'appointment_cancel');
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/manage-booking?token=cancel-abc123',
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

test('sendBookingRescheduleWhatsapp uses tokenized manage-booking path for WhatsApp URL buttons', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_NAME = 'appointment_rescheduled';
  process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'appointment_rescheduled',
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
        id: 811,
        status: 'sent',
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/42/messages') {
      return jsonResponse({
        payload: [{
          id: 811,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendBookingRescheduleWhatsapp({
      bookingId: 'booking-reschedule-link',
      patientName: '梁 仲威',
      phone: '96563420',
      email: 'edenethel333@gmail.com',
      doctorNameZh: '梁仲威醫師',
      clinicNameZh: '荃灣',
      oldDate: '2026-04-09',
      oldTime: '17:00',
      newDate: '2026-04-12',
      newTime: '13:15',
      clinicWhatsappPhone: '+85267333801',
      manageAccessToken: 'res-abc123',
    });

    assert.equal(result.success, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'appointment_rescheduled');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.buttons?.[0]?.parameter,
      '/manage-booking?token=res-abc123',
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

test('sendDoctorOnlineConsultReadyWhatsapp sends the doctor ready notification to WhatsApp', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME = 'doctor_online_consult_ready';
  process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'doctor_online_consult_ready',
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
      const query = parsedUrl.searchParams.get('q') || '';
      assert.match(query, /60260716|85260260716|\+85260260716/);
      return jsonResponse({
        payload: [{
          id: 602,
          phone_number: '+85260260716',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85260260716',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/conversations') {
      return jsonResponse({
        payload: [{
          id: 6020,
          inbox_id: 7,
          status: 'open',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);
      return jsonResponse({ id: 920, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      return jsonResponse({
        payload: [{
          id: 920,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendDoctorOnlineConsultReadyWhatsapp({
      bookingId: '7rqc6fcjkjhsikq5basiae3g6o',
      calendarId: 'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
      doctorId: 'cheung',
      doctorName: 'Dr. Cheung',
      doctorNameZh: '張天慧醫師',
      doctorWhatsappPhone: '+85260260716',
      patientName: '小明',
      patientPhone: '96322476',
      patientEmail: '',
      date: '2026-05-13',
      time: '21:30',
      durationMinutes: 20,
      meetLink: 'https://meet.google.com/rkk-jrzp-pqh',
      notifiedAtIso: '2026-05-11T15:32:00.000Z',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 6020);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'doctor_online_consult_ready');
    assert.deepEqual(sentMessagePayloads[0]?.template_params?.processed_params?.body, {
      '1': '張天慧醫師',
      '2': '小明',
      '3': '96322476',
      '4': '2026-05-13 21:30',
      '5': '20 分鐘',
      '6': '11/5/2026 下午11:32:00',
      '7': '7rqc6fcjkjhsikq5basiae3g6o',
      '8': 'https://meet.google.com/rkk-jrzp-pqh',
    });
    assert.match(sentMessagePayloads[0]?.content, /病人已打開網上診症入口/);
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

test('sendDoctorOnlineConsultReadyWhatsapp falls back to text when the doctor template delivery fails', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];
  const deletedMessageIds: number[] = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE = 'en';
  process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME = 'doctor_online_consult_ready';
  delete process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_LANGUAGE;
  process.env.CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'doctor_online_consult_ready',
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
      const query = parsedUrl.searchParams.get('q') || '';
      assert.match(query, /60260716|85260260716|\+85260260716/);
      return jsonResponse({
        payload: [{
          id: 602,
          phone_number: '+85260260716',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85260260716',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/conversations') {
      return jsonResponse({
        payload: [{
          id: 6020,
          inbox_id: 7,
          status: 'resolved',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);
      return jsonResponse({ id: 930 + sentMessagePayloads.length, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      return jsonResponse({
        payload: sentMessagePayloads.map((payload, index) => ({
          id: 931 + index,
          status: payload.template_params ? 'failed' : 'delivered',
        })),
      });
    }

    const deleteMatch = path.match(/^\/api\/v1\/accounts\/1\/conversations\/6020\/messages\/(\d+)$/);
    if (method === 'DELETE' && deleteMatch) {
      deletedMessageIds.push(Number(deleteMatch[1]));
      return jsonResponse({ id: Number(deleteMatch[1]) });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendDoctorOnlineConsultReadyWhatsapp({
      bookingId: 'd8v07eca4j8v2e4g8r0kmo17c4',
      calendarId: 'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
      doctorId: 'cheung',
      doctorName: 'Dr. Cheung',
      doctorNameZh: '張天慧醫師',
      doctorWhatsappPhone: '+85260260716',
      patientName: '小明明',
      patientPhone: '96322476',
      patientEmail: '',
      date: '2026-05-20',
      time: '21:30',
      durationMinutes: 20,
      meetLink: 'https://meet.google.com/krn-dbfi-bfh',
      notifiedAtIso: '2026-05-13T16:22:38.000Z',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 6020);
    assert.equal(sentMessagePayloads.length, 2);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'doctor_online_consult_ready');
    assert.equal(sentMessagePayloads[0]?.template_params?.language, 'zh_HK');
    assert.deepEqual(sentMessagePayloads[0]?.template_params?.processed_params?.body, {
      '1': '張天慧醫師',
      '2': '小明明',
      '3': '96322476',
      '4': '2026-05-20 21:30',
      '5': '20 分鐘',
      '6': '14/5/2026 上午12:22:38',
      '7': 'd8v07eca4j8v2e4g8r0kmo17c4',
      '8': 'https://meet.google.com/krn-dbfi-bfh',
    });
    assert.equal(sentMessagePayloads[1]?.template_params, undefined);
    assert.match(sentMessagePayloads[1]?.content, /病人已打開網上診症入口/);
    assert.match(sentMessagePayloads[1]?.content, /小明明/);
    assert.deepEqual(deletedMessageIds, [931]);
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

test('sendDoctorOnlineConsultNoShowReminderWhatsapp sends a text notice without a new template', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';

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
          message_templates: [],
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/inboxes/7/sync_templates') {
      return jsonResponse({ message: 'ok' });
    }

    if (method === 'GET' && path.startsWith('/api/v1/accounts/1/contacts/search?')) {
      const query = parsedUrl.searchParams.get('q') || '';
      assert.match(query, /60260716|85260260716|\+85260260716/);
      return jsonResponse({
        payload: [{
          id: 602,
          phone_number: '+85260260716',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85260260716',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/602/conversations') {
      return jsonResponse({
        payload: [{
          id: 6020,
          inbox_id: 7,
          status: 'resolved',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);
      return jsonResponse({ id: 940, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/6020/messages') {
      return jsonResponse({
        payload: [{
          id: 940,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendDoctorOnlineConsultNoShowReminderWhatsapp({
      bookingId: 'event-1',
      calendarId: 'calendar-1',
      doctorId: 'cheung',
      doctorName: 'Dr. Cheung',
      doctorNameZh: '張天慧醫師',
      doctorWhatsappPhone: '+85260260716',
      patientName: '陳惠萍',
      patientPhone: '97502595',
      date: '2026-05-21',
      time: '15:00',
      onlineConsultUrl: 'https://eden.example/online-consult?token=abc',
      patientConversationId: 558,
      patientDeliveryStatus: 'delivered',
      notifiedAtIso: '2026-05-21T07:06:00.000Z',
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params, undefined);
    assert.match(sentMessagePayloads[0]?.content, /系統已向病人發出網上診症候診提醒/);
    assert.match(sentMessagePayloads[0]?.content, /陳惠萍/);
    assert.match(sentMessagePayloads[0]?.content, /Chatwoot 對話 #558/);
    assert.match(sentMessagePayloads[0]?.content, /https:\/\/eden\.example\/online-consult\?token=abc/);
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

test('sendPatientOnlineConsultWaitingWhatsapp sends a waiting reassurance template to the patient', async () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    CHATWOOT_BASE_URL: process.env.CHATWOOT_BASE_URL,
    CHATWOOT_API_ACCESS_TOKEN: process.env.CHATWOOT_API_ACCESS_TOKEN,
    CHATWOOT_ACCOUNT_ID: process.env.CHATWOOT_ACCOUNT_ID,
    CHATWOOT_WHATSAPP_INBOX_ID: process.env.CHATWOOT_WHATSAPP_INBOX_ID,
    CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_NAME: process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_NAME,
    CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_LANGUAGE: process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_LANGUAGE,
    CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_CATEGORY: process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_CATEGORY,
  };

  const sentMessagePayloads: Array<Record<string, any>> = [];

  process.env.CHATWOOT_BASE_URL = 'https://chatwoot.example';
  process.env.CHATWOOT_API_ACCESS_TOKEN = 'test-token';
  process.env.CHATWOOT_ACCOUNT_ID = '';
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = '';
  process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_NAME = 'online_consult_waiting_reassurance';
  process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_LANGUAGE = 'zh_HK';
  process.env.CHATWOOT_WHATSAPP_ONLINE_WAITING_TEMPLATE_CATEGORY = 'UTILITY';

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
            name: 'online_consult_waiting_reassurance',
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
      const query = parsedUrl.searchParams.get('q') || '';
      assert.match(query, /96322476|85296322476|\+85296322476/);
      return jsonResponse({
        payload: [{
          id: 77,
          phone_number: '+85296322476',
          email: '',
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/77/contactable_inboxes') {
      return jsonResponse({
        payload: [{
          source_id: '85296322476',
          inbox: { id: 7 },
        }],
      });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/contacts/77/conversations') {
      return jsonResponse({
        payload: [{
          id: 770,
          inbox_id: 7,
          status: 'resolved',
        }],
      });
    }

    if (method === 'POST' && path === '/api/v1/accounts/1/conversations/770/messages') {
      const payload = JSON.parse(String(init?.body || '{}'));
      sentMessagePayloads.push(payload);
      return jsonResponse({ id: 771, status: 'sent' });
    }

    if (method === 'GET' && path === '/api/v1/accounts/1/conversations/770/messages') {
      return jsonResponse({
        payload: [{
          id: 771,
          status: 'delivered',
        }],
      });
    }

    throw new Error(`Unexpected fetch: ${method} ${path}`);
  }) as typeof global.fetch;

  try {
    const result = await sendPatientOnlineConsultWaitingWhatsapp({
      bookingId: 'booking-waiting',
      calendarId: 'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
      patientName: '小明',
      phone: '96322476',
      email: '',
      doctorNameZh: '張天慧醫師',
      appointmentDate: '2026-05-13',
      appointmentTime: '21:30',
      waitingMinutes: 5,
    });

    assert.equal(result.success, true);
    assert.equal(result.whatsappSent, true);
    assert.equal(result.conversationId, 770);
    assert.equal(sentMessagePayloads.length, 1);
    assert.equal(sentMessagePayloads[0]?.template_params?.name, 'online_consult_waiting_reassurance');
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.doctor_name,
      '張天慧醫師',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.waiting_minutes,
      '5',
    );
    assert.equal(
      sentMessagePayloads[0]?.template_params?.processed_params?.body?.booking_id,
      'booking-waiting',
    );
    assert.match(sentMessagePayloads[0]?.content, /如醫師仍未進入網上診症/);
    assert.match(sentMessagePayloads[0]?.content, /耐心等候多約 5 分鐘/);
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
