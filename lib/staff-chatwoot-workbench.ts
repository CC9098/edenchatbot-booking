export type StaffChatwootWorkbenchMessage = {
  id: number;
  direction: "incoming" | "outgoing";
  content: string;
  createdAt: string | null;
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
