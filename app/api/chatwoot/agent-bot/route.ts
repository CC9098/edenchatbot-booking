import { NextRequest, NextResponse } from 'next/server';
import {
  CHATWOOT_BOOKING_ACK,
  CHATWOOT_CLINIC_ADDRESSES_MESSAGE,
  CHATWOOT_CLINIC_HOURS_MESSAGE,
  CHATWOOT_CLINIC_MENU_ITEMS,
  CHATWOOT_CLINIC_MENU_PROMPT,
  CHATWOOT_FEES_MESSAGE,
  CHATWOOT_GENERAL_MORE_MENU_ITEMS,
  CHATWOOT_GENERAL_MORE_MENU_PROMPT,
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
  resolveGeneralMoreMenuSelection,
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

const GENERAL_MORE_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_GENERAL_MORE_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_GENERAL_MORE_MENU_ITEMS],
};

const CLINIC_MENU_REPLY: ChatwootOutgoingMessagePayload = {
  content: CHATWOOT_CLINIC_MENU_PROMPT,
  contentType: 'input_select',
  items: [...CHATWOOT_CLINIC_MENU_ITEMS],
};

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
      const moreSelectionByText = generalSelection
        ? null
        : resolveGeneralMoreMenuSelection(event.content, { allowNumeric: false });

      if (generalSelection?.kind === 'fees') {
        nextState = 'general_menu';
        reply = CHATWOOT_FEES_MESSAGE;
      } else if (generalSelection?.kind === 'clinic') {
        nextState = 'clinic_menu';
        reply = CLINIC_MENU_REPLY;
      } else if (generalSelection?.kind === 'more') {
        nextState = 'general_menu_more';
        reply = GENERAL_MORE_MENU_REPLY;
      } else if (moreSelectionByText?.kind === 'timetable') {
        nextState = 'general_menu_more';
        reply = CHATWOOT_TIMETABLE_MESSAGE;
      } else if (moreSelectionByText?.kind === 'other') {
        nextState = 'general_ai';
        reply = CHATWOOT_GENERAL_INQUIRY_PROMPT;
      } else if (moreSelectionByText?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else {
        nextState = 'general_menu';
        reply = GENERAL_MENU_REPLY;
      }
    } else if (currentState === 'general_menu_more') {
      const generalMoreSelection = resolveGeneralMoreMenuSelection(event.content);
      const generalSelectionByText = generalMoreSelection
        ? null
        : resolveGeneralMenuSelection(event.content, { allowNumeric: false });

      if (generalMoreSelection?.kind === 'timetable') {
        nextState = 'general_menu_more';
        reply = CHATWOOT_TIMETABLE_MESSAGE;
      } else if (generalMoreSelection?.kind === 'other') {
        nextState = 'general_ai';
        reply = CHATWOOT_GENERAL_INQUIRY_PROMPT;
      } else if (generalMoreSelection?.kind === 'main') {
        nextState = 'menu';
        reply = MAIN_MENU_REPLY;
      } else if (generalSelectionByText?.kind === 'fees') {
        nextState = 'general_menu';
        reply = CHATWOOT_FEES_MESSAGE;
      } else if (generalSelectionByText?.kind === 'clinic') {
        nextState = 'clinic_menu';
        reply = CLINIC_MENU_REPLY;
      } else if (generalSelectionByText?.kind === 'more') {
        nextState = 'general_menu_more';
        reply = GENERAL_MORE_MENU_REPLY;
      } else {
        nextState = 'general_menu_more';
        reply = GENERAL_MORE_MENU_REPLY;
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
        const mappedMessages = mapConversationMessagesToLegacyChat(conversation.messages);
        const aiMessages = replaceLatestUserMessage(mappedMessages, event.content);
        const { reply: aiReply } = await generateLegacyChatResponse({
          messages: aiMessages,
        });
        reply = aiReply;
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
