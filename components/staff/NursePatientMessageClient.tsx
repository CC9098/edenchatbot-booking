"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LinkIcon,
  Loader2,
  MessageSquareText,
  Paperclip,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID,
  STAFF_PATIENT_MESSAGE_PURPOSE_OPTIONS,
  buildStaffPatientMessageText,
  getStaffPatientNoteMaxLength,
  type StaffPatientMessagePurpose,
} from "@/lib/staff-patient-messages";
import { shouldSearchStaffContactQuery } from "@/lib/staff-contact-search";
import {
  appendChatwootWorkbenchMessage,
  getChatwootWorkbenchComposerMode,
  getChatwootWorkbenchConversationStatusLabel,
  getChatwootWorkbenchScrollKey,
  resolveChatwootWorkbenchReplyParent,
  type StaffChatwootWorkbenchConversation,
  type StaffChatwootWorkbenchMessage,
} from "@/lib/staff-chatwoot-workbench";

type ClinicOption = {
  id: string;
  nameZh: string;
};

type ContactSearchResult = {
  id: number;
  name: string;
  phoneNumber: string;
};

type ContactHistoryMessage = StaffChatwootWorkbenchMessage;
type ContactHistoryConversation = StaffChatwootWorkbenchConversation;

type SendState =
  | { status: "idle" }
  | { status: "success"; text: string; conversationId?: number; deliveryStatus?: string | null }
  | { status: "error"; text: string; preview?: string };

type FormState = {
  patientName: string;
  phone: string;
  clinicId: string;
  purpose: StaffPatientMessagePurpose;
  linkUrl: string;
  note: string;
  manageAction: "" | "reschedule" | "cancel";
  medicineDays: string;
  consultationFee: string;
  treatmentFee: string;
  extraFee: string;
  totalAmount: string;
};

type PatientMessagePrefill = {
  contactId?: number | null;
  patientName?: string;
  phone?: string;
  note?: string;
  conversationId?: number | null;
};

type NursePatientMessageClientProps = {
  clinics: ClinicOption[];
  embedded?: boolean;
  authToken?: string;
  prefill?: PatientMessagePrefill;
  latestIncomingMessage?: string;
};

const DEFAULT_FORM_STATE: FormState = {
  patientName: "",
  phone: "",
  clinicId: "jordan",
  purpose: "intake_link",
  linkUrl: "",
  note: "",
  manageAction: "",
  medicineDays: "",
  consultationFee: "",
  treatmentFee: "",
  extraFee: "",
  totalAmount: "",
};

function getErrorText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    const error = (payload as { error: string }).error;

    if (error.includes("131049")) {
      return "Meta 暫停向此病人發送此類訊息。請勿重覆按發送；可等病人回覆 WhatsApp，或改用電話、SMS 或電郵。";
    }

    if (error.includes("131026")) {
      return "病人的 WhatsApp 未能接收此訊息。請核對電話號碼；如號碼正確，改用電話、SMS 或電郵。";
    }

    if (error.includes("WhatsApp template delivery failed") && error.includes("WhatsApp text delivery also failed")) {
      return "Approved template 先發送失敗，普通文字後備亦未能送出。請檢查訊息內容及完整連結；如仍失敗，請改用電話、SMS 或電郵。";
    }

    if (error.includes("131047")) {
      return "WhatsApp 24 小時客服窗口已關閉。請改用 approved template，或等病人回覆 WhatsApp。";
    }

    if (error.includes("No approved WhatsApp template")) {
      return "未有可用的 approved template，不能主動發普通文字；請確認 template 已同步，或請病人先回覆 WhatsApp。";
    }

    if (error.includes("customer-service window is closed") || error.includes("WhatsApp text delivery failed")) {
      return "普通文字被 WhatsApp 拒絕，通常是客服窗口已關閉；請改用 approved template，或請病人先回覆 WhatsApp。";
    }

    if (error.includes("WhatsApp template delivery failed")) {
      return "Template 發送失敗。請檢查訊息內容及完整連結；如仍失敗，請通知管理員檢查 Meta / Chatwoot。";
    }

    return error;
  }

  return "未能發送 WhatsApp 訊息。";
}

function getQuotedMessagePreview(message: StaffChatwootWorkbenchMessage | null): string {
  if (!message) return "原訊息未載入";

  const content = message.content.trim();
  if (content) return content.length > 120 ? `${content.slice(0, 120)}…` : content;

  const attachment = message.attachments[0];
  return attachment ? `附件：${attachment.label}` : "原訊息未載入";
}

