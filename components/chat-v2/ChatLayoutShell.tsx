"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="mx-auto flex min-h-[calc(100dvh-130px)] w-full max-w-[760px] flex-col px-4 pt-5">
        <main className="patient-card flex min-h-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
