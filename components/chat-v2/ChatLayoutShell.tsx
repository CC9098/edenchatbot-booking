"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatShellProvider, useChatShell } from "./ChatShellContext";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatShellProvider>
      <ChatLayoutFrame>{children}</ChatLayoutFrame>
    </ChatShellProvider>
  );
}

function ChatLayoutFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toggleHistory } = useChatShell();
  const isChatHome = pathname === "/chat";
  const isSymptomsPage = pathname.startsWith("/chat/symptoms");
  const actionHref = isSymptomsPage ? "/chat" : "/chat/symptoms";
  const actionLabel = isSymptomsPage ? "返回聊天" : "我的症狀";

  return (
    <AuthGuard>
      <header className="chat-fixed-topbar">
        <div className="chat-fixed-topbar__inner">
          {isChatHome ? (
            <button
              type="button"
              onClick={toggleHistory}
              className="chat-fixed-topbar__menu"
              aria-label="開啟對話歷史"
            >
              <Menu className="h-6 w-6" />
            </button>
          ) : (
            <div className="chat-fixed-topbar__spacer" />
          )}
          <Link href="/chat" className="chat-fixed-topbar__brand">
            <Image
              src="/logo-eden.png"
              alt="Eden logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover"
            />
            <span>Eden Care</span>
          </Link>
          <Link href={actionHref} className="chat-fixed-topbar__action">
            {actionLabel}
          </Link>
        </div>
      </header>

      <div className="chat-content-offset mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-[760px] flex-col px-4">
        <main className="patient-card flex min-h-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