export function NursePatientMessageClient({
  clinics,
  embedded = false,
  authToken = "",
  prefill,
  latestIncomingMessage = "",
}: NursePatientMessageClientProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedPrefillKey, setAppliedPrefillKey] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactSearchResult[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [contactSearchError, setContactSearchError] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactSearchResult | null>(null);
  const [historyConversations, setHistoryConversations] = useState<ContactHistoryConversation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [activeHistoryConversationId, setActiveHistoryConversationId] = useState<number | null>(null);
  const [composerText, setComposerText] = useState("");
  const [composerFile, setComposerFile] = useState<File | null>(null);
  const [isSendingComposerMessage, setIsSendingComposerMessage] = useState(false);
  const [composerError, setComposerError] = useState("");
  const activeHistoryBottomRef = useRef<HTMLDivElement | null>(null);
  const autoLoadedContactKeyRef = useRef("");

  const selectedClinic = clinics.find((clinic) => clinic.id === form.clinicId) || clinics[0];
  const selectedPurpose = STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID[form.purpose];
  const noteMaxLength = getStaffPatientNoteMaxLength(form.purpose);
  const isNoteTooLong = form.note.length > noteMaxLength;
  const prefillKey = [
    prefill?.contactId || "",
    prefill?.conversationId || "",
    prefill?.patientName || "",
    prefill?.phone || "",
  ].join("|");

  useEffect(() => {
    if (!prefillKey || prefillKey === appliedPrefillKey) return;

    setForm((current) => ({
      ...current,
      patientName: prefill?.patientName?.trim() || current.patientName,
      phone: prefill?.phone?.trim() || current.phone,
      note: prefill?.note?.trim() && !current.note ? prefill.note.trim() : current.note,
    }));
    setAppliedPrefillKey(prefillKey);
  }, [appliedPrefillKey, prefill, prefillKey]);

  useEffect(() => {
    if (!embedded || !shouldSearchStaffContactQuery(contactQuery)) {
      setContactResults([]);
      setContactSearchError("");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsSearchingContacts(true);
        setContactSearchError("");
        const params = new URLSearchParams({ q: contactQuery.trim() });
        const response = await fetch(`/api/nurse/chatwoot-contacts/search?${params.toString()}`, {
          cache: "no-store",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setContactResults([]);
          setContactSearchError(payload.error || "搜尋失敗");
          return;
        }

        setContactResults(Array.isArray(payload.contacts) ? payload.contacts : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setContactResults([]);
        setContactSearchError(error instanceof Error ? error.message : "搜尋失敗");
      } finally {
        if (!controller.signal.aborted) setIsSearchingContacts(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [authToken, contactQuery, embedded]);

  const previewText = useMemo(() => {
    return buildStaffPatientMessageText({
      patientName: form.patientName.trim() || "病人",
      clinicNameZh: selectedClinic?.nameZh || "診所",
      purpose: form.purpose,
      note: form.note,
      linkUrl: form.linkUrl,
      manageUrl: form.purpose === "manage_link" ? "系統會產生預約管理連結" : undefined,
      medicineDays: form.medicineDays,
      consultationFee: form.consultationFee,
      treatmentFee: form.treatmentFee,
      extraFee: form.extraFee,
      totalAmount: form.totalAmount,
    });
  }, [form, selectedClinic?.nameZh]);

  const activeHistoryScrollKey = useMemo(
    () => getChatwootWorkbenchScrollKey(historyConversations, activeHistoryConversationId),
    [activeHistoryConversationId, historyConversations],
  );
  const activeHistoryConversation = historyConversations.find((conversation) => conversation.id === activeHistoryConversationId) || null;
  const activeComposerMode = getChatwootWorkbenchComposerMode(activeHistoryConversation);
  const isTemplateComposerMode = activeComposerMode === "template";
  const composerMaxLength = isTemplateComposerMode ? getStaffPatientNoteMaxLength("follow_up") : 2000;
  const isComposerTooLong = composerText.length > composerMaxLength;
  const openHistoryConversationCount = historyConversations.filter((conversation) =>
    ["open", "pending", "snoozed"].includes(conversation.status || ""),
  ).length;

  useEffect(() => {
    if (!activeHistoryScrollKey) return;

    const animationFrame = window.requestAnimationFrame(() => {
      activeHistoryBottomRef.current?.scrollIntoView({ block: "end" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeHistoryScrollKey]);

  const loadContactHistory = useCallback(async (
    contact: ContactSearchResult,
    preferredConversationId: number | null = null,
  ) => {
    const controller = new AbortController();
    try {
      setIsLoadingHistory(true);
      setHistoryError("");
      setHistoryConversations([]);

      const historyParams = new URLSearchParams();
      if (preferredConversationId) {
        historyParams.set("conversationId", String(preferredConversationId));
      }
      const historyQuery = historyParams.size ? `?${historyParams.toString()}` : "";
      const response = await fetch(`/api/nurse/chatwoot-contacts/${contact.id}/history${historyQuery}`, {
        cache: "no-store",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setHistoryError(payload.error || "讀取對話紀錄失敗");
        return;
      }

      const nextConversations = Array.isArray(payload.conversations) ? payload.conversations : [];
      setHistoryConversations(nextConversations);
      const preferredConversationExists = preferredConversationId
        ? nextConversations.some((conversation: ContactHistoryConversation) => conversation.id === preferredConversationId)
        : false;
      setActiveHistoryConversationId(
        preferredConversationExists ? preferredConversationId : nextConversations[0]?.id || null,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setHistoryError(error instanceof Error ? error.message : "讀取對話紀錄失敗");
    } finally {
      if (!controller.signal.aborted) setIsLoadingHistory(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!embedded || !prefill?.contactId || !prefill.phone?.trim()) return;

    const contactKey = `${prefill.contactId}|${prefill.phone.trim()}|${prefill.conversationId || ""}`;
    if (autoLoadedContactKeyRef.current === contactKey) return;
    autoLoadedContactKeyRef.current = contactKey;

    const contact = {
      id: prefill.contactId,
      name: prefill.patientName?.trim() || prefill.phone.trim(),
      phoneNumber: prefill.phone.trim(),
    };
    setSelectedContact(contact);
    setComposerText("");
    setComposerFile(null);
    setComposerError("");
    void loadContactHistory(contact, prefill.conversationId || null);
  }, [
    embedded,
    loadContactHistory,
    prefill?.contactId,
    prefill?.conversationId,
    prefill?.patientName,
    prefill?.phone,
  ]);

  function fillContact(contact: ContactSearchResult) {
    setForm((current) => ({
      ...current,
      patientName: contact.name || current.patientName,
      phone: contact.phoneNumber || current.phone,
    }));
    setSelectedContact(contact);
    setComposerText("");
    setComposerFile(null);
    setComposerError("");
    setContactQuery("");
    setContactResults([]);
    void loadContactHistory(contact);
  }

  function useLatestIncomingAsForwardDraft() {
    const message = latestIncomingMessage.trim();
    if (!message) return;

    setForm((current) => ({
      ...current,
      purpose: "follow_up",
      note: message,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isNoteTooLong) {
      setSendState({ status: "error", text: `訊息內容最多 ${noteMaxLength} 字。` });
      return;
    }

    setIsSubmitting(true);
    setSendState({ status: "idle" });

    try {
      const response = await fetch("/api/nurse/patient-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          manageAction: form.manageAction || undefined,
          conversationId: embedded
            ? activeHistoryConversationId || prefill?.conversationId || undefined
            : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setSendState({
          status: "error",
          text: getErrorText(payload),
          preview: payload?.messagePreview,
        });
        return;
      }

      setSendState({
        status: "success",
        text: "WhatsApp 訊息已發送。",
        conversationId: payload.conversationId,
        deliveryStatus: payload.deliveryStatus,
      });
    } catch (error) {
      setSendState({
        status: "error",
        text: error instanceof Error ? error.message : "未能發送 WhatsApp 訊息。",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatMessageTime(value: string | null) {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-HK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  async function sendComposerMessage() {
    if (!selectedContact || !activeHistoryConversationId || isSendingComposerMessage) return;

    const content = composerText.trim();
    if (content.length > composerMaxLength) {
      setComposerError(`訊息內容最多 ${composerMaxLength} 字。`);
      return;
    }

    if (!content && !composerFile) {
      setComposerError("請輸入訊息或選擇圖片。");
      return;
    }

    if (isTemplateComposerMode && composerFile) {
      setComposerError("已關閉對話會自動用 template 發送，暫時不支援圖片。");
      return;
    }

    try {
      setIsSendingComposerMessage(true);
      setComposerError("");

      if (isTemplateComposerMode) {
        const response = await fetch("/api/nurse/patient-messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            patientName: selectedContact.name || "病人",
            phone: selectedContact.phoneNumber,
            clinicId: form.clinicId,
            purpose: "follow_up",
            note: content,
            conversationId: activeHistoryConversationId,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
          setComposerError(payload.error || "Template 發送失敗");
          return;
        }

        setComposerText("");
        setComposerFile(null);
        void loadContactHistory(selectedContact, activeHistoryConversationId);
        return;
      }

      const endpoint = `/api/nurse/chatwoot-contacts/${selectedContact.id}/conversations/${activeHistoryConversationId}/messages`;
      const requestInit: RequestInit = {
        method: "POST",
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      };

      if (composerFile) {
        const body = new FormData();
        body.set("content", content);
        body.set("attachment", composerFile);
        requestInit.body = body;
      } else {
        requestInit.headers = {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        };
        requestInit.body = JSON.stringify({ content });
      }

      const response = await fetch(endpoint, requestInit);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        setComposerError(payload.error || "發送失敗");
        return;
      }

      if (payload.message) {
        setHistoryConversations((current) =>
          appendChatwootWorkbenchMessage(current, activeHistoryConversationId, payload.message),
        );
      } else {
        void loadContactHistory(selectedContact, activeHistoryConversationId);
      }

      setComposerText("");
      setComposerFile(null);
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "發送失敗");
    } finally {
      setIsSendingComposerMessage(false);
    }
  }

  return (
    <div className={embedded ? "space-y-4 p-3" : "space-y-6"}>
      <section className={embedded ? "space-y-3" : "rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6"}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {!embedded ? (
              <Link
                href="/nurse"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
              >
                <ArrowLeft className="h-4 w-4" />
                返回姑娘主頁
              </Link>
            ) : null}
            <p className={embedded ? "text-sm font-semibold text-emerald-800" : "mt-4 text-sm font-semibold text-emerald-800"}>
              WhatsApp 通知
            </p>
            <h1 className={embedded ? "mt-1 text-xl font-semibold tracking-normal text-slate-950" : "mt-2 text-3xl font-semibold tracking-normal text-slate-950"}>
              {embedded ? "Eden 工具" : "傳新病人訊息"}
            </h1>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Staff only
          </div>
        </div>
      </section>

      {embedded ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">搜尋客戶</span>
              <input
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="姓名 / 電話"
              />
            </label>

            <button
              type="button"
              onClick={useLatestIncomingAsForwardDraft}
              disabled={!latestIncomingMessage.trim()}
              className="self-end inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              <MessageSquareText className="h-4 w-4" />
              帶入最近訊息
            </button>
          </div>

          {isSearchingContacts ? (
            <p className="text-sm text-slate-500">搜尋中...</p>
          ) : null}
          {contactSearchError ? (
            <p className="text-sm text-rose-700">{contactSearchError}</p>
          ) : null}
          {contactResults.length > 0 ? (
            <div className="grid gap-2">
              {contactResults.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => fillContact(contact)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <span className="min-w-0 truncate font-semibold text-slate-900">{contact.name}</span>
                  <span className="shrink-0 text-slate-500">{contact.phoneNumber}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {embedded && selectedContact ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">過往對話</p>
              <p className="text-sm text-slate-500">
                {selectedContact.name} · {selectedContact.phoneNumber}
              </p>
            </div>
            {isLoadingHistory ? (
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                載入中
              </div>
            ) : null}
          </div>

          {historyError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{historyError}</p>
          ) : null}

          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            預約前確認：本人 / 家人。引用顯示唔完整時，先向病人核對。
          </p>

          {openHistoryConversationCount > 1 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              同一聯絡人有 {openHistoryConversationCount} 個進行中對話。請按「病人訊息」時間揀，唔好按列表位置。
            </p>
          ) : null}

          {!isLoadingHistory && !historyError && historyConversations.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">未有過往對話。</p>
          ) : null}

          {historyConversations.length > 0 ? (
            <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
              {historyConversations.map((conversation) => {
                const isCurrentChatwootConversation = conversation.id === prefill?.conversationId;

                return (
                  <div
                    key={conversation.id}
                    className={`space-y-2 rounded-lg border bg-slate-50 p-3 ${
                      conversation.id === activeHistoryConversationId
                        ? "border-emerald-300 ring-1 ring-emerald-100"
                        : "border-slate-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveHistoryConversationId(conversation.id)}
                      className="flex w-full items-start justify-between gap-3 text-left text-xs text-slate-500"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold text-slate-700">
                          對話 #{conversation.id}
                          {isCurrentChatwootConversation ? " · 目前對話" : ""}
                        </span>
                        <span className="mt-1 block">
                          病人訊息 {conversation.latestIncomingMessageAt
                            ? formatMessageTime(conversation.latestIncomingMessageAt)
                            : "未有"}
                        </span>
                      </span>
                      {getChatwootWorkbenchConversationStatusLabel(conversation) ? (
                        <span className="shrink-0 font-semibold">
                          {getChatwootWorkbenchConversationStatusLabel(conversation)}
                        </span>
                      ) : null}
                    </button>
                    {conversation.activityOnlySinceLastVisible ? (
                      <p className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        冇新病人訊息 · 最近只係系統活動
                      </p>
                    ) : null}
                  {conversation.messages.length > 0 ? (
                    <div className="space-y-2">
                      {conversation.messages.map((message) => {
                        const incoming = message.direction === "incoming";
                        const failed = message.direction === "outgoing" && message.status === "failed";
                        const hasReplyReference = Boolean(
                          message.replyToMessageId || message.replyToExternalId,
                        );
                        const replyParent = hasReplyReference
                          ? resolveChatwootWorkbenchReplyParent(conversation, message)
                          : null;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${incoming ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[82%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                failed
                                  ? "border border-rose-200 bg-rose-50 text-rose-950"
                                  : incoming
                                  ? "bg-white text-slate-900"
                                  : "bg-emerald-700 text-white"
                              }`}
                            >
                              {hasReplyReference ? (
                                <div
                                  aria-label="引用訊息"
                                  className={`mb-2 border-l-2 px-2 py-1.5 text-xs leading-5 ${
                                    failed
                                      ? "border-rose-300 bg-rose-100 text-rose-800"
                                      : incoming
                                      ? "border-slate-300 bg-slate-100 text-slate-600"
                                      : "border-emerald-300 bg-emerald-800 text-emerald-50"
                                  }`}
                                >
                                  <p className="font-semibold">回覆緊</p>
                                  <p className="line-clamp-3 whitespace-pre-wrap break-words">
                                    {getQuotedMessagePreview(replyParent)}
                                  </p>
                                </div>
                              ) : null}
                              {message.content ? (
                                <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
                              ) : null}
                              {message.attachments.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  {message.attachments.map((attachment) => (
                                    <a
                                      key={attachment.id}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                                        incoming
                                          ? "bg-slate-100 text-slate-700"
                                          : failed
                                          ? "bg-rose-100 text-rose-800"
                                          : "bg-emerald-800 text-emerald-50"
                                      }`}
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {attachment.label}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                              {message.createdAt ? (
                                <p className={`mt-1 text-[11px] ${
                                  failed ? "text-rose-600" : incoming ? "text-slate-400" : "text-emerald-100"
                                }`}>
                                  {formatMessageTime(message.createdAt)}
                                  {failed ? " · 未送出" : ""}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {conversation.id === activeHistoryConversationId ? (
                        <div ref={activeHistoryBottomRef} aria-hidden="true" />
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">此對話未有可顯示 WhatsApp 訊息。</p>
                  )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {historyConversations.length > 0 && activeHistoryConversationId ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">回覆對話 #{activeHistoryConversationId}</p>
                {composerFile ? (
                  <button
                    type="button"
                    onClick={() => setComposerFile(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-700"
                  >
                    移除圖片
                  </button>
                ) : null}
              </div>
              {isTemplateComposerMode ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  已關閉：會自動用 template 發送。
                </p>
              ) : null}
              <textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="輸入 WhatsApp 訊息"
                aria-invalid={isComposerTooLong}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition ${
                  isTemplateComposerMode ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-50"
                }`}>
                  <Paperclip className="h-4 w-4" />
                  {composerFile ? composerFile.name : "圖片"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isTemplateComposerMode}
                    className="sr-only"
                    onChange={(event) => setComposerFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void sendComposerMessage()}
                  disabled={isSendingComposerMessage || isComposerTooLong}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isSendingComposerMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isTemplateComposerMode ? "用 template 發送" : "發送"}
                </button>
                <span className={`ml-auto text-xs ${isComposerTooLong ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                  {composerText.length}/{composerMaxLength}
                </span>
              </div>
              {composerError ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{composerError}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={embedded ? "grid gap-4" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"}>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <section className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">病人姓名</span>
              <input
                required
                value={form.patientName}
                onChange={(event) => setForm((current) => ({ ...current, patientName: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="例如：陳小明"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">WhatsApp 電話</span>
              <input
                required
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="例如：91234567"
                inputMode="tel"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">診所</span>
              <select
                value={form.clinicId}
                onChange={(event) => setForm((current) => ({ ...current, clinicId: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.nameZh}
                  </option>
                ))}
              </select>
            </label>

            {form.purpose === "manage_link" ? (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">管理動作</span>
                <select
                  value={form.manageAction}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      manageAction: event.target.value as FormState["manageAction"],
                    }))
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="">一般管理</option>
                  <option value="reschedule">更期</option>
                  <option value="cancel">取消</option>
                </select>
              </label>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MessageSquareText className="h-4 w-4 text-emerald-700" />
              訊息用途
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {STAFF_PATIENT_MESSAGE_PURPOSE_OPTIONS.map((option) => {
                const active = form.purpose === option.id;

                return (
                  <label
                    key={option.id}
                    className={`cursor-pointer rounded-lg border p-4 transition ${
                      active
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950 ring-4 ring-emerald-100"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="purpose"
                      value={option.id}
                      checked={active}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          purpose: option.id,
                          linkUrl: option.requiresLink ? current.linkUrl : "",
                        }))
                      }
                      className="sr-only"
                    />
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-2 block text-sm leading-6 text-slate-600">{option.description}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {selectedPurpose.requiresLink ? (
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LinkIcon className="h-4 w-4 text-emerald-700" />
                連結
              </span>
              <input
                required
                type="url"
                value={form.linkUrl}
                onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="https://..."
              />
            </label>
          ) : null}

          {form.purpose === "payment_notice" ? (
            <section className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">藥物日數</span>
                <input
                  required
                  value={form.medicineDays}
                  onChange={(event) => setForm((current) => ({ ...current, medicineDays: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="例如：7"
                  inputMode="numeric"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">診金</span>
                <input
                  required
                  value={form.consultationFee}
                  onChange={(event) => setForm((current) => ({ ...current, consultationFee: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="例如：380"
                  inputMode="decimal"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">其他收費</span>
                <input
                  required
                  value={form.treatmentFee}
                  onChange={(event) => setForm((current) => ({ ...current, treatmentFee: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="例如：680"
                  inputMode="decimal"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-800">收費說明</span>
                <input
                  required
                  value={form.extraFee}
                  onChange={(event) => setForm((current) => ({ ...current, extraFee: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="例如：藥費"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">總額</span>
                <input
                  required
                  value={form.totalAmount}
                  onChange={(event) => setForm((current) => ({ ...current, totalAmount: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="例如：1060"
                  inputMode="decimal"
                />
              </label>
            </section>
          ) : null}

          {selectedPurpose.noteLabel ? (
            <label className="space-y-2">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                <span>{selectedPurpose.noteLabel}</span>
                <span className={isNoteTooLong ? "text-rose-700" : "font-normal text-slate-500"}>
                  {form.note.length}/{noteMaxLength}
                </span>
              </span>
              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder={selectedPurpose.notePlaceholder}
                aria-invalid={isNoteTooLong}
              />
            </label>
          ) : null}

          {sendState.status === "success" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{sendState.text}</p>
                  <p className="mt-1 text-emerald-800">
                    {sendState.conversationId ? `Chatwoot 對話 #${sendState.conversationId}` : "已建立 Chatwoot 發送紀錄"}
                    {sendState.deliveryStatus ? ` · ${sendState.deliveryStatus}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {sendState.status === "error" ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">未能發送</p>
                  <p className="mt-1 text-rose-800">{sendState.text}</p>
                </div>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || isNoteTooLong}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? "發送中..." : "發送 WhatsApp"}
          </button>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm font-semibold text-emerald-200">預覽</p>
            <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">{previewText}</pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
