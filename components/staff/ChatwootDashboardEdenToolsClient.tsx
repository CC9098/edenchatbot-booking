"use client";

import { useEffect, useMemo, useState } from "react";

import { NursePatientMessageClient } from "@/components/staff/NursePatientMessageClient";
import {
  parseChatwootDashboardAppEvent,
  type ChatwootDashboardAppContext,
} from "@/lib/chatwoot-dashboard-app-context";
import {
  CHATWOOT_EDEN_TOOLS_ACCESS_TOKEN_HEADER,
  CHATWOOT_EDEN_TOOLS_SHARED_EMAIL,
  getChatwootEdenToolsSessionRenewalDelay,
} from "@/lib/chatwoot-eden-tools-auth";
import {
  forgetChatwootEdenToolsDevice,
  getChatwootEdenToolsDeviceSession,
  pairChatwootEdenToolsDevice,
} from "@/lib/chatwoot-eden-tools-device-auth";

type ClinicOption = {
  id: string;
  nameZh: string;
};

type EdenToolsSession = {
  token: string;
  expiresAt: number;
};

type AuthState = "checking" | "authorized" | "unauthorized" | "pairing" | "error";

class EdenToolsSessionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EdenToolsSessionError";
    this.status = status;
  }
}

async function exchangeAccessToken(accessToken: string): Promise<EdenToolsSession> {
  const response = await fetch("/api/chatwoot/eden-tools/session-token", {
    cache: "no-store",
    headers: {
      [CHATWOOT_EDEN_TOOLS_ACCESS_TOKEN_HEADER]: accessToken,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new EdenToolsSessionError(
      response.status,
      typeof payload.error === "string" ? payload.error : "未能連接 Eden 工具",
    );
  }
  if (typeof payload.token !== "string" || typeof payload.expiresAt !== "number") {
    throw new Error("INVALID_EDEN_TOOLS_SESSION");
  }

  return { token: payload.token, expiresAt: payload.expiresAt };
}

async function restoreDeviceSession(): Promise<EdenToolsSession | null> {
  const session = await getChatwootEdenToolsDeviceSession();
  if (!session?.access_token) return null;
  return exchangeAccessToken(session.access_token);
}

function getPairingError(error: unknown): string {
  if (error instanceof EdenToolsSessionError) {
    if (error.status === 403) return "此帳戶未有姑娘權限。";
    if (error.status === 401) return "登入資料已失效，請再試一次。";
    return "暫時未能連接 Eden 工具，請稍後再試。";
  }
  if (error instanceof Error && error.message === "DEVICE_STORAGE_UNAVAILABLE") {
    return "此裝置未能保存登入資料，請允許 Chatwoot 保存網站資料後再試。";
  }
  if (error instanceof Error && /invalid login credentials/i.test(error.message)) {
    return "帳戶或密碼不正確，請再試一次。";
  }
  return "暫時未能完成配對，請稍後再試。";
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
    contactId: context?.contactId || null,
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
  const [edenToolsSession, setEdenToolsSession] = useState<EdenToolsSession | null>(null);
  const [email, setEmail] = useState(CHATWOOT_EDEN_TOOLS_SHARED_EMAIL);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function restore() {
      try {
        const session = await restoreDeviceSession();
        if (!active) return;
        if (!session) {
          setAuthState("unauthorized");
          return;
        }

        setEdenToolsSession(session);
        setAuthState("authorized");
      } catch (error) {
        if (!active) return;
        if (error instanceof EdenToolsSessionError && (error.status === 401 || error.status === 403)) {
          await forgetChatwootEdenToolsDevice();
          setAuthState("unauthorized");
          return;
        }

        setErrorMessage("暫時未能連接 Eden 工具，請再試一次。");
        setAuthState("error");
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!edenToolsSession || authState !== "authorized") return;

    const currentSession = edenToolsSession;
    let active = true;
    let timerId: number | undefined;

    async function renew() {
      try {
        const session = await restoreDeviceSession();
        if (!active) return;
        if (!session) {
          setEdenToolsSession(null);
          setAuthState("unauthorized");
          return;
        }

        setEdenToolsSession(session);
      } catch (error) {
        if (!active) return;
        if (error instanceof EdenToolsSessionError && (error.status === 401 || error.status === 403)) {
          await forgetChatwootEdenToolsDevice();
          setEdenToolsSession(null);
          setAuthState("unauthorized");
          return;
        }

        const remainingMs = currentSession.expiresAt - Date.now();
        if (remainingMs > 10_000) {
          timerId = window.setTimeout(renew, Math.min(30_000, remainingMs - 5_000));
          return;
        }

        setErrorMessage("連線中斷，請重新連接 Eden 工具。");
        setAuthState("error");
      }
    }

    timerId = window.setTimeout(
      renew,
      getChatwootEdenToolsSessionRenewalDelay(currentSession.expiresAt),
    );

    return () => {
      active = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [authState, edenToolsSession]);

  async function handlePairDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage("請輸入帳戶及密碼。");
      return;
    }

    try {
      setAuthState("pairing");
      setErrorMessage("");
      const deviceSession = await pairChatwootEdenToolsDevice(
        email.trim().toLowerCase(),
        password,
      );
      const session = await exchangeAccessToken(deviceSession.access_token);
      setPassword("");
      setEdenToolsSession(session);
      setAuthState("authorized");
    } catch (error) {
      setErrorMessage(getPairingError(error));
      setAuthState("unauthorized");
    }
  }

  async function handleReconnect() {
    try {
      setAuthState("checking");
      setErrorMessage("");
      const session = await restoreDeviceSession();
      if (!session) {
        setAuthState("unauthorized");
        return;
      }

      setEdenToolsSession(session);
      setAuthState("authorized");
    } catch {
      setErrorMessage("暫時未能連接 Eden 工具，請再試一次。");
      setAuthState("error");
    }
  }

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
          <h1 className="mt-2 text-xl font-semibold text-slate-950">配對呢部裝置</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            只需做一次。之後登入 Chatwoot，Eden 工具會自動開啟。
          </p>
          {errorMessage ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
          ) : null}
          <form className="mt-5 grid gap-4" onSubmit={handlePairDevice}>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              姑娘帳戶
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              密碼
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <button
              type="submit"
              disabled={authState === "pairing"}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              {authState === "pairing" ? "配對中…" : "配對並開啟"}
            </button>
          </form>
          {authState === "error" ? (
            <button
              type="button"
              onClick={handleReconnect}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              再試連接
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <ChatwootDashboardEdenToolsInner
      clinics={clinics}
      authToken={edenToolsSession?.token || ""}
    />
  );
}

export function ChatwootDashboardEdenToolsClient({ clinics }: { clinics: ClinicOption[] }) {
  return <ChatwootDashboardEdenToolsGate clinics={clinics} />;
}
