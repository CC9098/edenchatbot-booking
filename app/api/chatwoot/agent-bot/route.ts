import { NextRequest, NextResponse } from 'next/server';
import {
  CHATWOOT_BOOKING_ACK,
  CHATWOOT_GENERAL_INQUIRY_PROMPT,
  CHATWOOT_HUMAN_ACK,
  CHATWOOT_MAIN_MENU_MESSAGE,
  createChatwootClientFromEnv,
  extractIncomingChatwootEvent,
  getFlowState,
  isDuplicateIncomingMessage,
  mapConversationMessagesToLegacyChat,
  mergeFlowAttributes,
  replaceLatestUserMessage,
  resolveMenuSelection,
  verifyChatwootSignature,
} from '@/lib/chatwoot-agent-bot';
import { generateLegacyChatResponse } from '@/lib/legacy-chat-response';

export const runtime = 'nodejs';

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

    const selection = resolveMenuSelection(event.content);
    let nextState = getFlowState(currentAttributes);
    let reply: string | null = null;

    if (selection?.kind === 'human') {
      nextState = 'human';
      reply = CHATWOOT_HUMAN_ACK;
    } else if (selection?.kind === 'booking') {
      nextState = 'booking';
      reply = CHATWOOT_BOOKING_ACK;
    } else {
      const shouldStartGeneralAi = selection?.kind === 'general_ai';

      if (shouldStartGeneralAi) {
        nextState = 'general_ai';
      }

      if (nextState === 'general_ai') {
        if (selection?.kind === 'general_ai' && !selection.remainder) {
          reply = CHATWOOT_GENERAL_INQUIRY_PROMPT;
        } else {
          const mappedMessages = mapConversationMessagesToLegacyChat(conversation.messages);
          const aiMessages = selection?.remainder
            ? replaceLatestUserMessage(mappedMessages, selection.remainder)
            : mappedMessages;
          const { reply: aiReply } = await generateLegacyChatResponse({
            messages: aiMessages,
          });
          reply = aiReply;
        }
      } else if (nextState === 'booking' || nextState === 'human') {
        reply = null;
      } else {
        nextState = 'menu';
        reply = CHATWOOT_MAIN_MENU_MESSAGE;
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
