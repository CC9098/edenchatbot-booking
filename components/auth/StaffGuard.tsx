"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuth } from "@/components/auth/AuthProvider";

type StaffGuardState = "checking" | "authorized" | "forbidden" | "error";

export function StaffGuard({
  children,
  areaLabel = "staff 控制台",
  loginNextPath = "/doctor",
}: {
  children: ReactNode;
  areaLabel?: string;
  loginNextPath?: string;
}) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [state, setState] = useState<StaffGuardState>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStaffStatus() {
      try {
        setState("checking");
        setErrorMessage(null);

        const response = await fetch("/api/staff/me", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.ok) {
          setState("authorized");
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setState("forbidden");
          return;
        }

        if (response.status === 401) {
          setState("error");
          setErrorMessage("登入狀態已失效，請重新登入。");
          return;
        }

        setState("error");
        setErrorMessage(payload.error || "驗證 staff 權限失敗");
      } catch (error) {
        if (controller.signal.aborted) return;
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "驗證 staff 權限失敗");
      }
    }

    void loadStaffStatus();

    return () => controller.abort();
  }, []);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut();
      router.replace(`/login?next=${encodeURIComponent(loginNextPath)}`);
    } finally {
      setSigningOut(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "authorized") {
    return <>{children}</>;
  }

  if (state === "forbidden") {
    return (
      <div className="min-h-screen bg-[#f5f9f2] px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">無法進入{areaLabel}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            此帳號已登入，但未有 staff 權限，所以不能進入{areaLabel}。請聯絡管理者為此帳號加入
            <span className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              staff_roles
            </span>
            ，並設定合適角色，例如
            <span className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              assistant
            </span>
            或
            <span className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700">
              doctor
            </span>
            。
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              返回病人頁面
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {signingOut ? "登出中..." : "登出並切換帳號"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f9f2] px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">無法驗證{areaLabel}權限</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {errorMessage || "系統暫時未能確認此帳號的 staff 權限。"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            重新載入
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {signingOut ? "登出中..." : "登出"}
          </button>
        </div>
      </div>
    </div>
  );
}
