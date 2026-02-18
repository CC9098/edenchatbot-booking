"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogOut, Leaf } from "lucide-react";
import Link from "next/link";

function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-primary/10 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Leaf className="h-5 w-5 text-primary" />
        <h1 className="text-sm font-bold text-primary whitespace-nowrap">
          醫天圓 AI 諮詢
        </h1>
        <nav className="hidden items-center gap-1.5 sm:flex">
          <Link
            href="/articles"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-primary-light hover:text-primary"
          >
            文章
          </Link>
          <Link
            href="/courses"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-primary-light hover:text-primary"
          >
            課程
          </Link>
          <Link
            href="/booking"
            className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition hover:bg-primary-light hover:text-primary"
          >
            預約
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/chat/symptoms"
          className="rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary-light"
        >
          我的症狀
        </Link>
        {user && (
          <span className="hidden text-xs text-gray-500 sm:inline">
            {user.email}
          </span>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600"
          title="登出"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">登出</span>
        </button>
      </div>
    </header>
  );
}

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-[#f5f7f3]">
        <Header />
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
