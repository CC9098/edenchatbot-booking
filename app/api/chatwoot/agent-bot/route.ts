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
  extractIncomingChatwootEvent,
  getFlowState,
  isDuplicateIncomingMessage,
  mapConversationMessagesToLegacyChat,
  mergeFlowAttributes,
  replaceLatestUserMessage,
  resolveBookingMenuSelection,
  resolveClinicMenuSelection,
  resolveGeneralMenuSelection,
  resolveMenuSelection,
  sendChatwootBookingDoctorReply,
  shouldAllowGeneralAiReply,
  shouldDeferToHumanAfterAgentReply,
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
    const { settings: widgetSettings } = await loadWidgetChatbotSettings();
    const runtimeCopy = buildChatwootRuntimeCopy(widgetSettings);
    const runtimeSystemMessages = buildChatwootSystemMessageSet(runtimeCopy);
    const currentAttributes = conversation.custom_attributes || {};
    const generalMenuReply: ChatwootOutgoingMessagePayload = {
      content: runtimeCopy.generalMenuPrompt,
      contentType: 'input_select',
      items: [...runtimeCopy.generalMenuItems],
    };
    const generalMenuRetryReply: ChatwootOutgoingMessagePayload = {
      content: `${runtimeCopy.generalMenuPrompt}\n\n如想自由輸入問題，請先選擇「其他問題」。`,
      contentType: 'input_select',
      items: [...runtimeCopy.generalMenuItems],
    };
    const clinicMenuReply: ChatwootOutgoingMessagePayload = {
      content: runtimeCopy.clinicMenuPrompt,
      contentType: 'input_select',
      items: [...runtimeCopy.clinicMenuItems],
    };
    const clinicMenuRetryReply: ChatwootOutgoingMessagePayload = {
      content: `${runtimeCopy.clinicMenuPrompt}\n\n請先選擇以上項目；如想問其他內容，請返回上一層再選擇「其他問題」。`,
      contentType: 'input_select',
      items: [...runtimeCopy.clinicMenuItems],
    };

    if (isDuplicateIncomingMessage(currentAttributes, event.messageId)) {
      return NextResponse.json({ ok: true, ignored: 'duplicate_message' });
    }

    const currentState = getFlowState(currentAttributes);
    const rootSelection = resolveMenuSelection(event.content, {
      allowNumeric: currentState === 'menu',
    });
    const bookingSelection = currentState === 'booking_menu'
      ? resolveBookingMenuSelection(event.content)
      : null;
    const shouldDeferToHuman = !rootSelection && !bookingSelection && shouldDeferToHumanAfterAgentReply(
      conversation.messages,
      event.messageId,
      runtimeSystemMessages,
    );
    let nextState = currentState;
    let reply: string | ChatwootOutgoingMessagePayload | null = null;

    if (shouldDeferToHuman) {
      nextState = 'human';
      reply = null;
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
        nextState = 'general_menu';
        reply = generalMenuRetryReply;
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
        nextState = 'clinic_menu';
        reply = clinicMenuRetryReply;
      }
    } else {
      if (nextState === 'general_ai') {
        const aiReplyIsArmed = shouldAllowGeneralAiReply(
          conversation.messages,
          event.messageId,
          runtimeCopy.generalInquiryPrompt,
        );

        nextState = 'human';
        reply = aiReplyIsArmed
          ? await generateGeneralAiReply(conversation.messages, event.content, runtimeSystemMessages)
          : null;
      } else if (nextState === 'booking_menu') {
        reply = BOOKING_MENU_REPLY;
      } else if (nextState === 'human') {
        reply = null;
      } else {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      }
    }

    if (reply) {
      await client.createMessage(event.accountId, event.conversationId, reply);
    }

    await client.updateConversationCustomAttributes(
      event.accountId,
      event.conversationId,
      mergeFlowAttributes(currentAttributes, nextState, event.messageId),
    );

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
