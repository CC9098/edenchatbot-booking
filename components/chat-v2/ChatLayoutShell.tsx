"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import { LogOut, MessageCircle, Leaf, Menu, X } from "lucide-react";
import { useState } from "react";

const CONSTITUTION_TYPES = [
  { type: "depleting", label: "虛損型", icon: "💧", desc: "氣血虧虛" },
  { type: "crossing", label: "交叉型", icon: "🔄", desc: "寒熱交雜" },
  { type: "hoarding", label: "積滯型", icon: "🪨", desc: "痰瘀阻滯" },
] as const;

function SidebarContent({ currentType }: { currentType: string }) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#2d5016]/50">
        體質類型
      </div>
      {CONSTITUTION_TYPES.map(({ type, label, icon, desc }) => {
        const isActive = currentType === type;
        return (
          <Link
            key={type}
            href={`/chat/${type}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-[#2d5016] text-white shadow-md"
                : "text-gray-600 hover:bg-[#2d5016]/5 hover:text-[#2d5016]"
            }`}
          >
            <span className="text-lg">{icon}</span>
            <div className="flex flex-col">
              <span>{label}</span>
              <span
                className={`text-[11px] ${
                  isActive ? "text-white/70" : "text-gray-400"
                }`}
              >
                {desc}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function Header() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const currentType =
    CONSTITUTION_TYPES.find((t) => pathname?.includes(t.type))?.label ?? "";

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#2d5016]/10 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg p-1.5 text-[#2d5016] hover:bg-[#2d5016]/5 lg:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Leaf className="h-5 w-5 text-[#2d5016]" />
        <h1 className="text-sm font-bold text-[#2d5016]">
          醫天圓 AI 諮詢
          {currentType && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {currentType}
            </span>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-3">
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

      {/* Mobile dropdown nav */}
      {menuOpen && (
        <div
          className="absolute left-0 top-14 z-50 w-full border-b border-[#2d5016]/10 bg-white shadow-lg lg:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <SidebarContent
            currentType={
              CONSTITUTION_TYPES.find((t) => pathname?.includes(t.type))
                ?.type ?? ""
            }
          />
        </div>
      )}
    </header>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const currentType =
    CONSTITUTION_TYPES.find((t) => pathname?.includes(t.type))?.type ?? "";

  return (
    <nav className="flex h-16 items-center justify-around border-t border-[#2d5016]/10 bg-white lg:hidden">
      {CONSTITUTION_TYPES.map(({ type, label, icon }) => {
        const isActive = currentType === type;
        return (
          <Link
            key={type}
            href={`/chat/${type}`}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-[11px] font-medium transition ${
              isActive ? "text-[#2d5016]" : "text-gray-400"
            }`}
          >
            <span className="text-xl">{icon}</span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ChatLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-[#f5f7f3]">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden w-56 flex-shrink-0 border-r border-[#2d5016]/10 bg-white lg:block">
            <SidebarContent
              currentType={
                CONSTITUTION_TYPES.find((t) => pathname?.includes(t.type))
                  ?.type ?? ""
              }
            />
          </aside>

          {/* Main content */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </div>

        {/* Mobile bottom tabs */}
        <BottomTabs />
      </div>
    </AuthGuard>
  );
}
