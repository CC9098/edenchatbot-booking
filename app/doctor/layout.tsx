"use client";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function DoctorHeader() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/doctor"
            className="flex items-center gap-2 text-primary font-bold text-base sm:text-lg shrink-0"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
              醫
            </span>
            <span className="hidden sm:inline">醫天圓 醫師控制台</span>
            <span className="sm:hidden">醫師控制台</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/doctor"
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === "/doctor"
                  ? "bg-primary/10 text-primary"
                  : "text-gray-600 hover:text-primary hover:bg-primary/5"
              }`}
            >
              病人列表
            </Link>
          </nav>
        </div>

        {/* Right: user + sign out */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-500 truncate max-w-[180px]">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="min-h-screen bg-[#f5f9f2]">
          <DoctorHeader />
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
