import { createHmac } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ChatwootClient,
  ensureChatwootHumanHandoffVisibility,
} from '@/lib/chatwoot-agent-bot';
import {
  extractChatwootWatchdogIncomingEvent,
  runChatwootHandoffAudit,
  runChatwootIncomingHandoffWatchdog,
  verifyTimestampedChatwootSignature,
} from '@/lib/chatwoot-handoff-watchdog';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('timestamped Chatwoot webhook signatures are verified with replay protection', () => {
  const rawBody = JSON.stringify({ event: 'message_created', id: 17001 });
  const timestamp = '1788422400';
  const secret = 'watchdog-secret';
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  assert.equal(
    verifyTimestampedChatwootSignature({
      rawBody,
      signature: `sha256=${signature}`,
      timestamp,
      secret,
      nowMs: Number(timestamp) * 1000 + 30_000,
    }),
    true,
  );
  assert.equal(
    verifyTimestampedChatwootSignature({
      rawBody,
      signature: `sha256=${signature}`,
      timestamp,
      secret,
      nowMs: Number(timestamp) * 1000 + 6 * 60_000,
    }),
    false,
  );
  assert.equal(
    verifyTimestampedChatwootSignature({
      rawBody: `${rawBody} `,
      signature: `sha256=${signature}`,
      timestamp,
      secret,
      nowMs: Number(timestamp) * 1000,
    }),
    false,
  );
});

test('watchdog accepts attachment-only incoming events and rejects outgoing events', () => {
  const incoming = extractChatwootWatchdogIncomingEvent({
    event: 'message_created',
    id: 17002,
    message_type: 'incoming',
    private: false,
    content: '',
    attachments: [{ id: 1 }],
    account: { id: 2 },
    inbox: { id: 2 },
    conversation: { id: 1501 },
  });
  const outgoing = extractChatwootWatchdogIncomingEvent({
    event: 'message_created',
    id: 17003,
    message_type: 'outgoing',
    account: { id: 2 },
    inbox: { id: 2 },
    conversation: { id: 1501 },
  });

  assert.deepEqual(incoming, {
    accountId: 2,
    inboxId: 2,
    conversationId: 1501,
    messageId: 17002,
  });
  assert.equal(outgoing, null);
});

