import type { RawChatwootHistoryMessage } from "@/lib/staff-chatwoot-history";

export const CHATWOOT_DOCTOR_FORWARD_ACTION = "eden_tools_doctor_forward";

export type RawChatwootAgent = {
  id?: number;
  name?: string | null;
  role?: string | null;
  confirmed?: boolean | null;
  availability_status?: string | null;
};

export type StaffChatwootDoctor = {
  id: number;
  name: string;
  availabilityStatus: string | null;
};

type DoctorForwardMetadata = {
  action?: unknown;
  source_message_id?: unknown;
  doctor_agent_id?: unknown;
  forwarded_by_user_id?: unknown;
  forwarded_by_role?: unknown;
};

type RawDoctorForwardMessage = RawChatwootHistoryMessage & {
  content_attributes?: (RawChatwootHistoryMessage["content_attributes"] & {
    eden_tools?: DoctorForwardMetadata | null;
  }) | null;
};

export function parseChatwootDoctorAgentIds(value: string | null | undefined): number[] {
  const ids = String(value || "")
    .split(/[\s,]+/)
    .map((candidate) => Number(candidate))
    .filter((candidate) => Number.isSafeInteger(candidate) && candidate > 0);

  return Array.from(new Set(ids));
}

export function getConfiguredChatwootDoctors(
  agents: RawChatwootAgent[],
  configuredIds: number[],
): StaffChatwootDoctor[] {
  const agentById = new Map(
    agents
      .filter((agent) => Number.isSafeInteger(agent.id) && (agent.id || 0) > 0)
      .map((agent) => [agent.id as number, agent]),
  );

  return configuredIds.flatMap((id) => {
    const agent = agentById.get(id);
    const name = agent?.name?.trim();
    if (!agent || !name || agent.confirmed === false) return [];

    return [{
      id,
      name,
      availabilityStatus: agent.availability_status || null,
    }];
  });
}

export function isChatwootDoctorAssignable(
  agent: RawChatwootAgent,
  inboxMemberIds: number[],
): boolean {
  if (agent.role === "administrator") return true;
  return typeof agent.id === "number" && inboxMemberIds.includes(agent.id);
}

export function isForwardableChatwootPatientMessage(
  message: RawChatwootHistoryMessage,
  expectedMessageId: number,
): boolean {
  const incoming = message.message_type === 0 || message.message_type === "incoming";
  const hasContent = Boolean(message.content?.trim());
  const hasAttachment = Boolean(message.attachments?.some((attachment) => attachment.id));

  return message.id === expectedMessageId && incoming && message.private !== true && (hasContent || hasAttachment);
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/[\\\[\]]/g, "\\$&");
}

export function buildChatwootDoctorForwardNote({
  baseUrl,
  accountId,
  conversationId,
  sourceMessageId,
  doctor,
}: {
  baseUrl: string;
  accountId: number;
  conversationId: number;
  sourceMessageId: number;
  doctor: Pick<StaffChatwootDoctor, "id" | "name">;
}): string {
  const conversationUrl = new URL(
    `/app/accounts/${accountId}/conversations/${conversationId}`,
    `${baseUrl.replace(/\/$/, "")}/`,
  );
  conversationUrl.searchParams.set("messageId", String(sourceMessageId));

  const mention = `[@${escapeMarkdownLabel(doctor.name)}](mention://user/${doctor.id}/${encodeURIComponent(doctor.name)})`;

  return [
    `${mention} 姑娘已轉交一則病人訊息。`,
    `[開啟指定訊息](${conversationUrl.toString()})`,
    "請喺同一對話用 Reply 回覆病人。",
  ].join("\n\n");
}

export function buildChatwootDoctorForwardAttributes({
  sourceMessageId,
  doctorAgentId,
  forwardedByUserId,
  forwardedByRole,
}: {
  sourceMessageId: number;
  doctorAgentId: number;
  forwardedByUserId: string;
  forwardedByRole: string;
}) {
  return {
    eden_tools: {
      action: CHATWOOT_DOCTOR_FORWARD_ACTION,
      source_message_id: sourceMessageId,
      doctor_agent_id: doctorAgentId,
      forwarded_by_user_id: forwardedByUserId,
      forwarded_by_role: forwardedByRole,
    },
  };
}

export function isExistingChatwootDoctorForward(
  message: RawDoctorForwardMessage,
  sourceMessageId: number,
  doctorAgentId: number,
): boolean {
  const metadata = message.content_attributes?.eden_tools;
  return message.private === true &&
    metadata?.action === CHATWOOT_DOCTOR_FORWARD_ACTION &&
    metadata.source_message_id === sourceMessageId &&
    metadata.doctor_agent_id === doctorAgentId;
}
