import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildChatwootRuntimeCopy } from '@/lib/chatwoot-agent-bot';
import { getClinicAddressLines, getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';

const STALE_PUBLIC_NUMBERS = /6733\s*3234|85267333234|6733\s*3801|85267333801/;

function assertCurrentPublicContactCopy(label: string, copy: string) {
  assert.doesNotMatch(copy, STALE_PUBLIC_NUMBERS, label + ' contains a retired public WhatsApp number');
  assert.match(copy, /5926\s*9537|85259269537/, label + ' is missing Central WhatsApp');
  assert.match(copy, /5929\s*3042|85259293042/, label + ' is missing Jordan WhatsApp');
  assert.match(copy, /5189\s*9065|85251899065/, label + ' changed Tsuen Wan WhatsApp');
}

test('all three chatbot contact copies use current Central/Jordan numbers and preserve Tsuen Wan', () => {
  const sharedContactCopy = [
    ...getPromptClinicInfoLines(),
    ...getWhatsappContactLines(),
    ...getClinicAddressLines(),
  ].join('\n');
  const chatwootContactCopy = buildChatwootRuntimeCopy().clinicAddressesMessage;

  assertCurrentPublicContactCopy('WordPress widget / legacy prompt source', sharedContactCopy);
  assertCurrentPublicContactCopy('Chat v2 shared prompt source', sharedContactCopy);
  assertCurrentPublicContactCopy('Chatwoot clinic-address reply', chatwootContactCopy);
  assert.match(chatwootContactCopy, /中環/);
  assert.match(chatwootContactCopy, /佐敦/);
  assert.match(chatwootContactCopy, /荃灣/);
});

test('chatbot routes stay wired to the shared public contact source', () => {
  const legacyRoute = readFileSync('lib/legacy-chat-response.ts', 'utf8');
  const chatV2Route = readFileSync('app/api/chat/v2/route.ts', 'utf8');
  const chatwootRoute = readFileSync('app/api/chatwoot/agent-bot/route.ts', 'utf8');

  assert.match(legacyRoute, /getPromptClinicInfoLines/);
  assert.match(legacyRoute, /getWhatsappContactLines/);
  assert.match(chatV2Route, /getPromptClinicInfoLines|buildChatV2ClinicPromptInfo/);
  assert.match(chatV2Route, /getWhatsappContactLines|buildChatV2ClinicPromptInfo/);
  assert.match(chatwootRoute, /buildChatwootRuntimeCopy/);
});
