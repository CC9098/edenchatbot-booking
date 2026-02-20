"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import Image from "next/image";
import Link from "next/link";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <header className="chat-fixed-topbar">
        <div className="chat-fixed-topbar__inner">
          <div className="chat-fixed-topbar__spacer" />
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
          <Link href="/chat/symptoms" className="chat-fixed-topbar__action">
            我的症狀
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
