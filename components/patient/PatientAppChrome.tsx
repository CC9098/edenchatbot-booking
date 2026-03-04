"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ClinicBrandLink } from "@/components/brand/ClinicBrandLink";
import {
  isMobileBrowserUserAgent,
  isNativeAppRuntime,
  isNativeAppUserAgent,
} from "@/lib/platform";
import {
  Sparkles,
  CalendarCheck2,
  Leaf,
  UserRound,
} from "lucide-react";

const MOBILE_CHROME_MAX_WIDTH = 1024;

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
  return "醫天圓";
}

function ProfileCompletionPrompt({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/me/profile", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        if (cancelled) return;

        const nextDisplayName = (data.displayName || "").trim();
        const nextPhone = (data.phone || "").trim();

        setDisplayName(nextDisplayName);
        setPhone(nextPhone);
        setOpen(Boolean(data.missingRequiredContact));
      } catch {
        // Best-effort prompt only.
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !open) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const nameValue = displayName.trim();
    const phoneValue = phone.trim();
    const phoneDigits = phoneValue.replace(/\D/g, "");

    if (nameValue.length < 2) {
      setFormError("請輸入有效姓名");
      return;
    }

    if (phoneDigits.length < 8) {
      setFormError("請輸入有效電話號碼");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: nameValue,
          phone: phoneValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "儲存失敗");
      }

      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-[81] w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900">完善病人資料</h3>
        <p className="mt-1 text-sm text-gray-600">
          請填寫姓名與電話，方便醫師以姓名或電話快速查找你的護理記錄。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">姓名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="例：陳大文"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">電話</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="例：91234567"
            />
          </div>
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-60"
          >
            {saving ? "儲存中..." : "儲存資料"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PatientAppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showMobileChrome, setShowMobileChrome] = useState(() => {
    if (typeof window === "undefined") return false;
    const userAgent = window.navigator.userAgent;
    const mobileBrowser = isMobileBrowserUserAgent(userAgent) && window.innerWidth <= MOBILE_CHROME_MAX_WIDTH;
    return isNativeAppUserAgent(userAgent) || mobileBrowser;
  });
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const syncChromeState = () => {
      if (cancelled) return;
      // Native bridge availability can lag behind first render in WebView.
      const nativeRuntime = isNativeAppRuntime();
      const mobileBrowserRuntime =
        isMobileBrowserUserAgent(window.navigator.userAgent) &&
        window.innerWidth <= MOBILE_CHROME_MAX_WIDTH;
      setShowMobileChrome(nativeRuntime || mobileBrowserRuntime);
    };

    syncChromeState();
    const retryDelays = [120, 320, 760, 1600];
    const retryTimers = retryDelays.map((delay) => window.setTimeout(syncChromeState, delay));

    window.addEventListener("focus", syncChromeState);
    window.addEventListener("pageshow", syncChromeState);
    window.addEventListener("resize", syncChromeState);
    document.addEventListener("visibilitychange", syncChromeState);

    return () => {
      cancelled = true;
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("focus", syncChromeState);
      window.removeEventListener("pageshow", syncChromeState);
      window.removeEventListener("resize", syncChromeState);
      document.removeEventListener("visibilitychange", syncChromeState);
    };
  }, []);

  // Show patient mobile chrome in native app and mobile browsers.
  const patientRoute = showMobileChrome && isPatientRoute(pathname);
  const isChatRoute = patientRoute && pathname.startsWith("/chat");

  const activeTab = getActiveTab(pathname);
  const topbarTitle = getTopbarTitle(pathname);
  const shouldShowRouteTopbar = patientRoute && !isChatRoute;
  const shouldShowTabbar = !isChatRoute || !keyboardOpen;
  const shouldPromptProfileCompletion = isPatientRoute(pathname) && !pathname.startsWith("/login");
  const routeTopbarInnerClassName =
    "chat-fixed-topbar__inner !flex !min-h-[52px] !items-center !justify-between !gap-2.5 !rounded-[18px] !border !border-[rgba(92,118,95,0.14)] !bg-[#F5F7F2] !px-3 !shadow-[0_6px_16px_rgba(36,61,41,0.06)] max-[440px]:!min-h-[50px] max-[440px]:!gap-1.5 max-[440px]:!px-2.5";
  const routeTopbarStartClassName = "chat-fixed-topbar__start flex min-w-0 flex-1 items-center gap-2";
  const routeTopbarActionsClassName = "chat-fixed-topbar__actions !flex !flex-none !items-center !justify-end !gap-0";
  const routeTopbarSectionClassName =
    "chat-fixed-topbar__action chat-fixed-topbar__action--section !min-h-10 !rounded-none !border-0 !bg-transparent !px-3 !text-[14px] !font-bold !text-[#365a3d] max-[440px]:!min-h-[38px] max-[440px]:!px-2.5 max-[440px]:!text-[13px]";

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
    return (
      <>
        <ProfileCompletionPrompt enabled={shouldPromptProfileCompletion} />
        {children}
      </>
    );
  }

  return (
    <div className="patient-mobile-shell" style={{ paddingBottom: shellPaddingBottom }}>
      <ProfileCompletionPrompt enabled={shouldPromptProfileCompletion} />
      {shouldShowRouteTopbar ? (
        <header className="chat-fixed-topbar chat-fixed-topbar--route" aria-label={`${topbarTitle} 頂部導覽`}>
          <div className={routeTopbarInnerClassName}>
            <div className={routeTopbarStartClassName}>
              <ClinicBrandLink href="/chat" />
            </div>
            <div className={routeTopbarActionsClassName}>
              <span className={routeTopbarSectionClassName}>
                {topbarTitle}
              </span>
            </div>
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
