import { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";
import {
  buildChatwootComposerJsonBody,
  getChatwootConversationReplyError,
  getChatwootComposerText,
  isFailedChatwootDeliveryStatus,
  isAllowedChatwootComposerAttachment,
} from "@/lib/staff-chatwoot-composer";
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
  can_reply?: boolean | null;
};

async function findContactConversation(
  baseUrl: string,
  apiAccessToken: string,
  accountId: number,
  contactId: number,
  conversationId: number,
) {
  const conversationsResponse = await staffChatwootRequest<{ payload?: ChatwootConversation[] }>(
    baseUrl,
    apiAccessToken,
    `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
  );

  return (conversationsResponse.payload || []).find((conversation) => conversation.id === conversationId) || null;
}

async function postChatwootMessage({
  baseUrl,
  apiAccessToken,
  accountId,
  conversationId,
  content,
  attachment,
}: {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  conversationId: number;
  content: string;
  attachment: File | null;
}) {
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

  if (!attachment) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        api_access_token: apiAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildChatwootComposerJsonBody(content)),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[Chatwoot] ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json() as Promise<RawChatwootHistoryMessage>;
  }

  const formData = new FormData();
  formData.set("content", content);
  formData.set("message_type", "outgoing");
  formData.set("private", "false");
  formData.set("attachments[]", attachment, attachment.name || "image");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      api_access_token: apiAccessToken,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Chatwoot] ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<RawChatwootHistoryMessage>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string; conversationId: string } },
) {
  try {
    await requireStaffRoleWithChatwootEdenToolsToken(request);

    const contactId = Number(params.contactId);
    const conversationId = Number(params.conversationId);
    if (!Number.isInteger(contactId) || contactId <= 0 || !Number.isInteger(conversationId) || conversationId <= 0) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const requestContentType = request.headers.get("content-type") || "";
    let content = "";
    let attachment: File | null = null;

    if (requestContentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = getChatwootComposerText(String(formData.get("content") || "")) ?? "";
      const rawAttachment = formData.get("attachment");
      attachment = rawAttachment instanceof File && rawAttachment.size > 0 ? rawAttachment : null;
    } else {
      const body = await request.json().catch(() => ({}));
      content = getChatwootComposerText(String(body.content || "")) ?? "";
    }

    if (!content && !attachment) {
      return NextResponse.json({ error: "請輸入訊息或選擇圖片。" }, { status: 400 });
    }

    if (attachment && !isAllowedChatwootComposerAttachment(attachment)) {
      return NextResponse.json({ error: "暫時只支援 10MB 或以下圖片。" }, { status: 400 });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getStaffChatwootConfig();
    const accountId = await resolveStaffChatwootAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const conversation = await findContactConversation(
      baseUrl,
      apiAccessToken,
      accountId,
      contactId,
      conversationId,
    );

    if (!conversation) {
      return NextResponse.json({ error: "Conversation does not belong to this contact" }, { status: 404 });
    }

    const replyError = getChatwootConversationReplyError(conversation);
    if (replyError) {
      return NextResponse.json({ error: replyError }, { status: 409 });
    }

    const message = await postChatwootMessage({
      baseUrl,
      apiAccessToken,
      accountId,
      conversationId,
      content,
      attachment,
    });
    const [normalizedMessage] = normalizeChatwootHistoryMessages([message]);

    if (isFailedChatwootDeliveryStatus(message.status)) {
      return NextResponse.json({
        error: "WhatsApp 未能送出。請改用 approved template，或請病人先回覆 WhatsApp。",
        message: normalizedMessage || null,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: normalizedMessage || null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/chatwoot-contacts/messages] unexpected error:", error);
    return NextResponse.json({ error: "發送 Chatwoot 訊息失敗" }, { status: 500 });
  }
}
