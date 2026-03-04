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
  const topbarInnerClassName =
    "chat-fixed-topbar__inner !flex !min-h-[52px] !items-center !justify-between !gap-2.5 !rounded-[18px] !border !border-[rgba(92,118,95,0.14)] !bg-[#F5F7F2] !px-3 !shadow-[0_6px_16px_rgba(36,61,41,0.06)] max-[440px]:!min-h-[50px] max-[440px]:!gap-1.5 max-[440px]:!px-2.5";
  const topbarStartClassName = "chat-fixed-topbar__start flex min-w-0 flex-1 items-center gap-2";
  const menuClassName =
    "chat-fixed-topbar__menu chat-fixed-topbar__menu--inline !m-0 !inline-flex !min-h-10 !min-w-10 !items-center !justify-center !rounded-[10px] !border-0 !bg-transparent !p-0 !text-[#4d7054] transition-colors hover:!bg-[rgba(111,141,114,0.10)] max-[440px]:!min-h-[38px] max-[440px]:!min-w-[38px]";
  const actionClassName =
    "chat-fixed-topbar__action !min-h-10 !rounded-none !border-0 !bg-transparent !px-3 !text-[14px] !font-bold !text-[#4b6e52] no-underline transition-colors hover:!bg-[rgba(111,141,114,0.10)] max-[440px]:!min-h-[38px] max-[440px]:!px-2.5 max-[440px]:!text-[13px]";
  const logoutClassName = `${actionClassName} !border-l !border-l-[rgba(92,118,95,0.16)] !text-[#8b4a4a]`;

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
        <div className={topbarInnerClassName}>
          <div className={topbarStartClassName}>
            <ClinicBrandLink href="/chat" />
            {isChatHome ? (
              <button
                type="button"
                onClick={toggleHistory}
                className={menuClassName}
                aria-label="開啟對話歷史"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : null}
          </div>
          <div className="chat-fixed-topbar__actions !flex !flex-none !items-center !justify-end !gap-0">
            <Link href={actionHref} className={actionClassName}>
              {actionLabel}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className={`${logoutClassName} chat-fixed-topbar__action--logout`}
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
