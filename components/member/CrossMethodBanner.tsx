"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Routes on which the cross-method banner must NEVER appear.
 * These are login flows and public booking pages.
 */
const BLOCKED_PATHNAME_PREFIXES = [
  "/login",
  "/booking",
  "/booking-whatsapp",
  "/manage-booking",
  "/manage",
  "/cancel",
  "/reschedule",
  "/authorize",
  "/oauth",
  "/token",
  "/embed",
];

function isBlockedPathname(pathname: string): boolean {
  return BLOCKED_PATHNAME_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

async function markBannerShown(): Promise<void> {
  try {
    await fetch("/api/profile/banner-shown", {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    // Best-effort — silently swallow network failures.
  }
}

export function CrossMethodBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Never show on blocked routes.
    if (isBlockedPathname(pathname)) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch("/api/profile/cross-method-status", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { showBanner?: boolean };
        if (cancelled) return;

        if (data.showBanner) {
          setVisible(true);
        }
      } catch {
        // Best-effort check — ignore errors, just don't show the banner.
      }
    }

    checkStatus();

    return () => {
      cancelled = true;
    };
    // Re-run whenever the pathname changes so the banner re-checks on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Auto-dismiss after 8 seconds once visible.
  useEffect(() => {
    if (!visible) return;

    autoTimerRef.current = setTimeout(() => {
      if (!dismissedRef.current) {
        handleDismiss();
      }
    }, 8000);

    return () => {
      if (autoTimerRef.current !== null) {
        clearTimeout(autoTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleDismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    // Optimistically hide.
    setVisible(false);

    // Clear any pending auto-dismiss timer.
    if (autoTimerRef.current !== null) {
      clearTimeout(autoTimerRef.current);
    }

    // Persist flag to DB.
    markBannerShown();
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-50 flex items-center gap-3 bg-[#EBF4E8] px-4 py-2.5 text-sm text-[#2d5a35] shadow-sm"
    >
      <span className="flex-1 leading-snug">
        ℹ️ 您的 WhatsApp 同電郵已連結到同一個帳戶。兩個方式都可以查閱相同的預約紀錄。
      </span>
      <button
        type="button"
        aria-label="知道了，關閉提示"
        onClick={handleDismiss}
        className="flex-none rounded-md px-2.5 py-1 text-xs font-medium text-[#2d5a35] transition-colors hover:bg-[#d5eacf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4a8b55]"
      >
        知道了 ✕
      </button>
    </div>
  );
}
