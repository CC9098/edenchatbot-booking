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

export const dynamic = "force-dynamic";

type ChatwootConversation = {
  id?: number;
  status?: string | null;
  inbox_id?: number | null;
  created_at?: number | string | null;
  updated_at?: number | string | null;
  last_activity_at?: number | string | null;
};

function getNumericTime(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
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
    const conversationsResponse = await staffChatwootRequest<{ payload?: ChatwootConversation[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
    );

    const conversations = (conversationsResponse.payload || [])
      .filter((conversation) => conversation.id)
      .sort((a, b) => {
        const bTime = getNumericTime(b.last_activity_at || b.updated_at || b.created_at);
        const aTime = getNumericTime(a.last_activity_at || a.updated_at || a.created_at);
        return bTime - aTime;
      })
      .slice(0, 5);

    const history = await Promise.all(
      conversations.map(async (conversation) => {
        const messagesResponse = await staffChatwootRequest<{ payload?: RawChatwootHistoryMessage[] }>(
          baseUrl,
          apiAccessToken,
          `/api/v1/accounts/${accountId}/conversations/${conversation.id}/messages`,
        );

        return {
          id: conversation.id,
          status: conversation.status || null,
          messages: normalizeChatwootHistoryMessages(messagesResponse.payload || []).slice(-80),
        };
      }),
    );

    return NextResponse.json({ conversations: history });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/chatwoot-contacts/history] unexpected error:", error);
    return NextResponse.json({ error: "讀取對話紀錄失敗" }, { status: 500 });
  }
}
