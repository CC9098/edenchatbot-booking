"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import { ClinicBrandLink } from "@/components/brand/ClinicBrandLink";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChatShellProvider, useChatShell } from "./ChatShellContext";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <ChatShellProvider>
      <ChatLayoutFrame>{children}</ChatLayoutFrame>
    </ChatShellProvider>
  );
}

function ChatLayoutFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const pathname = usePathname();
  const { toggleHistory } = useChatShell();
  const [signingOut, setSigningOut] = useState(false);
  const isChatHome = pathname === "/chat";
  const isSymptomsPage = pathname.startsWith("/chat/symptoms");
  const actionHref = isSymptomsPage ? "/chat" : "/chat/symptoms";
  const actionLabel = isSymptomsPage ? "返回聊天" : "身體狀態";

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }, [router, signOut, signingOut]);

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
          <ClinicBrandLink href="/chat" />
          <div className="chat-fixed-topbar__actions">
            <Link href={actionHref} className="chat-fixed-topbar__action">
              {actionLabel}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="chat-fixed-topbar__action chat-fixed-topbar__action--logout"
            >
              {signingOut ? "登出中..." : "登出"}
            </button>
          </div>
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
