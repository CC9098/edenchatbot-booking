export const CHATBOT_PROMPT_TYPES = ["depleting", "crossing", "hoarding"] as const;

export type ChatbotPromptType = (typeof CHATBOT_PROMPT_TYPES)[number];

export const CHATBOT_PROMPT_LABELS: Record<ChatbotPromptType, string> = {
  depleting: "虛耗型",
  crossing: "交錯型",
  hoarding: "屯積型",
};

export const CHATBOT_PROMPT_DESCRIPTIONS: Record<ChatbotPromptType, string> = {
  depleting: "偏向需要溫和扶正、減少耗散感的對話方向。",
  crossing: "偏向身心交錯、節奏失衡時的整理與釐清。",
  hoarding: "偏向積滯、悶住、卡住感的鬆動式回應。",
};

export function isChatbotPromptType(value: string): value is ChatbotPromptType {
  return CHATBOT_PROMPT_TYPES.includes(value as ChatbotPromptType);
}

export function sortChatbotPromptItems<T extends { type: string }>(items: T[]): T[] {
  const order = new Map(CHATBOT_PROMPT_TYPES.map((type, index) => [type, index]));
  return [...items].sort((a, b) => {
    const left = order.get(a.type as ChatbotPromptType) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(b.type as ChatbotPromptType) ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}
