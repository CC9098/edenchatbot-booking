"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

type NotifyState = "idle" | "notifying" | "sent" | "failed";

interface OnlineConsultClientProps {
  token: string;
  meetLink: string;
}

export default function OnlineConsultClient({ token, meetLink }: OnlineConsultClientProps) {
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const storageKey = useMemo(() => `eden.online-consult.notified.${token.slice(0, 32)}`, [token]);

  useEffect(() => {
    let cancelled = false;

    async function notifyDoctor() {
      if (sessionStorage.getItem(storageKey) === "1") {
        setNotifyState("sent");
        return;
      }

      setNotifyState("notifying");
      setErrorMessage("");

      try {
        const response = await fetch("/api/online-consult/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "未能通知醫師。");
        }

        sessionStorage.setItem(storageKey, "1");
        if (!cancelled) {
          setNotifyState("sent");
        }
      } catch (error) {
        if (!cancelled) {
          setNotifyState("failed");
          setErrorMessage(error instanceof Error ? error.message : "未能通知醫師。");
        }
      }
    }

    void notifyDoctor();

    return () => {
      cancelled = true;
    };
  }, [storageKey, token]);

  const statusText =
    notifyState === "sent"
      ? "已通知醫師，請開啟 Google Meet 並保持在線。"
      : notifyState === "failed"
        ? "暫時未能自動通知醫師，請先開啟 Google Meet。"
        : "正在通知醫師...";

  return (
    <div className="space-y-4">
      <div className={`rounded-md border px-4 py-3 text-sm ${
        notifyState === "failed"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}>
        <p className="font-medium">{statusText}</p>
        {errorMessage ? <p className="mt-1 text-xs">{errorMessage}</p> : null}
      </div>

      <a
        href={meetLink}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
      >
        <ExternalLink className="h-5 w-5" aria-hidden="true" />
        開啟 Google Meet
      </a>
    </div>
  );
}
