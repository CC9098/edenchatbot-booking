"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LinkIcon,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID,
  STAFF_PATIENT_MESSAGE_PURPOSE_OPTIONS,
  buildStaffPatientMessageText,
  type StaffPatientMessagePurpose,
} from "@/lib/staff-patient-messages";

type ClinicOption = {
  id: string;
  nameZh: string;
};

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
};

const DEFAULT_FORM_STATE: FormState = {
  patientName: "",
  phone: "",
  clinicId: "jordan",
  purpose: "intake_link",
  linkUrl: "",
  note: "",
  manageAction: "",
};

function getErrorText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    const error = (payload as { error: string }).error;

    if (error.includes("No approved WhatsApp template")) {
      return "未有可用的 approved template，不能主動發普通文字；請確認 template 已同步，或請病人先回覆 WhatsApp。";
    }

    if (error.includes("customer-service window is closed") || error.includes("WhatsApp text delivery failed")) {
      return "普通文字被 WhatsApp 拒絕，通常是客服窗口已關閉；請改用 approved template，或請病人先回覆 WhatsApp。";
    }

    if (error.includes("WhatsApp template delivery failed")) {
      return "Template 發送失敗，請確認 Meta / Chatwoot template 名稱、語言及同步狀態。";
    }

    return error;
  }

  return "未能發送 WhatsApp 訊息。";
}

export function NursePatientMessageClient({ clinics }: { clinics: ClinicOption[] }) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM_STATE);
  const [sendState, setSendState] = useState<SendState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedClinic = clinics.find((clinic) => clinic.id === form.clinicId) || clinics[0];
  const selectedPurpose = STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID[form.purpose];

  const previewText = useMemo(() => {
    return buildStaffPatientMessageText({
      patientName: form.patientName.trim() || "病人",
      clinicNameZh: selectedClinic?.nameZh || "診所",
      purpose: form.purpose,
      note: form.note,
      linkUrl: form.linkUrl,
      manageUrl: form.purpose === "manage_link" ? "系統會產生預約管理連結" : undefined,
    });
  }, [form, selectedClinic?.nameZh]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSendState({ status: "idle" });

    try {
      const response = await fetch("/api/nurse/patient-messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          manageAction: form.manageAction || undefined,
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

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/nurse"
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
            >
              <ArrowLeft className="h-4 w-4" />
              返回姑娘主頁
            </Link>
            <p className="mt-4 text-sm font-semibold text-emerald-800">WhatsApp 通知</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              傳新病人訊息
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              姑娘只揀用途和填變數；系統會用 Meta template 優先發送，避免每次重新打字。
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            Staff only
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
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

          {selectedPurpose.noteLabel ? (
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-800">{selectedPurpose.noteLabel}</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder={selectedPurpose.notePlaceholder}
                maxLength={240}
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
            disabled={isSubmitting}
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

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Template 提醒</p>
            <p className="mt-2">
              如果 Meta / Chatwoot 未有對應 approved template，系統會回報未成功；病人已開啟中的對話才會自動退回普通文字。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
