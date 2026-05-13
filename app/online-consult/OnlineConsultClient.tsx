"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

type NotifyState = "idle" | "notifying" | "sent" | "failed";
type NotifyChannel = "whatsapp" | "email" | null;
type WaitingReminderState = "idle" | "scheduled" | "sent" | "failed";

const WAITING_REASSURANCE_DELAY_MS = 5 * 60 * 1000;

interface OnlineConsultClientProps {
  token: string;
  meetLink: string;
}

export default function OnlineConsultClient({ token, meetLink }: OnlineConsultClientProps) {
  const [notifyState, setNotifyState] = useState<NotifyState>("idle");
  const [notifyChannel, setNotifyChannel] = useState<NotifyChannel>(null);
  const [waitingReminderState, setWaitingReminderState] = useState<WaitingReminderState>("idle");
  const [hasOpenedMeet, setHasOpenedMeet] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const storageKey = useMemo(() => `eden.online-consult.notified.${token.slice(0, 32)}`, [token]);
  const meetOpenedStorageKey = useMemo(
    () => `eden.online-consult.meet-opened.${token.slice(0, 32)}`,
    [token]
  );
  const waitingReminderStorageKey = useMemo(
    () => `eden.online-consult.waiting-reminder.${token.slice(0, 32)}`,
    [token]
  );

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

        const channel = data?.channel === "whatsapp" || data?.channel === "email"
          ? data.channel
          : null;
        sessionStorage.setItem(storageKey, "1");
        if (!cancelled) {
          setNotifyChannel(channel);
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

  useEffect(() => {
    if (sessionStorage.getItem(meetOpenedStorageKey) === "1") {
      setHasOpenedMeet(true);
    }
  }, [meetOpenedStorageKey]);

  useEffect(() => {
    if (notifyState !== "sent" || !hasOpenedMeet) return;

    if (sessionStorage.getItem(waitingReminderStorageKey) === "1") {
      setWaitingReminderState("sent");
      return;
    }

    let cancelled = false;
    setWaitingReminderState("scheduled");

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/online-consult/waiting-reminder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "未能發送等候提示。");
        }

        sessionStorage.setItem(waitingReminderStorageKey, "1");
        if (!cancelled) {
          setWaitingReminderState("sent");
        }
      } catch {
        if (!cancelled) {
          setWaitingReminderState("failed");
        }
      }
    }, WAITING_REASSURANCE_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hasOpenedMeet, notifyState, token, waitingReminderStorageKey]);

  function handleOpenMeet() {
    sessionStorage.setItem(meetOpenedStorageKey, "1");
    setHasOpenedMeet(true);
  }

  const statusText =
    notifyState === "sent"
      ? notifyChannel === "whatsapp"
        ? "已透過 WhatsApp 通知醫師，請開啟 Google Meet 並保持在線。"
        : "已通知醫師，請開啟 Google Meet 並保持在線。"
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
        {hasOpenedMeet && waitingReminderState === "scheduled" ? (
          <p className="mt-2 text-xs">
            如醫師未即時進入，系統會在約 5 分鐘後自動發送等候提示。
          </p>
        ) : null}
        {waitingReminderState === "sent" ? (
          <p className="mt-2 text-xs">
            已發送等候提示，請繼續保持 Google Meet 開啟。
          </p>
        ) : null}
      </div>

      <a
        href={meetLink}
        target="_blank"
        rel="noreferrer"
        onClick={handleOpenMeet}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:w-auto"
      >
        <ExternalLink className="h-5 w-5" aria-hidden="true" />
        開啟 Google Meet
      </a>
    </div>
  );
}
