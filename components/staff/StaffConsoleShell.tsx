"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { StaffGuard } from "@/components/auth/StaffGuard";
import {
  getStaffWorkspaceConfig,
  isWorkspacePathActive,
  type StaffWorkspace,
} from "@/lib/staff-console-workspace";

function StaffConsoleHeader({ workspace }: { workspace: StaffWorkspace }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const config = getStaffWorkspaceConfig(workspace);
  const iconLabel = workspace === "nurse" ? "護" : "醫";
  const [staffStatus, setStaffStatus] = useState<{ role?: string; staffKind?: string | null } | null>(null);
  const isOnboardingFocus = workspace === "nurse" && pathname.startsWith("/nurse/onboarding");
  const isPartTimeAssistant =
    staffStatus?.role === "assistant" && staffStatus.staffKind === "part_time_assistant";
  const showSwitchLink =
    !isOnboardingFocus &&
    !isPartTimeAssistant &&
    workspace !== "doctor";
  const visibleNavItems = config.navItems.filter((item) => {
    if (item.managerOnly && staffStatus?.role !== "admin" && staffStatus?.role !== "doctor") return false;
    if (workspace === "doctor" && isPartTimeAssistant) return false;
    if (isOnboardingFocus && !["/nurse", "/nurse/onboarding", "/nurse/knowledge"].includes(item.href)) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/staff/me", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setStaffStatus(payload))
      .catch(() => {
        if (!controller.signal.aborted) setStaffStatus(null);
      });

    return () => controller.abort();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href={config.homeHref}
            className="flex shrink-0 items-center gap-2 text-base font-bold text-primary sm:text-lg"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {iconLabel}
            </span>
            <span className="hidden sm:inline">{config.brandLabel}</span>
            <span className="sm:hidden">{config.brandShortLabel}</span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 overflow-x-auto xl:flex">
            {visibleNavItems.map((item) => {
              const active = isWorkspacePathActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-gray-600 hover:bg-primary/5 hover:text-primary"
                  } whitespace-nowrap`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {showSwitchLink ? (
            <Link
              href={config.switchHref}
              className="hidden whitespace-nowrap rounded-md border border-primary/15 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 md:inline-flex"
            >
              {config.switchLabel}
            </Link>
          ) : null}
          <span className="hidden max-w-[180px] truncate text-sm text-gray-500 sm:block">
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

      <div className="border-t border-primary/10 bg-white/90 px-4 py-2 xl:hidden">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto">
          {visibleNavItems.map((item) => {
            const active = isWorkspacePathActive(pathname, item);

            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-primary/20 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {showSwitchLink ? (
            <Link
              href={config.switchHref}
              className="whitespace-nowrap rounded-full border border-primary/15 bg-white px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              {config.switchLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function StaffConsoleShell({
  workspace,
  children,
}: {
  workspace: StaffWorkspace;
  children: ReactNode;
}) {
  const config = getStaffWorkspaceConfig(workspace);

  return (
    <AuthProvider>
      <AuthGuard>
        <StaffGuard areaLabel={config.areaLabel} loginNextPath={config.homeHref} workspace={workspace}>
          <div className="staff-console-shell min-h-screen">
            <StaffConsoleHeader workspace={workspace} />
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
          </div>
        </StaffGuard>
      </AuthGuard>
    </AuthProvider>
  );
}
