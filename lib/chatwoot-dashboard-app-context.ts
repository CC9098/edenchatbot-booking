export type ChatwootDashboardAppContext = {
  conversationId: number | null;
  inboxId: number | null;
  contactId: number | null;
  contactName: string;
  contactPhone: string;
  currentAgentName: string;
  currentAgentEmail: string;
  latestIncomingMessage: string;
};

export type ChatwootDashboardMessage = {
  content?: unknown;
  private?: unknown;
  message_type?: unknown;
  created_at?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseEventData(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isIncomingMessage(message: ChatwootDashboardMessage): boolean {
  return (
    message.message_type === 0 ||
    message.message_type === "0" ||
    message.message_type === "incoming"
  );
}

export function selectLatestForwardableMessage(messages: ChatwootDashboardMessage[]): string {
  return [...messages]
    .filter((message) => {
      return message.private !== true && isIncomingMessage(message) && asString(message.content);
    })
    .sort((left, right) => {
      return Number(right.created_at || 0) - Number(left.created_at || 0);
    })
    .map((message) => asString(message.content))
    .find(Boolean) || "";
}

export function parseChatwootDashboardAppEvent(value: unknown): ChatwootDashboardAppContext | null {
  const eventData = parseEventData(value);
  if (!eventData || eventData.event !== "appContext") {
    return null;
  }

  const data = asRecord(eventData.data);
  if (!data) return null;

  const conversation = asRecord(data.conversation);
  const contact = asRecord(data.contact);
  const currentAgent = asRecord(data.currentAgent);
  const meta = asRecord(conversation?.meta);
  const sender = asRecord(meta?.sender);
  const contactSource = contact || sender;
  const messages = Array.isArray(conversation?.messages)
    ? conversation.messages.filter(isRecord)
    : [];

  return {
    conversationId: asNumber(conversation?.id),
    inboxId: asNumber(conversation?.inbox_id),
    contactId: asNumber(contactSource?.id),
    contactName: asString(contactSource?.name),
    contactPhone: asString(contactSource?.phone_number),
    currentAgentName: asString(currentAgent?.name),
    currentAgentEmail: asString(currentAgent?.email),
    latestIncomingMessage: selectLatestForwardableMessage(messages),
  };
}
