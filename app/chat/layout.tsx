import { AuthProvider } from "@/components/auth/AuthProvider";
import { ChatLayoutShell } from "@/components/chat-v2/ChatLayoutShell";

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
