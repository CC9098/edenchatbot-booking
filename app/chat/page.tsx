import { ChatRoom } from "@/components/chat-v2/ChatRoom";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "醫天圓 AI 體質諮詢",
  description: "AI 驅動的中醫體質分析與諮詢系統",
};

export default function ChatPage() {
  return <ChatRoom />;
}
