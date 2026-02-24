"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeAppRuntime, isNativeAppUserAgent } from "@/lib/platform";
import {
  Sparkles,
  CalendarCheck2,
  Leaf,
  UserRound,
} from "lucide-react";

type TabItem = {
  id: "chat" | "booking" | "care" | "profile";
  label: string;
  href: string;
  Icon: typeof Sparkles;
};

const TABS: TabItem[] = [
  { id: "chat", label: "問問", href: "/chat", Icon: Sparkles },
  { id: "booking", label: "預約", href: "/booking", Icon: CalendarCheck2 },
  { id: "care", label: "養生", href: "/care", Icon: Leaf },
  { id: "profile", label: "根源", href: "/chat/symptoms", Icon: UserRound },
];

function isPatientRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/booking") ||
    pathname.startsWith("/cancel") ||
    pathname.startsWith("/reschedule") ||
    pathname.startsWith("/articles") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/care") ||
    pathname.startsWith("/login")
  );
}

function getActiveTab(pathname: string): TabItem["id"] {
  if (pathname.startsWith("/chat/symptoms")) return "profile";
  if (pathname.startsWith("/chat")) return "chat";
  if (
    pathname.startsWith("/booking") ||
    pathname.startsWith("/cancel") ||
    pathname.startsWith("/reschedule")
  ) {
    return "booking";
  }
  if (
    pathname.startsWith("/care") ||
    pathname.startsWith("/articles") ||
    pathname.startsWith("/courses")
  ) {
    return "care";
  }
  return "profile";
}

function getTopbarTitle(pathname: string): string {
  if (
    pathname.startsWith("/booking") ||
    pathname.startsWith("/cancel") ||
    pathname.startsWith("/reschedule")
  ) {
    return "預約服務";
  }
  if (
    pathname.startsWith("/care") ||
    pathname.startsWith("/articles") ||
    pathname.startsWith("/courses")
  ) {
    return "養生專區";
  }
  if (pathname.startsWith("/login")) return "會員登入";
  return "Eden Care";
}

export function PatientAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isNativeApp, setIsNativeApp] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return isNativeAppUserAgent(navigator.userAgent);
  });
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const syncNativeState = () => {
      if (cancelled) return;
      // Native bridge availability can lag behind first render in WebView.
      setIsNativeApp((previous) => previous || isNativeAppRuntime());
    };

    syncNativeState();
    const retryDelays = [120, 320, 760, 1600];
    const retryTimers = retryDelays.map((delay) => window.setTimeout(syncNativeState, delay));

    window.addEventListener("focus", syncNativeState);
    window.addEventListener("pageshow", syncNativeState);
    document.addEventListener("visibilitychange", syncNativeState);

    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", syncNativeState);
      window.removeEventListener("pageshow", syncNativeState);
      document.removeEventListener("visibilitychange", syncNativeState);
    };
  }, []);

  // Keep the mobile chrome exclusive to the native Capacitor app.
  const patientRoute = isNativeApp && isPatientRoute(pathname);
  const isChatRoute = patientRoute && pathname.startsWith("/chat");

  const activeTab = getActiveTab(pathname);
  const topbarTitle = getTopbarTitle(pathname);
  const shouldShowRouteTopbar = patientRoute && !isChatRoute;
  const shouldShowTabbar = !isChatRoute || !keyboardOpen;

  // Avoid iOS keyboard + fixed tabbar collision on chat pages.
  useEffect(() => {
    if (!isChatRoute) {
      setKeyboardOpen(false);
      return;
    }

    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const threshold = 120;
    const handleViewportChange = () => {
      const delta = window.innerHeight - viewport.height;
      setKeyboardOpen(delta > threshold);
    };

    handleViewportChange();
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);

    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [isChatRoute]);

  // Keep a stable spacer so chat content won't jump when keyboard toggles tabbar visibility.
  const shellPaddingBottom = "calc(88px + env(safe-area-inset-bottom))";

  if (!patientRoute) {
    return <>{children}</>;
  }

  return (
    <div className="patient-mobile-shell" style={{ paddingBottom: shellPaddingBottom }}>
      {shouldShowRouteTopbar ? (
        <header className="patient-route-topbar" aria-label={`${topbarTitle} 頂部導覽`}>
          <div className="patient-route-topbar__inner">
            <Link href="/chat" className="patient-route-topbar__brand">
              Eden Care
            </Link>
            <span className="patient-route-topbar__title">{topbarTitle}</span>
          </div>
        </header>
      ) : null}

      {children}

      {shouldShowTabbar ? (
        <nav className="patient-tabbar" aria-label="病人功能導覽">
          <div className="patient-tabbar__inner">
            {TABS.map(({ id, label, href, Icon }) => {
              const isActive = activeTab === id;
              return (
                <Link
                  key={id}
                  href={href}
                  className={`patient-tab ${
                    isActive ? "patient-tab--active" : "patient-tab--idle"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
