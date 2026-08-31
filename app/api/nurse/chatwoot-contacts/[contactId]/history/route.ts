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
  getChatwootConversationFreshness,
} from "@/lib/staff-chatwoot-conversation-freshness";
import {
  compareChatwootConversationSummaries,
  getChatwootConversationSummaryFreshness,
} from "@/lib/staff-chatwoot-conversation-summary";
import {
  buildChatwootContactConversationFilterBody,
  getChatwootMessagePageState,
} from "@/lib/staff-chatwoot-history-pagination";

export const dynamic = "force-dynamic";

type ChatwootConversation = {
  id?: number;
  status?: string | null;
  can_reply?: boolean | null;
  inbox_id?: number | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  last_activity_at?: number | string | null;
  last_non_activity_message?: Pick<
    RawChatwootHistoryMessage,
    "id" | "created_at" | "message_type" | "private"
  > | null;
  meta?: {
    sender?: {
      id?: number | null;
    } | null;
  } | null;
};

type ChatwootConversationFilterResponse = {
  payload?: ChatwootConversation[];
  meta?: {
    all_count?: number;
  };
};

async function fetchAllContactConversations({
  baseUrl,
  apiAccessToken,
  accountId,
  contactId,
}: {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  contactId: number;
}) {
  const conversationById = new Map<number, ChatwootConversation>();
  let reportedTotal: number | null = null;

  for (let page = 1; ; page += 1) {
    const conversationCountBeforePage = conversationById.size;
    const response = await staffChatwootRequest<ChatwootConversationFilterResponse>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/conversations/filter`,
      {
        method: "POST",
        body: buildChatwootContactConversationFilterBody(contactId, page),
      },
    );
    const pageConversations = (Array.isArray(response.payload) ? response.payload : [])
      .filter(
        (conversation): conversation is ChatwootConversation & { id: number } =>
          Boolean(conversation.id && conversation.meta?.sender?.id === contactId),
      );

    for (const conversation of pageConversations) {
      conversationById.set(conversation.id, conversation);
    }

    const nextReportedTotal = Number(response.meta?.all_count);
    if (Number.isSafeInteger(nextReportedTotal) && nextReportedTotal >= 0) {
      reportedTotal = nextReportedTotal;
    }

    if (reportedTotal !== null && conversationById.size >= reportedTotal) break;
    if (pageConversations.length === 0) break;
    if (conversationById.size === conversationCountBeforePage) break;
  }

  if (reportedTotal !== null && conversationById.size < reportedTotal) {
    throw new Error(
      `[Chatwoot] Incomplete contact conversation history: ${conversationById.size}/${reportedTotal}`,
    );
  }

  return {
    conversations: Array.from(conversationById.values()).sort(compareChatwootConversationSummaries),
    reportedTotal,
    hasMore: false,
  };
}

async function fetchConversationMessagePage({
  baseUrl,
  apiAccessToken,
  accountId,
  conversation,
}: {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  conversation: ChatwootConversation & { id: number };
}) {
  const messagesResponse = await staffChatwootRequest<{ payload?: RawChatwootHistoryMessage[] }>(
    baseUrl,
    apiAccessToken,
    `/api/v1/accounts/${accountId}/conversations/${conversation.id}/messages`,
  );
  const rawMessages = Array.isArray(messagesResponse.payload) ? messagesResponse.payload : [];
  const visibleMessages = normalizeChatwootHistoryMessages(rawMessages);
  const pageState = getChatwootMessagePageState(rawMessages);

  return {
    id: conversation.id,
    status: conversation.status || null,
    canReply: conversation.can_reply ?? null,
    messages: visibleMessages,
    messagesLoaded: true,
    nextBefore: pageState.nextBefore,
    hasMoreMessages: pageState.hasMore,
    ...getChatwootConversationFreshness(conversation, visibleMessages),
  };
}

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
    const conversationResult = await fetchAllContactConversations({
      baseUrl,
      apiAccessToken,
      accountId,
      contactId,
    });
    const allConversations = conversationResult.conversations;
    const requestedConversationValue = request.nextUrl.searchParams.get("conversationId");
    const requestedConversationId = Number(requestedConversationValue);
    if (
      requestedConversationValue !== null &&
      (!Number.isInteger(requestedConversationId) || requestedConversationId <= 0)
    ) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }
    const requestedConversation = requestedConversationValue !== null
      ? allConversations.find((conversation) => conversation.id === requestedConversationId) || null
      : null;
    if (requestedConversationValue !== null && !requestedConversation) {
      return NextResponse.json(
        { error: "Conversation does not belong to this contact" },
        { status: 404 },
      );
    }
    const activeConversation = requestedConversation || allConversations[0] || null;
    const activeConversationPage = activeConversation?.id
      ? await fetchConversationMessagePage({
          baseUrl,
          apiAccessToken,
          accountId,
          conversation: activeConversation as ChatwootConversation & { id: number },
        })
      : null;

    const history = allConversations.map((conversation) => {
      if (activeConversationPage && conversation.id === activeConversationPage.id) {
        return activeConversationPage;
      }

      return {
        id: conversation.id as number,
        status: conversation.status || null,
        canReply: conversation.can_reply ?? null,
        messages: [],
        messagesLoaded: false,
        nextBefore: null,
        hasMoreMessages: false,
        ...getChatwootConversationSummaryFreshness(conversation),
      };
    });

    if (requestedConversation?.id) {
      history.sort((a, b) => {
        if (a.id === requestedConversation.id) return -1;
        if (b.id === requestedConversation.id) return 1;
        return 0;
      });
    }

    return NextResponse.json({
      conversations: history,
      conversationCount: conversationResult.reportedTotal ?? history.length,
      hasMoreConversations: conversationResult.hasMore,
      activeConversationId: activeConversation?.id || null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/chatwoot-contacts/history] unexpected error:", error);
    return NextResponse.json({ error: "讀取對話紀錄失敗" }, { status: 500 });
  }
}
