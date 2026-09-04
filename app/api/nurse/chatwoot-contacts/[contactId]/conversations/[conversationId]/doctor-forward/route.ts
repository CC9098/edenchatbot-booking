import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";
import {
  getStaffChatwootConfig,
  resolveStaffChatwootAccountId,
  staffChatwootRequest,
} from "@/lib/staff-chatwoot-api";
import {
  buildChatwootDoctorForwardAttributes,
  buildChatwootDoctorForwardNote,
  getConfiguredChatwootDoctors,
  isChatwootDoctorAssignable,
  isExistingChatwootDoctorForward,
  isForwardableChatwootPatientMessage,
  parseChatwootDoctorAgentIds,
  type RawChatwootAgent,
  type StaffChatwootDoctor,
} from "@/lib/staff-chatwoot-doctor-forward";
import type { RawChatwootHistoryMessage } from "@/lib/staff-chatwoot-history";

export const dynamic = "force-dynamic";

const doctorForwardSchema = z.object({
  messageId: z.number().int().positive().max(2_147_483_646),
  doctorAgentId: z.number().int().positive(),
});

type ChatwootConversation = {
  id?: number;
  inbox_id?: number | null;
  meta?: {
    sender?: {
      id?: number | null;
    } | null;
  } | null;
};

type ChatwootMessageWithForwardMetadata = RawChatwootHistoryMessage & {
  content_attributes?: (RawChatwootHistoryMessage["content_attributes"] & {
    eden_tools?: {
      action?: unknown;
      source_message_id?: unknown;
      doctor_agent_id?: unknown;
      forwarded_by_user_id?: unknown;
      forwarded_by_role?: unknown;
    } | null;
  }) | null;
};

type RouteContext = {
  params: {
    contactId: string;
    conversationId: string;
  };
};

function parseRouteIds(params: RouteContext["params"]) {
  const contactId = Number(params.contactId);
  const conversationId = Number(params.conversationId);
  if (
    !Number.isSafeInteger(contactId) ||
    contactId <= 0 ||
    !Number.isSafeInteger(conversationId) ||
    conversationId <= 0
  ) {
    return null;
  }

  return { contactId, conversationId };
}

