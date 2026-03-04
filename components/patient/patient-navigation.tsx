import Link from "next/link";
import {
  CalendarCheck2,
  Leaf,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type PatientTabId = "chat" | "booking" | "care" | "profile";

type PatientTabItem = {
  id: PatientTabId;
  label: string;
  description: string;
  href: string;
  Icon: LucideIcon;
};

export const PATIENT_TABS: PatientTabItem[] = [
  { id: "chat", label: "問問", description: "AI 體質諮詢", href: "/chat", Icon: Sparkles },
  { id: "booking", label: "預約", description: "門診安排", href: "/booking", Icon: CalendarCheck2 },
  { id: "care", label: "養生", description: "調理建議", href: "/care", Icon: Leaf },
  { id: "profile", label: "根源", description: "身體記錄", href: "/chat/symptoms", Icon: UserRound },
];

export function isPatientRoute(pathname: string): boolean {
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

export function shouldShowPatientTabNavigation(pathname: string): boolean {
  return isPatientRoute(pathname) && !pathname.startsWith("/login");
}

export function getActivePatientTab(pathname: string): PatientTabId {
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

export function getPatientTopbarTitle(pathname: string): string {
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
  return "醫天圓";
}

type PatientDesktopTabsProps = {
  pathname: string;
  className?: string;
};

export function PatientDesktopTabs({
  pathname,
  className = "",
}: PatientDesktopTabsProps) {
  const activeTab = getActivePatientTab(pathname);
  const navClassName = ["w-full", className].filter(Boolean).join(" ");

  return (
    <nav className={navClassName} aria-label="病人功能分頁">
      <div className="grid grid-cols-2 gap-2 rounded-[28px] border border-[rgba(92,118,95,0.14)] bg-[linear-gradient(180deg,rgba(249,251,246,0.96)_0%,rgba(244,247,242,0.92)_100%)] p-2 shadow-[0_12px_32px_rgba(36,61,41,0.07)] backdrop-blur sm:grid-cols-4">
        {PATIENT_TABS.map(({ id, label, description, href, Icon }) => {
          const isActive = activeTab === id;

          return (
            <Link
              key={id}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-h-[78px] items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(70,126,83,0.18)] ${
                isActive
                  ? "border-[rgba(63,120,77,0.24)] bg-white text-[#2f6240] shadow-[0_10px_24px_rgba(36,61,41,0.08)]"
                  : "border-transparent text-[#5c6e5f] hover:border-[rgba(92,118,95,0.16)] hover:bg-white/78 hover:text-[#365a3d]"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] transition-colors ${
                  isActive
                    ? "bg-[linear-gradient(180deg,rgba(70,126,83,0.12)_0%,rgba(70,126,83,0.18)_100%)] text-[#2f6240]"
                    : "bg-[rgba(70,126,83,0.08)] text-[#56725e] group-hover:bg-[rgba(70,126,83,0.12)]"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{label}</span>
                <span className="mt-1 block text-[11px] font-medium leading-snug text-[#7d8d80]">
                  {description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
