"use client";

import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { StaffGuard } from "@/components/auth/StaffGuard";
import { NursePatientMessageClient } from "@/components/staff/NursePatientMessageClient";
import {
  parseChatwootDashboardAppEvent,
  type ChatwootDashboardAppContext,
} from "@/lib/chatwoot-dashboard-app-context";

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

export function ChatwootDashboardEdenToolsClient({ clinics }: { clinics: ClinicOption[] }) {
  return (
    <AuthProvider>
      <AuthGuard>
        <StaffGuard areaLabel="Eden 工具" loginNextPath="/chatwoot/eden-tools" workspace="nurse">
          <ChatwootDashboardEdenToolsInner clinics={clinics} />
        </StaffGuard>
      </AuthGuard>
    </AuthProvider>
  );
}
