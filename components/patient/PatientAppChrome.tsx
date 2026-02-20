"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  CalendarCheck2,
  BookOpenText,
  UserRound,
} from "lucide-react";

type TabItem = {
  id: "chat" | "booking" | "learn" | "profile";
  label: string;
  href: string;
  Icon: typeof Sparkles;
};

const TABS: TabItem[] = [
  { id: "chat", label: "聊天", href: "/chat", Icon: Sparkles },
  { id: "booking", label: "預約", href: "/booking", Icon: CalendarCheck2 },
  { id: "learn", label: "學習", href: "/courses", Icon: BookOpenText },
  { id: "profile", label: "我的", href: "/login", Icon: UserRound },
];

function isPatientRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/booking") ||
    pathname.startsWith("/cancel") ||
    pathname.startsWith("/reschedule") ||
    pathname.startsWith("/articles") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/login")
  );
}

function getActiveTab(pathname: string): TabItem["id"] {
  if (pathname.startsWith("/chat")) return "chat";
  if (
    pathname.startsWith("/booking") ||
    pathname.startsWith("/cancel") ||
    pathname.startsWith("/reschedule")
  ) {
    return "booking";
  }
  if (pathname.startsWith("/articles") || pathname.startsWith("/courses")) {
    return "learn";
  }
  return "profile";
}

export function PatientAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isPatientRoute(pathname)) {
    return <>{children}</>;
  }

  const activeTab = getActiveTab(pathname);

  return (
    <div className="patient-mobile-shell pb-[calc(88px+env(safe-area-inset-bottom))]">
      {children}

      <nav
        className="patient-tabbar"
        aria-label="病人功能導覽"
      >
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
    </div>
  );
}
