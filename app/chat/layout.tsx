import { AuthProvider } from "@/components/auth/AuthProvider";
import { ChatLayoutShell } from "@/components/chat-v2/ChatLayoutShell";

export const metadata = {
  title: "醫天圓 AI 體質諮詢",
  description: "AI 驅動的中醫體質分析與諮詢系統",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ChatLayoutShell>{children}</ChatLayoutShell>
    </AuthProvider>
  );
}
