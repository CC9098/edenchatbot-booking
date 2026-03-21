import { NextRequest, NextResponse } from 'next/server';
import {
  CHATWOOT_BOOKING_ACK,
  CHATWOOT_CLINIC_ADDRESSES_MESSAGE,
  CHATWOOT_CLINIC_HOURS_MESSAGE,
  CHATWOOT_CLINIC_MENU_ITEMS,
  CHATWOOT_CLINIC_MENU_PROMPT,
  CHATWOOT_FEES_MESSAGE,
  CHATWOOT_GENERAL_MENU_ITEMS,
  CHATWOOT_GENERAL_MENU_PROMPT,
  CHATWOOT_GENERAL_INQUIRY_PROMPT,
  CHATWOOT_HUMAN_ACK,
  CHATWOOT_MAIN_MENU_ITEMS,
  CHATWOOT_MAIN_MENU_PROMPT,
  CHATWOOT_TIMETABLE_MESSAGE,
  type ChatwootOutgoingMessagePayload,
  createChatwootClientFromEnv,
  extractIncomingChatwootEvent,
  getFlowState,
  isDuplicateIncomingMessage,
  mapConversationMessagesToLegacyChat,
  mergeFlowAttributes,
  replaceLatestUserMessage,
  resolveClinicMenuSelection,
  resolveGeneralMenuSelection,
  resolveMenuSelection,
  verifyChatwootSignature,
} from '@/lib/chatwoot-agent-bot';
import { generateLegacyChatResponse } from '@/lib/legacy-chat-response';

export const runtime = 'nodejs';

const MAIN_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_MAIN_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_MAIN_MENU_ITEMS],
};

const GENERAL_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_GENERAL_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_GENERAL_MENU_ITEMS],
};

const CLINIC_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_CLINIC_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_CLINIC_MENU_ITEMS],
};

async function generateGeneralAiReply(
  messages: Parameters<typeof mapConversationMessagesToLegacyChat>[0],
  userMessage: string,
) {
  const mappedMessages = mapConversationMessagesToLegacyChat(messages);
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

    if (isDuplicateIncomingMessage(currentAttributes, event.messageId)) {
      return NextResponse.json({ ok: true, ignored: 'duplicate_message' });
    }

    const currentState = getFlowState(currentAttributes);
    const rootSelection = resolveMenuSelection(event.content, {
      allowNumeric: currentState === 'menu',
    });
    let nextState = currentState;
    let reply: string | ChatwootOutgoingMessagePayload | null = null;

    if (rootSelection?.kind === 'human') {
      nextState = 'human';
      reply = CHATWOOT_HUMAN_ACK;
    } else if (rootSelection?.kind === 'booking') {
      nextState = 'booking';
      reply = CHATWOOT_BOOKING_ACK;
    } else if (rootSelection?.kind === 'general') {
      nextState = 'general_menu';
      reply = GENERAL_MENU_REPLY;
    } else if (currentState === 'general_menu') {
      const generalSelection = resolveGeneralMenuSelection(event.content);

      if (generalSelection?.kind === 'fees') {
        nextState = 'general_menu';
        reply = CHATWOOT_FEES_MESSAGE;
      } else if (generalSelection?.kind === 'clinic') {
        nextState = 'clinic_menu';
        reply = CLINIC_MENU_REPLY;
      } else if (generalSelection?.kind === 'timetable') {
        nextState = 'general_menu';
        reply = CHATWOOT_TIMETABLE_MESSAGE;
      } else if (generalSelection?.kind === 'other') {
        nextState = 'general_ai';
        reply = CHATWOOT_GENERAL_INQUIRY_PROMPT;
      } else if (generalSelection?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else {
        nextState = 'general_ai';
        reply = await generateGeneralAiReply(conversation.messages, event.content);
      }
    } else if (currentState === 'clinic_menu') {
      const clinicSelection = resolveClinicMenuSelection(event.content);

      if (clinicSelection?.kind === 'hours') {
        nextState = 'clinic_menu';
        reply = CHATWOOT_CLINIC_HOURS_MESSAGE;
      } else if (clinicSelection?.kind === 'addresses') {
        nextState = 'clinic_menu';
        reply = CHATWOOT_CLINIC_ADDRESSES_MESSAGE;
      } else if (clinicSelection?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else {
        nextState = 'clinic_menu';
        reply = CLINIC_MENU_REPLY;
      }
    } else {
      if (nextState === 'general_ai') {
        reply = await generateGeneralAiReply(conversation.messages, event.content);
      } else if (nextState === 'booking' || nextState === 'human') {
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