test('incoming watchdog immediately recovers a pending human conversation', async () => {
  const originalFetch = global.fetch;
  const requests: string[] = [];
  let status = 'pending';

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    requests.push(`${init?.method || 'GET'} ${url.pathname}`);
    if (url.pathname.endsWith('/toggle_status')) {
      status = 'open';
      return jsonResponse({ success: true });
    }
    return jsonResponse({
      id: 1502,
      inbox_id: 2,
      status,
      custom_attributes: { eden_flow_state: 'human' },
    });
  }) as typeof global.fetch;

  try {
    const result = await runChatwootIncomingHandoffWatchdog({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      event: { accountId: 2, inboxId: 2, conversationId: 1502, messageId: 17004 },
      settleDelaysMs: [0],
    });

    assert.equal(result.action, 'recovered_human');
    assert.equal(result.attempts, 1);
    assert.deepEqual(requests, [
      'GET /api/v1/accounts/2/conversations/1502',
      'POST /api/v1/accounts/2/conversations/1502/toggle_status',
      'GET /api/v1/accounts/2/conversations/1502',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('incoming watchdog leaves a successfully processed bot-owned conversation pending', async () => {
  const originalFetch = global.fetch;
  const requests: string[] = [];

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    requests.push(`${init?.method || 'GET'} ${url.pathname}`);
    return jsonResponse({
      id: 1503,
      inbox_id: 2,
      status: 'pending',
      custom_attributes: {
        eden_flow_state: 'menu',
        eden_last_incoming_message_id: '17005',
      },
    });
  }) as typeof global.fetch;

  try {
    const result = await runChatwootIncomingHandoffWatchdog({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      event: { accountId: 2, inboxId: 2, conversationId: 1503, messageId: 17005 },
      settleDelaysMs: [0, 0],
    });

    assert.equal(result.action, 'bot_processed');
    assert.deepEqual(requests, ['GET /api/v1/accounts/2/conversations/1503']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('incoming watchdog fails open when the AgentBot did not process an incoming message', async () => {
  const originalFetch = global.fetch;
  let status = 'pending';
  let detailReads = 0;

  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    if (url.pathname.endsWith('/toggle_status')) {
      status = 'open';
      return jsonResponse({ success: true });
    }
    detailReads += 1;
    return jsonResponse({
      id: 1504,
      inbox_id: 2,
      status,
      custom_attributes: {},
    });
  }) as typeof global.fetch;

  try {
    const result = await runChatwootIncomingHandoffWatchdog({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      event: { accountId: 2, inboxId: 2, conversationId: 1504, messageId: 17006 },
      settleDelaysMs: [0, 0],
    });

    assert.equal(result.action, 'recovered_unprocessed');
    assert.equal(result.attempts, 1);
    assert.equal(detailReads, 3);
  } finally {
    global.fetch = originalFetch;
  }
});

test('handoff verification retries when the first authoritative read-back is still pending', async () => {
  const originalFetch = global.fetch;
  let detailReads = 0;
  let toggleCalls = 0;

  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    if (url.pathname.endsWith('/toggle_status')) {
      toggleCalls += 1;
      return jsonResponse({ success: true });
    }
    detailReads += 1;
    return jsonResponse({ id: 1505, status: detailReads === 1 ? 'pending' : 'open' });
  }) as typeof global.fetch;

  try {
    const result = await ensureChatwootHumanHandoffVisibility({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      accountId: 2,
      conversationId: 1505,
      currentStatus: 'pending',
    });

    assert.deepEqual(result, { status: 'open', changed: true, attempts: 2 });
    assert.equal(toggleCalls, 2);
    assert.equal(detailReads, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('daily audit recovers human and stale incoming rows but leaves outbound bot rows pending', async () => {
  const originalFetch = global.fetch;
  const statuses = new Map<number, string>([
    [1601, 'pending'],
    [1602, 'pending'],
    [1603, 'pending'],
  ]);
  const toggled: number[] = [];
  const nowSeconds = 1_788_422_400;
  const rows = [
    {
      id: 1601,
      inbox_id: 2,
      status: 'pending',
      custom_attributes: { eden_flow_state: 'human' },
      last_non_activity_message: { id: 18001, created_at: nowSeconds, message_type: 'incoming' },
    },
    {
      id: 1602,
      inbox_id: 2,
      status: 'pending',
      custom_attributes: {},
      last_non_activity_message: {
        id: 18002,
        created_at: nowSeconds - 10 * 60,
        message_type: 'incoming',
      },
    },
    {
      id: 1603,
      inbox_id: 2,
      status: 'pending',
      custom_attributes: {},
      last_non_activity_message: {
        id: 18003,
        created_at: nowSeconds - 60 * 60,
        message_type: 'outgoing',
      },
    },
  ];

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    if (url.pathname.endsWith('/conversations') && url.searchParams.get('status') === 'pending') {
      return jsonResponse({ data: { meta: { all_count: rows.length }, payload: rows } });
    }

    const conversationId = Number(url.pathname.match(/\/conversations\/(\d+)/)?.[1]);
    if (url.pathname.endsWith('/toggle_status')) {
      statuses.set(conversationId, 'open');
      toggled.push(conversationId);
      return jsonResponse({ success: true });
    }

    const snapshot = rows.find((row) => row.id === conversationId);
    return jsonResponse({ ...snapshot, status: statuses.get(conversationId) });
  }) as typeof global.fetch;

  try {
    const summary = await runChatwootHandoffAudit({
      client: new ChatwootClient('https://chatwoot.example', 'test-token'),
      accountId: 2,
      inboxId: 2,
      now: new Date(nowSeconds * 1000),
    });

    assert.deepEqual(toggled, [1601, 1602]);
    assert.equal(summary.scanned, 3);
    assert.equal(summary.candidates, 2);
    assert.equal(summary.recovered, 2);
    assert.equal(summary.wouldRecover, 0);
    assert.equal(summary.failures.length, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