async function resolveContactConversation({
  baseUrl,
  apiAccessToken,
  accountId,
  contactId,
  conversationId,
}: {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  contactId: number;
  conversationId: number;
}) {
  const conversation = await staffChatwootRequest<ChatwootConversation>(
    baseUrl,
    apiAccessToken,
    `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
  );

  if (
    conversation.id !== conversationId ||
    conversation.meta?.sender?.id !== contactId ||
    !Number.isSafeInteger(conversation.inbox_id) ||
    (conversation.inbox_id || 0) <= 0
  ) {
    return null;
  }

  return conversation as ChatwootConversation & { id: number; inbox_id: number };
}

async function getAssignableDoctors({
  baseUrl,
  apiAccessToken,
  accountId,
  inboxId,
}: {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number;
  inboxId: number;
}): Promise<StaffChatwootDoctor[]> {
  const configuredIds = parseChatwootDoctorAgentIds(process.env.CHATWOOT_DOCTOR_AGENT_IDS);
  if (configuredIds.length === 0) return [];

  const [agents, inboxMembersResponse] = await Promise.all([
    staffChatwootRequest<RawChatwootAgent[]>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/agents`,
    ),
    staffChatwootRequest<{ payload?: RawChatwootAgent[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/inbox_members/${inboxId}`,
    ),
  ]);
  const inboxMemberIds = (inboxMembersResponse.payload || [])
    .map((member) => member.id)
    .filter((id): id is number => Number.isSafeInteger(id) && (id || 0) > 0);
  const assignableAgents = agents.filter((agent) =>
    configuredIds.includes(agent.id || 0) && isChatwootDoctorAssignable(agent, inboxMemberIds),
  );

  return getConfiguredChatwootDoctors(assignableAgents, configuredIds);
}

function handleRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("[nurse/chatwoot doctor forward] unexpected error:", error);
  return NextResponse.json({ error: "轉交醫師失敗，請再試一次。" }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireStaffRoleWithChatwootEdenToolsToken(request);

    const routeIds = parseRouteIds(params);
    if (!routeIds) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getStaffChatwootConfig();
    const accountId = await resolveStaffChatwootAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const conversation = await resolveContactConversation({
      baseUrl,
      apiAccessToken,
      accountId,
      ...routeIds,
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation does not belong to this contact" }, { status: 404 });
    }

    const doctors = await getAssignableDoctors({
      baseUrl,
      apiAccessToken,
      accountId,
      inboxId: conversation.inbox_id,
    });

    return NextResponse.json({
      doctors,
      configured: parseChatwootDoctorAgentIds(process.env.CHATWOOT_DOCTOR_AGENT_IDS).length > 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId, staffRole } = await requireStaffRoleWithChatwootEdenToolsToken(request);
    const routeIds = parseRouteIds(params);
    if (!routeIds) {
      return NextResponse.json({ error: "Invalid conversation" }, { status: 400 });
    }

    const parsedBody = doctorForwardSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "請選擇病人訊息及醫師。" }, { status: 400 });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getStaffChatwootConfig();
    const accountId = await resolveStaffChatwootAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const conversation = await resolveContactConversation({
      baseUrl,
      apiAccessToken,
      accountId,
      ...routeIds,
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation does not belong to this contact" }, { status: 404 });
    }

    const doctors = await getAssignableDoctors({
      baseUrl,
      apiAccessToken,
      accountId,
      inboxId: conversation.inbox_id,
    });
    const doctor = doctors.find((candidate) => candidate.id === parsedBody.data.doctorAgentId);
    if (!doctor) {
      return NextResponse.json({ error: "所選醫師未有此 Chatwoot 對話權限。" }, { status: 400 });
    }

    const sourceMessagesResponse = await staffChatwootRequest<{ payload?: ChatwootMessageWithForwardMetadata[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/messages?before=${parsedBody.data.messageId + 1}`,
    );
    const sourceMessage = (sourceMessagesResponse.payload || []).find(
      (message) => message.id === parsedBody.data.messageId,
    );
    if (!sourceMessage || !isForwardableChatwootPatientMessage(sourceMessage, parsedBody.data.messageId)) {
      return NextResponse.json({ error: "只可以轉交本對話內嘅病人訊息。" }, { status: 400 });
    }

    const latestMessagesResponse = await staffChatwootRequest<{ payload?: ChatwootMessageWithForwardMetadata[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/messages`,
    );
    const existingForward = (latestMessagesResponse.payload || []).find((message) =>
      isExistingChatwootDoctorForward(
        message,
        parsedBody.data.messageId,
        parsedBody.data.doctorAgentId,
      ),
    );

    await staffChatwootRequest<RawChatwootAgent[]>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/participants`,
      {
        method: "POST",
        body: { user_ids: [doctor.id] },
      },
    );

    let forwardNote = existingForward || null;
    if (!forwardNote) {
      forwardNote = await staffChatwootRequest<ChatwootMessageWithForwardMetadata>(
        baseUrl,
        apiAccessToken,
        `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/messages`,
        {
          method: "POST",
          body: {
            content: buildChatwootDoctorForwardNote({
              baseUrl,
              accountId,
              conversationId: routeIds.conversationId,
              sourceMessageId: parsedBody.data.messageId,
              doctor,
            }),
            message_type: "outgoing",
            private: true,
            content_attributes: buildChatwootDoctorForwardAttributes({
              sourceMessageId: parsedBody.data.messageId,
              doctorAgentId: doctor.id,
              forwardedByUserId: userId,
              forwardedByRole: staffRole.role,
            }),
          },
        },
      );
    }

    if (!Number.isSafeInteger(forwardNote.id) || (forwardNote.id || 0) <= 0) {
      throw new Error("Chatwoot did not return a private note id");
    }

    const [participantsReadBack, noteReadBack] = await Promise.all([
      staffChatwootRequest<RawChatwootAgent[]>(
        baseUrl,
        apiAccessToken,
        `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/participants`,
      ),
      staffChatwootRequest<{ payload?: ChatwootMessageWithForwardMetadata[] }>(
        baseUrl,
        apiAccessToken,
        `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}/messages?before=${(forwardNote.id as number) + 1}`,
      ),
    ]);
    const participantSaved = participantsReadBack.some((participant) => participant.id === doctor.id);
    const noteSaved = (noteReadBack.payload || []).some((message) =>
      message.id === forwardNote?.id &&
      isExistingChatwootDoctorForward(message, parsedBody.data.messageId, doctor.id),
    );
    if (!participantSaved || !noteSaved) {
      throw new Error("Chatwoot doctor forward read-back failed");
    }

    const conversationPath = `/api/v1/accounts/${accountId}/conversations/${routeIds.conversationId}`;
    const current = await staffChatwootRequest<{ custom_attributes?: Record<string, unknown> }>(baseUrl, apiAccessToken, conversationPath);
    // A repeated forward must not reopen a task the doctor has already completed.
    if (!existingForward || !current.custom_attributes?.eden_workspace) {
      const previous = (current.custom_attributes?.eden_workspace || {}) as Record<string, unknown>;
      const revision = crypto.randomUUID();
      await staffChatwootRequest(baseUrl, apiAccessToken, `${conversationPath}/assignments`, {
        method: "POST", body: { assignee_id: doctor.id },
      });
      await staffChatwootRequest(baseUrl, apiAccessToken, `${conversationPath}/custom_attributes`, {
        method: "POST", body: { custom_attributes: {
          eden_flow_state: "human",
          eden_workspace: { ...previous, stage: "doctor", doctorId: doctor.id, doctorName: doctor.name, ownerId: null, ownerName: doctor.name, revision, updatedAt: new Date().toISOString() },
        } },
      });
      await staffChatwootRequest(baseUrl, apiAccessToken, `${conversationPath}/toggle_status`, { method: "POST", body: { status: "open" } });
      const saved = await staffChatwootRequest<{ status?: string; meta?: { assignee?: { id?: number } }; custom_attributes?: { eden_flow_state?: string; eden_workspace?: { revision?: string } } }>(baseUrl, apiAccessToken, conversationPath);
      if (saved.status !== "open" || saved.meta?.assignee?.id !== doctor.id || saved.custom_attributes?.eden_flow_state !== "human" || saved.custom_attributes?.eden_workspace?.revision !== revision) {
        throw new Error("Eden doctor queue read-back failed");
      }
    }

    console.info(
      `[nurse/chatwoot doctor forward] staff=${userId} role=${staffRole.role} conversation=${routeIds.conversationId} message=${parsedBody.data.messageId} doctor=${doctor.id} duplicate=${Boolean(existingForward)}`,
    );

    return NextResponse.json({
      success: true,
      doctor,
      messageId: parsedBody.data.messageId,
      duplicate: Boolean(existingForward),
      verified: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
