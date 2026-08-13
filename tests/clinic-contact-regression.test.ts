import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLINICS,
  getClinicAddressLines,
  getPromptClinicInfoLines,
  getWhatsappContactLines,
} from '@/shared/clinic-data';
import { buildChatwootRuntimeCopy } from '@/lib/chatwoot-agent-bot';
import { getChatwootWhatsappSenderPhone, getClinicWhatsappPhone } from '@/lib/whatsapp-booking';

const RETIRED_PUBLIC_NUMBERS = [
  '6733 3234',
  '85267333234',
  '6733 3801',
  '85267333801',
];

function assertNoRetiredPublicNumbers(label: string, values: string[]): void {
  const rendered = values.join('\n');

  for (const retiredNumber of RETIRED_PUBLIC_NUMBERS) {
    assert.equal(
      rendered.includes(retiredNumber),
      false,
      `${label} must not expose retired public number ${retiredNumber}`,
    );
  }
}

test('shared public clinic contact source exposes current numbers and links', () => {
  const central = CLINICS.find((clinic) => clinic.id === 'central');
  const jordan = CLINICS.find((clinic) => clinic.id === 'jordan');
  const tsuenWan = CLINICS.find((clinic) => clinic.id === 'tsuenwan');

  assert.deepEqual(central && {
    phones: central.phones,
    contactPhone: central.contactPhone,
    whatsappUrl: central.whatsappUrl,
  }, {
    phones: ['3575 9733', '5926 9537'],
    contactPhone: '5926 9537',
    whatsappUrl: 'https://wa.me/85259269537',
  });
  assert.deepEqual(jordan && {
    phones: jordan.phones,
    contactPhone: jordan.contactPhone,
    whatsappUrl: jordan.whatsappUrl,
  }, {
    phones: ['3105 0733', '5929 3042'],
    contactPhone: '5929 3042',
    whatsappUrl: 'https://wa.me/85259293042',
  });
  assert.deepEqual(tsuenWan && {
    phones: tsuenWan.phones,
    contactPhone: tsuenWan.contactPhone,
    whatsappUrl: tsuenWan.whatsappUrl,
  }, {
    phones: ['2698 5422', '5189 9065'],
    contactPhone: '2698 5422 / 5189 9065',
    whatsappUrl: 'https://wa.me/85251899065',
  });

  assertNoRetiredPublicNumbers('shared clinic source', [
    ...getClinicAddressLines(),
    ...getPromptClinicInfoLines(),
    ...getWhatsappContactLines(),
  ]);
});

test('WordPress/chat v2 and Chatwoot generated contact copy stays free of retired numbers', () => {
  const runtimeCopy = buildChatwootRuntimeCopy();

  assertNoRetiredPublicNumbers('chatwoot runtime copy', [
    runtimeCopy.clinicAddressesMessage,
    runtimeCopy.clinicHoursMessage,
    runtimeCopy.generalMenuMessage,
  ]);
  assertNoRetiredPublicNumbers('legacy and chat v2 prompt contact source', [
    ...getPromptClinicInfoLines(),
    ...getWhatsappContactLines(),
  ]);
});

test('Chatwoot sender remains Tsuen Wan and is not selected by clinic public contact', () => {
  const originalSenderPhone = process.env.CHATWOOT_WHATSAPP_SENDER_PHONE;
  delete process.env.CHATWOOT_WHATSAPP_SENDER_PHONE;

  try {
    assert.equal(getChatwootWhatsappSenderPhone(), '+85251899065');
    assert.equal(getClinicWhatsappPhone('central'), '+85251899065');
    assert.equal(getClinicWhatsappPhone('jordan'), '+85251899065');
    assert.equal(getClinicWhatsappPhone('tsuenwan'), '+85251899065');
  } finally {
    if (originalSenderPhone === undefined) {
      delete process.env.CHATWOOT_WHATSAPP_SENDER_PHONE;
    } else {
      process.env.CHATWOOT_WHATSAPP_SENDER_PHONE = originalSenderPhone;
    }
  }
});
