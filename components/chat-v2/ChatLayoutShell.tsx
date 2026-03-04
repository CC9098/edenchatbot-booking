"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import { ClinicBrandLink } from "@/components/brand/ClinicBrandLink";
import { isNativeAppRuntime } from "@/lib/platform";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PatientDesktopTabs } from "@/components/patient/patient-navigation";
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
  const [isNativeShell, setIsNativeShell] = useState(() => isNativeAppRuntime());
  const isChatHome = pathname === "/chat";
  const isSymptomsPage = pathname.startsWith("/chat/symptoms");
  const actionHref = isSymptomsPage ? "/chat" : "/chat/symptoms";
  const actionLabel = isSymptomsPage ? "返回聊天" : "身體狀態";
  const topbarInnerClassName = isNativeShell
    ? "chat-fixed-topbar__inner !grid !grid-cols-[40px_minmax(0,1fr)_auto] !min-h-[52px] !items-center !gap-2 !rounded-[18px] !border !px-3 max-[440px]:!grid-cols-[38px_minmax(0,1fr)_auto] max-[440px]:!min-h-[50px] max-[440px]:!gap-1.5 max-[440px]:!px-2.5"
    : "chat-fixed-topbar__inner !flex !min-h-[52px] !items-center !justify-between !gap-2.5 !rounded-[18px] !border !border-[rgba(92,118,95,0.14)] !bg-[#F5F7F2] !px-3 !shadow-[0_6px_16px_rgba(36,61,41,0.06)] max-[440px]:!min-h-[50px] max-[440px]:!gap-1.5 max-[440px]:!px-2.5";
  const topbarInnerStyle = isNativeShell
    ? {
        borderColor: "rgba(53, 104, 66, 0.95)",
        background: "linear-gradient(180deg, #4b8158 0%, #3f784d 100%)",
        boxShadow: "0 8px 18px rgba(35, 56, 39, 0.16)",
      }
    : undefined;
  const topbarStartClassName = "chat-fixed-topbar__start flex min-w-0 flex-1 items-center gap-2";
  const menuClassName = isNativeShell
    ? "chat-fixed-topbar__menu chat-fixed-topbar__menu--inline !m-0 !inline-flex !min-h-10 !min-w-10 !items-center !justify-center !rounded-[10px] !border-0 !bg-transparent !p-0 !text-[#f7fbf5] transition-colors hover:!bg-[rgba(247,251,245,0.18)] max-[440px]:!min-h-[38px] max-[440px]:!min-w-[38px]"
    : "chat-fixed-topbar__menu chat-fixed-topbar__menu--inline !m-0 !inline-flex !min-h-10 !min-w-10 !items-center !justify-center !rounded-[10px] !border-0 !bg-transparent !p-0 !text-[#4d7054] transition-colors hover:!bg-[rgba(111,141,114,0.10)] max-[440px]:!min-h-[38px] max-[440px]:!min-w-[38px]";
  const actionClassName = isNativeShell
    ? "chat-fixed-topbar__action !min-h-10 !rounded-[10px] !border-0 !bg-transparent !px-3 !text-[14px] !font-bold !text-[#f7fbf5] no-underline transition-colors hover:!bg-[rgba(247,251,245,0.18)] max-[440px]:!min-h-[38px] max-[440px]:!px-2.5 max-[440px]:!text-[13px]"
    : "chat-fixed-topbar__action !min-h-10 !rounded-none !border-0 !bg-transparent !px-3 !text-[14px] !font-bold !text-[#4b6e52] no-underline transition-colors hover:!bg-[rgba(111,141,114,0.10)] max-[440px]:!min-h-[38px] max-[440px]:!px-2.5 max-[440px]:!text-[13px]";
  const logoutClassName = isNativeShell
    ? `${actionClassName} !border-l !border-l-[rgba(247,251,245,0.22)] !text-[#ffe1e1]`
    : `${actionClassName} !border-l !border-l-[rgba(92,118,95,0.16)] !text-[#8b4a4a]`;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const syncNativeShell = () => {
      if (cancelled) return;
      setIsNativeShell(isNativeAppRuntime());
    };

    syncNativeShell();
    const retryDelays = [120, 320, 760, 1600];
    const retryTimers = retryDelays.map((delay) => window.setTimeout(syncNativeShell, delay));

    window.addEventListener("focus", syncNativeShell);
    window.addEventListener("pageshow", syncNativeShell);
    document.addEventListener("visibilitychange", syncNativeShell);

    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", syncNativeShell);
      window.removeEventListener("pageshow", syncNativeShell);
      document.removeEventListener("visibilitychange", syncNativeShell);
    };
  }, []);

  return (
    <AuthGuard>
      <header className="chat-fixed-topbar">
        <div className={topbarInnerClassName} style={topbarInnerStyle}>
          {isNativeShell ? (
            <>
              {isChatHome ? (
                <button
                  type="button"
                  onClick={toggleHistory}
                  className={menuClassName}
                  aria-label="開啟對話歷史"
                >
                  <Menu className="h-5 w-5" />
                </button>
              ) : (
                <div className="chat-fixed-topbar__spacer !h-10 !w-10" aria-hidden="true" />
              )}
              <div className="min-w-0 flex items-center justify-center">
                <ClinicBrandLink href="/chat" variant="native" />
              </div>
            </>
          ) : (
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
          )}

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
        <PatientDesktopTabs pathname={pathname} className="mb-4 hidden min-[1025px]:block" />
        <main className="patient-card flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
