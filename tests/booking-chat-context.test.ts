import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractBookingConversationContext,
  isAvailabilityFollowUpMessage,
  resolveDateFromBookingText,
} from '@/lib/booking-chat-context';

test('resolveDateFromBookingText resolves next Monday from relative Cantonese date', () => {
  const resolved = resolveDateFromBookingText('我想約下個星期一', '2026-03-05');
  assert.equal(resolved, '2026-03-09');
});

test('extractBookingConversationContext recovers doctor, clinic, and date from booking thread', () => {
  const messages = [
    { role: 'user' as const, content: '我想預約梁醫師' },
    { role: 'assistant' as const, content: '想幫你預約梁仲威醫師。請問你想預約邊一日。（格式：YYYY-MM-DD）。' },
    { role: 'user' as const, content: '我想約下個星期一' },
    {
      role: 'assistant' as const,
      content: '幫你查過，梁仲威醫師下星期一（3月9號）會喺佐敦診所應診。請問你係咪想預約佐敦診所。',
    },
    { role: 'user' as const, content: '係呀，有咩時間？' },
  ];

  const context = extractBookingConversationContext(messages, '2026-03-05');
  assert.deepEqual(context, {
    doctorNameZh: '梁仲威醫師',
    clinicNameZh: '佐敦',
    date: '2026-03-09',
  });
});

test('isAvailabilityFollowUpMessage detects slot request that confirms previous clinic prompt', () => {
  const messages = [
    { role: 'assistant' as const, content: '幫你查過，梁仲威醫師下星期一（3月9號）會喺佐敦診所應診。請問你係咪想預約佐敦診所。' },
    { role: 'user' as const, content: '係呀，有咩時間？' },
  ];

  assert.equal(isAvailabilityFollowUpMessage(messages), true);
});

test('isAvailabilityFollowUpMessage treats short affirmation after clinic confirmation as follow-up', () => {
  const messages = [
    { role: 'assistant' as const, content: '梁仲威醫師下星期一會喺佐敦診所應診。請問你係咪想預約佐敦診所。' },
    { role: 'user' as const, content: '係呀' },
  ];

  assert.equal(isAvailabilityFollowUpMessage(messages), true);
});
