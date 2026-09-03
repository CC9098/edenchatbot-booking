import { NextRequest, NextResponse } from 'next/server';
import {
  CHATWOOT_BOOKING_MENU_ITEMS,
  CHATWOOT_BOOKING_MENU_PROMPT,
  CHATWOOT_HUMAN_ACK,
  CHATWOOT_MAIN_MENU_ITEMS,
  CHATWOOT_MAIN_MENU_PROMPT,
  type ChatwootOutgoingMessagePayload,
  buildChatwootRuntimeCopy,
  buildChatwootSystemMessageSet,
  buildDirectBookingReply,
  createChatwootClientFromEnv,
  ensureChatwootHumanHandoffVisibility,
  extractIncomingChatwootEvent,
  getFlowState,
  isDuplicateIncomingMessage,
  mergeIncomingEventIntoConversationMessages,
  mapConversationMessagesToLegacyChat,
  persistChatwootFlowState,
  replaceLatestUserMessage,
  resolveBookingMenuSelection,
  resolveClinicMenuSelection,
  resolveGeneralMenuSelection,
  resolveMenuSelection,
  sendChatwootBookingDoctorReply,
  shouldAllowGeneralAiReply,
  shouldDeferToHumanAfterAgentReply,
  shouldSilenceUnmatchedChatwootMessage,
  verifyChatwootSignature,
} from '@/lib/chatwoot-agent-bot';
import { generateLegacyChatResponse } from '@/lib/legacy-chat-response';
import { loadWidgetChatbotSettings } from '@/lib/widget-chatbot-settings-store';

export const runtime = 'nodejs';

const MAIN_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_MAIN_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_MAIN_MENU_ITEMS],
};

const BOOKING_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_BOOKING_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_BOOKING_MENU_ITEMS],
};

async function generateGeneralAiReply(
  messages: Parameters<typeof mapConversationMessagesToLegacyChat>[0],
  userMessage: string,
  systemMessages: Parameters<typeof mapConversationMessagesToLegacyChat>[1],
) {
  const mappedMessages = mapConversationMessagesToLegacyChat(messages, systemMessages);
  const aiMessages = replaceLatestUserMessage(mappedMessages, userMessage);
  const { reply } = await generateLegacyChatResponse({
    messages: aiMessages,
  });

  return reply;
}

