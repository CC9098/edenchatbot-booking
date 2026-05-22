#!/usr/bin/env node
import 'dotenv/config';
import WebSocket from 'ws';

const baseUrl = (process.env.CHATWOOT_BASE_URL || '').trim().replace(/\/$/, '');
const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();
const configuredAccountId = parsePositiveInteger(process.env.CHATWOOT_ACCOUNT_ID);
const timeoutMs = parsePositiveInteger(process.env.CHATWOOT_REALTIME_CHECK_TIMEOUT_MS) || 8000;

if (!baseUrl || !apiAccessToken) {
  console.error('[fail] CHATWOOT_BASE_URL and CHATWOOT_API_ACCESS_TOKEN are required.');
  process.exit(1);
}

const restHeaders = {
  api_access_token: apiAccessToken,
  'Content-Type': 'application/json',
};

function parsePositiveInteger(value) {
  const parsed = Number(String(value || '').trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveAccountId(profile) {
  if (configuredAccountId) return configuredAccountId;
  if (parsePositiveInteger(profile.account_id)) return Number(profile.account_id);
  const accountId = profile.accounts?.find((account) => parsePositiveInteger(account.id))?.id;
  if (parsePositiveInteger(accountId)) return Number(accountId);
  return null;
}

function resolvePubSubToken(profile) {
  return [
    profile.pubsub_token,
    profile.pub_sub_token,
    profile.pubsubToken,
  ].find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function buildCableUrl() {
  const parsed = new URL(baseUrl);
  parsed.protocol = parsed.protocol === 'http:' ? 'ws:' : 'wss:';
  parsed.pathname = '/cable';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

async function fetchProfile() {
  const response = await fetch(`${baseUrl}/api/v1/profile`, {
    method: 'GET',
    headers: restHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile API failed: ${response.status} ${response.statusText} ${text}`);
  }

  return response.json();
}

async function checkWebSocket({ accountId, userId, pubSubToken }) {
  const cableUrl = buildCableUrl();
  const identifier = JSON.stringify({
    channel: 'RoomChannel',
    pubsub_token: pubSubToken,
    account_id: accountId,
    user_id: userId,
  });

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(cableUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`No Chatwoot WebSocket subscription confirmation within ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('open', () => {
      socket.send(JSON.stringify({
        command: 'subscribe',
        identifier,
      }));
    });

    socket.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (payload.type === 'confirm_subscription') {
        clearTimeout(timeout);
        socket.close();
        resolve(cableUrl);
        return;
      }

      if (payload.type === 'reject_subscription') {
        clearTimeout(timeout);
        socket.close();
        reject(new Error(`Chatwoot rejected RoomChannel subscription: ${raw.toString()}`));
      }
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

try {
  const profile = await fetchProfile();
  const accountId = resolveAccountId(profile);
  const userId = parsePositiveInteger(profile.id);
  const pubSubToken = resolvePubSubToken(profile);

  console.log(`[ok] Chatwoot REST profile responded from ${baseUrl}`);

  if (!accountId || !userId || !pubSubToken) {
    console.error('[fail] Profile API did not include account id, user id, or pubsub token needed for RoomChannel.');
    console.error(JSON.stringify({
      accountId: accountId || null,
      userId: userId || null,
      hasPubSubToken: Boolean(pubSubToken),
    }, null, 2));
    process.exit(1);
  }

  const cableUrl = await checkWebSocket({ accountId, userId, pubSubToken });
  console.log(`[ok] Chatwoot WebSocket subscribed to RoomChannel at ${cableUrl}`);
  console.log('[ok] Realtime transport is reachable from this machine. If agents still need refresh, check browser DevTools WebSocket frames and Chatwoot Sidekiq/Redis broadcast logs while a real WhatsApp message arrives.');
} catch (error) {
  console.error(`[fail] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
