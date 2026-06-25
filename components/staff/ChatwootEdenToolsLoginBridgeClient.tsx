"use client";

import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";

type BridgeState = "checking" | "sending" | "sent" | "error";

function ChatwootEdenToolsLoginBridgeInner() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<BridgeState>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setState("error");
      setErrorMessage("請先登入 Eden。");
      return;
    }

    let active = true;

    async function sendSessionToken() {
      try {
        setState("sending");
        const response = await fetch("/api/chatwoot/eden-tools/session-token", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.token) {
          throw new Error(payload.error || "未能建立登入票據");
        }

        window.opener?.postMessage(
          {
            type: "eden-chatwoot-tools-session",
            token: payload.token,
            expiresAt: payload.expiresAt ?? null,
          },
          window.location.origin,
        );

        if (!active) return;
        setState("sent");
        window.setTimeout(() => window.close(), 800);
      } catch (error) {
        if (!active) return;
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "登入橋接失敗");
      }
    }

    void sendSessionToken();

    return () => {
      active = false;
    };
  }, [loading, user]);

  const title = state === "sent" ? "已登入" : "登入 Eden";
  const body =
    state === "sent"
      ? "可以返回 Chatwoot。"
      : state === "error"
        ? errorMessage || "請重新開啟登入視窗。"
        : "正在連接 Chatwoot 工具。";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-800">Eden 工具</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
      </section>
    </div>
  );
}

export function ChatwootEdenToolsLoginBridgeClient() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ChatwootEdenToolsLoginBridgeInner />
      </AuthGuard>
    </AuthProvider>
  );
}
