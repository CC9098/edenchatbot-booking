import { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";
import {
  getStaffChatwootConfig,
  resolveStaffChatwootAccountId,
  staffChatwootRequest,
} from "@/lib/staff-chatwoot-api";
import {
  normalizeChatwootHistoryMessages,
  type RawChatwootHistoryMessage,
} from "@/lib/staff-chatwoot-history";
import {
  compareChatwootConversationFreshness,
  getChatwootConversationFreshness,
  getChatwootConversationLastActivityAt,
  normalizeChatwootTimestamp,
  parseChatwootTimestamp,
} from "@/lib/staff-chatwoot-conversation-freshness";

export const dynamic = "force-dynamic";

type ChatwootConversation = {
  id?: number;
  status?: string | null;
  can_reply?: boolean | null;
  inbox_id?: number | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  last_activity_at?: number | string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } },
) {
  try {
    await requireStaffRoleWithChatwootEdenToolsToken(request);

    const contactId = Number(params.contactId);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Invalid contact" }, { status: 400 });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getStaffChatwootConfig();
    const accountId = await resolveStaffChatwootAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const conversationsResponse = await staffChatwootRequest<{ payload?: ChatwootConversation[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
    );

    const allConversations = (Array.isArray(conversationsResponse.payload)
      ? conversationsResponse.payload
      : [])
      .filter((conversation) => conversation.id)
      .sort((a, b) => {
        const bTime = parseChatwootTimestamp(getChatwootConversationLastActivityAt(b)) ?? -Infinity;
        const aTime = parseChatwootTimestamp(getChatwootConversationLastActivityAt(a)) ?? -Infinity;
        return bTime - aTime;
      });
    const requestedConversationId = Number(request.nextUrl.searchParams.get("conversationId"));
    const requestedConversation = Number.isInteger(requestedConversationId) && requestedConversationId > 0
      ? allConversations.find((conversation) => conversation.id === requestedConversationId)
      : null;
    const conversations = allConversations.slice(0, 5);
    if (
      requestedConversation &&
      !conversations.some((conversation) => conversation.id === requestedConversation.id)
    ) {
      conversations.splice(Math.max(conversations.length - 1, 0), 1, requestedConversation);
    }

    const history = await Promise.all(
      conversations.map(async (conversation) => {
        const messagesResponse = await staffChatwootRequest<{ payload?: RawChatwootHistoryMessage[] }>(
          baseUrl,
          apiAccessToken,
          `/api/v1/accounts/${accountId}/conversations/${conversation.id}/messages`,
        );

        const rawMessages = Array.isArray(messagesResponse.payload) ? messagesResponse.payload : [];
        const normalizedMessages = normalizeChatwootHistoryMessages(rawMessages);
        const rawMessageById = new Map(
          rawMessages
            .filter((message) => message.id)
            .map((message) => [message.id as number, message]),
        );
        const visibleMessages = normalizedMessages.map((message) => {
          const rawMessage = rawMessageById.get(message.id);
          if (!rawMessage || rawMessage.created_at === undefined) return message;

          return {
            ...message,
            createdAt: normalizeChatwootTimestamp(rawMessage.created_at),
          };
        });

        return {
          id: conversation.id,
          status: conversation.status || null,
          canReply: conversation.can_reply ?? null,
          messages: visibleMessages.slice(-80),
          ...getChatwootConversationFreshness(conversation, visibleMessages),
        };
      }),
    );

    history.sort(compareChatwootConversationFreshness);

    return NextResponse.json({ conversations: history });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/chatwoot-contacts/history] unexpected error:", error);
    return NextResponse.json({ error: "讀取對話紀錄失敗" }, { status: 500 });
  }
}
