"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { StaffGuard } from "@/components/auth/StaffGuard";
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

function ChatwootDashboardEdenToolsInner({ clinics }: { clinics: ClinicOption[] }) {
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
        prefill={prefill}
        latestIncomingMessage={context?.latestIncomingMessage || ""}
      />
    </div>
  );
}

function ChatwootDashboardEdenToolsGate({ clinics }: { clinics: ClinicOption[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const loginPath = getChatwootEdenToolsLoginPath();

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">Eden 工具</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-950">需要登入 Eden</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            請用新視窗登入一次，然後返回 Chatwoot 重新載入此工具。
          </p>
          <div className="mt-5 grid gap-3">
            <a
              href={loginPath}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              開新視窗登入 Eden
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              我已登入，重新載入
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <StaffGuard areaLabel="Eden 工具" loginNextPath="/chatwoot/eden-tools" workspace="nurse">
      <ChatwootDashboardEdenToolsInner clinics={clinics} />
    </StaffGuard>
  );
}

export function ChatwootDashboardEdenToolsClient({ clinics }: { clinics: ClinicOption[] }) {
  return (
    <AuthProvider>
      <ChatwootDashboardEdenToolsGate clinics={clinics} />
    </AuthProvider>
  );
}
