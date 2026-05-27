export type StaffWorkspace = "doctor" | "nurse";

export type StaffWorkspaceNavItem = {
  href: string;
  label: string;
  matchPrefixes?: string[];
  managerOnly?: boolean;
};

export type StaffWorkspaceConfig = {
  areaLabel: string;
  brandLabel: string;
  brandShortLabel: string;
  homeHref: string;
  switchHref: string;
  switchLabel: string;
  navItems: StaffWorkspaceNavItem[];
};

const DOCTOR_NAV_ITEMS: StaffWorkspaceNavItem[] = [
  {
    href: "/doctor",
    label: "首頁",
  },
  {
    href: "/doctor/patients",
    label: "病人列表",
    matchPrefixes: ["/doctor/patients/"],
  },
  { href: "/doctor/record", label: "語音記錄" },
  { href: "/doctor/timetable", label: "時間表管理" },
];

const NURSE_NAV_ITEMS: StaffWorkspaceNavItem[] = [
  {
    href: "/nurse",
    label: "首頁",
  },
  {
    href: "/nurse/operations",
    label: "營運台",
    matchPrefixes: ["/nurse/operations"],
  },
  {
    href: "/nurse/messages/new",
    label: "傳訊息",
    matchPrefixes: ["/nurse/messages"],
  },
  {
    href: "/nurse/onboarding",
    label: "上手",
    matchPrefixes: ["/nurse/onboarding"],
  },
  {
    href: "/nurse/lesson",
    label: "情境課",
    matchPrefixes: ["/nurse/lesson"],
  },
  {
    href: "/nurse/quiz",
    label: "放行測驗",
    matchPrefixes: ["/nurse/quiz"],
  },
  { href: "/nurse/booking", label: "姑娘代約" },
  {
    href: "/nurse/knowledge",
    label: "知識庫",
    matchPrefixes: ["/nurse/knowledge"],
  },
  { href: "/nurse/widget-chatbot", label: "客服 Widget" },
  { href: "/nurse/timetable", label: "時間表管理" },
  { href: "/nurse/staff-access", label: "權限", managerOnly: true },
];

export function getStaffWorkspaceConfig(workspace: StaffWorkspace): StaffWorkspaceConfig {
  if (workspace === "nurse") {
    return {
      areaLabel: "姑娘控制台",
      brandLabel: "醫天圓 姑娘控制台",
      brandShortLabel: "姑娘控制台",
      homeHref: "/nurse",
      switchHref: "/doctor",
      switchLabel: "前往醫師後台",
      navItems: NURSE_NAV_ITEMS,
    };
  }

  return {
    areaLabel: "醫師控制台",
    brandLabel: "醫天圓 醫師控制台",
    brandShortLabel: "醫師控制台",
    homeHref: "/doctor",
    switchHref: "/nurse",
    switchLabel: "前往姑娘後台",
    navItems: DOCTOR_NAV_ITEMS,
  };
}

export function isWorkspacePathActive(
  pathname: string,
  item: StaffWorkspaceNavItem
): boolean {
  if (pathname === item.href) return true;
  return (item.matchPrefixes ?? []).some((prefix) => pathname.startsWith(prefix));
}

export function getWorkspaceFromPath(pathname: string): StaffWorkspace {
  return pathname.startsWith("/nurse") ? "nurse" : "doctor";
}
