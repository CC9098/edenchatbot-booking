export type StaffChatwootWorkbenchMessage = {
  id: number;
  direction: "incoming" | "outgoing";
  content: string;
  createdAt: string | null;
  status: string | null;
  sourceId: string | null;
  attachments: Array<{
    id: number;
    fileType: string;
    url: string;
    label: string;
  }>;
};

export type StaffChatwootWorkbenchConversation = {
  id: number;
  status: string | null;
  canReply?: boolean | null;
  messages: StaffChatwootWorkbenchMessage[];
};

export function appendChatwootWorkbenchMessage(
  conversations: StaffChatwootWorkbenchConversation[],
  conversationId: number,
  message: StaffChatwootWorkbenchMessage,
): StaffChatwootWorkbenchConversation[] {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    if (conversation.messages.some((currentMessage) => currentMessage.id === message.id)) {
      return conversation;
    }

    return {
      ...conversation,
      messages: [...conversation.messages, message].slice(-80),
    };
  });
}

export function getChatwootWorkbenchScrollKey(
  conversations: StaffChatwootWorkbenchConversation[],
  activeConversationId: number | null,
): string {
  if (!activeConversationId) return "";

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  if (!activeConversation) return "";

  const lastMessage = activeConversation.messages.at(-1);
  return `${activeConversation.id}:${activeConversation.messages.length}:${lastMessage?.id || 0}`;
}

export function getChatwootWorkbenchConversationStatusLabel(
  conversation: Pick<StaffChatwootWorkbenchConversation, "status" | "canReply">,
): string {
  if (conversation.canReply === false || conversation.status === "resolved") return "已關閉";
  if (conversation.status === "open") return "可回覆";
  if (conversation.status === "pending") return "待處理";
  if (conversation.status === "snoozed") return "稍後處理";
  return "";
}

export function canReplyToChatwootWorkbenchConversation(
  conversation: Pick<StaffChatwootWorkbenchConversation, "status" | "canReply">,
): boolean {
  if (conversation.canReply === false) return false;
  if (conversation.status === "resolved") return false;
  return true;
}