function getOptionalWebhookSecret(): string | null {
  const secret = (process.env.CHATWOOT_WEBHOOK_SECRET || '').trim();
  return secret || null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const webhookSecret = getOptionalWebhookSecret();

  if (webhookSecret) {
    const signature = request.headers.get('x-chatwoot-signature');
    if (!verifyChatwootSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid Chatwoot signature' }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const event = extractIncomingChatwootEvent(payload);
  if (!event) {
    return NextResponse.json({ ok: true, ignored: 'unsupported_event' });
  }

  try {
    const client = createChatwootClientFromEnv();
    const conversation = await client.getConversationDetails(event.accountId, event.conversationId);
    const currentAttributes = conversation.custom_attributes || {};
    const currentState = getFlowState(currentAttributes);
    let handoffVerification: Awaited<
      ReturnType<typeof ensureChatwootHumanHandoffVisibility>
    > | null = null;

    if (currentState === 'human') {
      handoffVerification = await ensureChatwootHumanHandoffVisibility({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        currentStatus: conversation.status,
      });

      console.info('[chatwoot/agent-bot] existing human flow visible', {
        accountId: event.accountId,
        conversationId: event.conversationId,
        incomingMessageId: event.messageId,
        changed: handoffVerification.changed,
        attempts: handoffVerification.attempts,
      });
    }

    if (isDuplicateIncomingMessage(currentAttributes, event.messageId)) {
      return NextResponse.json({ ok: true, ignored: 'duplicate_message' });
    }

    const { settings: widgetSettings } = await loadWidgetChatbotSettings();
    const runtimeCopy = buildChatwootRuntimeCopy(widgetSettings);
    const runtimeSystemMessages = buildChatwootSystemMessageSet(runtimeCopy);
    const generalMenuReply: ChatwootOutgoingMessagePayload = {
      content: runtimeCopy.generalMenuPrompt,
      contentType: 'input_select',
      items: [...runtimeCopy.generalMenuItems],
    };
    const clinicMenuReply: ChatwootOutgoingMessagePayload = {
      content: runtimeCopy.clinicMenuPrompt,
      contentType: 'input_select',
      items: [...runtimeCopy.clinicMenuItems],
    };

    const conversationMessages = mergeIncomingEventIntoConversationMessages(
      conversation.messages,
      event,
    );
    const rootSelection = resolveMenuSelection(event.content, {
      allowNumeric: currentState === 'menu',
    });
    const bookingSelection = currentState === 'booking_menu'
      ? resolveBookingMenuSelection(event.content)
      : null;
    const shouldDeferToHuman = !rootSelection && !bookingSelection && shouldDeferToHumanAfterAgentReply(
      conversationMessages,
      event.messageId,
      runtimeSystemMessages,
    );
    let nextState = currentState;
    let reply: string | ChatwootOutgoingMessagePayload | null = null;

    if (shouldDeferToHuman) {
      nextState = 'human';
      reply = null;
    } else if (rootSelection?.kind === 'main') {
      nextState = 'menu';
      reply = MAIN_MENU_REPLY;
    } else if (rootSelection?.kind === 'human') {
      nextState = 'human';
      reply = CHATWOOT_HUMAN_ACK;
    } else if (rootSelection?.kind === 'general') {
      nextState = 'general_menu';
      reply = generalMenuReply;
    } else if (bookingSelection?.kind === 'new_booking') {
      nextState = 'menu';
      reply = buildDirectBookingReply();
    } else if (bookingSelection?.kind === 'reschedule_booking') {
      nextState = 'menu';
      await sendChatwootBookingDoctorReply({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        contactId: event.contactId,
        contactPhone: event.contactPhone,
        action: 'reschedule',
      });
      reply = null;
    } else if (bookingSelection?.kind === 'cancel_booking') {
      nextState = 'menu';
      await sendChatwootBookingDoctorReply({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        contactId: event.contactId,
        contactPhone: event.contactPhone,
        action: 'cancel',
      });
      reply = null;
    } else if (bookingSelection?.kind === 'main') {
      nextState = 'menu';
      reply = MAIN_MENU_REPLY;
    } else if (rootSelection?.kind === 'reschedule') {
      nextState = 'menu';
      await sendChatwootBookingDoctorReply({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        contactId: event.contactId,
        contactPhone: event.contactPhone,
        action: 'reschedule',
      });
      reply = null;
    } else if (rootSelection?.kind === 'cancel') {
      nextState = 'menu';
      await sendChatwootBookingDoctorReply({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        contactId: event.contactId,
        contactPhone: event.contactPhone,
        action: 'cancel',
      });
      reply = null;
    } else if (rootSelection?.kind === 'booking') {
      nextState = 'booking_menu';
      reply = BOOKING_MENU_REPLY;
    } else if (currentState === 'general_menu') {
      const generalSelection = resolveGeneralMenuSelection(event.content, {
        labels: {
          fees: runtimeCopy.generalMenuItems[0]?.title,
          clinic: runtimeCopy.generalMenuItems[1]?.title,
          timetable: runtimeCopy.generalMenuItems[2]?.title,
          other: runtimeCopy.generalMenuItems[3]?.title,
          main: runtimeCopy.generalMenuItems[4]?.title,
        },
      });

      if (generalSelection?.kind === 'fees') {
        nextState = 'general_menu';
        reply = runtimeCopy.feesMessage;
      } else if (generalSelection?.kind === 'clinic') {
        nextState = 'clinic_menu';
        reply = clinicMenuReply;
      } else if (generalSelection?.kind === 'timetable') {
        nextState = 'general_menu';
        reply = runtimeCopy.timetableMessage;
      } else if (generalSelection?.kind === 'other') {
        nextState = 'general_ai';
        reply = runtimeCopy.generalInquiryPrompt;
      } else if (generalSelection?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else {
        nextState = 'human';
        reply = null;
      }
    } else if (currentState === 'clinic_menu') {
      const clinicSelection = resolveClinicMenuSelection(event.content, {
        labels: {
          hours: runtimeCopy.clinicMenuItems[0]?.title,
          addresses: runtimeCopy.clinicMenuItems[1]?.title,
          main: runtimeCopy.clinicMenuItems[2]?.title,
        },
      });

      if (clinicSelection?.kind === 'hours') {
        nextState = 'clinic_menu';
        reply = runtimeCopy.clinicHoursMessage;
      } else if (clinicSelection?.kind === 'addresses') {
        nextState = 'clinic_menu';
        reply = runtimeCopy.clinicAddressesMessage;
      } else if (clinicSelection?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else {
        nextState = 'human';
        reply = null;
      }
    } else {
      if (nextState === 'general_ai') {
        const aiReplyIsArmed = shouldAllowGeneralAiReply(
          conversationMessages,
          event.messageId,
          runtimeCopy.generalInquiryPrompt,
        );

        nextState = 'human';
        reply = aiReplyIsArmed
          ? await generateGeneralAiReply(conversationMessages, event.content, runtimeSystemMessages)
          : null;
      } else if (shouldSilenceUnmatchedChatwootMessage(nextState)) {
        nextState = 'human';
        reply = null;
      } else {
        nextState = 'human';
        reply = null;
      }
    }

    if (nextState === 'human' && !handoffVerification) {
      handoffVerification = await ensureChatwootHumanHandoffVisibility({
        client,
        accountId: event.accountId,
        conversationId: event.conversationId,
        currentStatus: conversation.status,
      });

      console.info('[chatwoot/agent-bot] human handoff visible', {
        accountId: event.accountId,
        conversationId: event.conversationId,
        incomingMessageId: event.messageId,
        changed: handoffVerification.changed,
        attempts: handoffVerification.attempts,
      });
    }

    if (reply) {
      await client.createMessage(event.accountId, event.conversationId, reply);
    }

    await persistChatwootFlowState({
      client,
      accountId: event.accountId,
      conversationId: event.conversationId,
      currentStatus: handoffVerification?.status || conversation.status,
      currentAttributes,
      nextState,
      incomingMessageId: event.messageId,
    });

    return NextResponse.json({ ok: true, state: nextState });
  } catch (error) {
    console.error('[chatwoot/agent-bot] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown Chatwoot bot error',
      },
      { status: 500 },
    );
  }
}
