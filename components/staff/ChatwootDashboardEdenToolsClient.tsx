"use client";

import { useEffect, useMemo, useState } from "react";

import { NursePatientMessageClient } from "@/components/staff/NursePatientMessageClient";
import {
  parseChatwootDashboardAppEvent,
  type ChatwootDashboardAppContext,
} from "@/lib/chatwoot-dashboard-app-context";
import { getChatwootEdenToolsLoginPath } from "@/lib/chatwoot-eden-tools-auth";

type ClinicOption = {
  id: string;
  nameZh: string;
};

type SessionMessage = {
  type: "eden-chatwoot-tools-session";
  token: string;
  expiresAt?: number | null;
};

type AuthState = "checking" | "authorized" | "unauthorized" | "error";

const SESSION_STORAGE_KEY = "eden.chatwootTools.sessionToken";

function isSessionMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<SessionMessage>;
  return message.type === "eden-chatwoot-tools-session" && typeof message.token === "string";
}

function ChatwootDashboardEdenToolsInner({
  clinics,
  authToken,
}: {
  clinics: ClinicOption[];
  authToken: string;
}) {
  const [context, setContext] = useState<ChatwootDashboardAppContext | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const nextContext = parseChatwootDashboardAppEvent(event.data);
      if (nextContext) {
        setContext(nextContext);
      }
    }

    window.addEventListener("message", handleMessage);
    window.parent?.postMessage("chatwoot-dashboard-app:fetch-info", "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const prefill = useMemo(() => ({
    patientName: context?.contactName || "",
    phone: context?.contactPhone || "",
    conversationId: context?.conversationId || null,
  }), [context]);

  return (
    <div className="min-h-screen bg-slate-50">
      <NursePatientMessageClient
        clinics={clinics}
        embedded
        authToken={authToken}
        prefill={prefill}
        latestIncomingMessage={context?.latestIncomingMessage || ""}
      />
    </div>
  );
}

function ChatwootDashboardEdenToolsGate({ clinics }: { clinics: ClinicOption[] }) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authToken, setAuthToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function verifyToken(token: string) {
    if (!token) {
      setAuthState("unauthorized");
      return;
    }

    try {
      setAuthState("checking");
      const response = await fetch("/api/chatwoot/eden-tools/me", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setAuthToken("");
        setAuthState("unauthorized");
        return;
      }

      window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      setAuthToken(token);
      setAuthState("authorized");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "未能連接 Eden 工具");
      setAuthState("error");
    }
  }

  function openLoginWindow() {
    const loginWindow = window.open(
      getChatwootEdenToolsLoginPath(),
      "eden-chatwoot-tools-login",
      "popup,width=520,height=760",
    );
    loginWindow?.focus();
  }

  useEffect(() => {
    void verifyToken(window.sessionStorage.getItem(SESSION_STORAGE_KEY) || "");

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isSessionMessage(event.data)) return;
      void verifyToken(event.data.token);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  if (authState !== "authorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">Eden 工具</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-950">需要登入 Eden</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            請用新視窗登入一次，成功後會自動連接回 Chatwoot。
          </p>
          {authState === "error" && errorMessage ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          ) : null}
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={openLoginWindow}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              開新視窗登入 Eden
            </button>
            <button
              type="button"
              onClick={openLoginWindow}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              我已登入，重新連接
            </button>
          </div>
        </section>
      </div>
    );
  }

  return <ChatwootDashboardEdenToolsInner clinics={clinics} authToken={authToken} />;
}

export function ChatwootDashboardEdenToolsClient({ clinics }: { clinics: ClinicOption[] }) {
  return <ChatwootDashboardEdenToolsGate clinics={clinics} />;
}
