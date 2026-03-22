"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  LoaderCircle,
  MessageCircleMore,
  RefreshCcw,
  Save,
  ToggleLeft,
  ToggleRight,
  Waypoints,
} from "lucide-react";

import {
  buildConsultationFormFlow,
  buildWidgetGreetingMessage,
  buildWidgetMainMenuOptions,
  DEFAULT_WIDGET_CHATBOT_SETTINGS,
  getWidgetChatbotMenuLabelByTarget,
  normalizeWidgetChatbotSettings,
  WIDGET_CHATBOT_FLOW_NODES,
  WIDGET_CHATBOT_MENU_TARGET_OPTIONS,
  type WidgetChatbotFlowNode,
  type WidgetChatbotMenuId,
  type WidgetChatbotNodeId,
  type WidgetChatbotSettings,
} from "@/lib/widget-chatbot-settings";

type StaffRole = "doctor" | "assistant" | "admin";

type WidgetChatbotSettingsPayload = {
  role: StaffRole;
  settings: WidgetChatbotSettings;
  updatedAt: string | null;
};

type PreviewBubble = {
  role: "user" | "assistant" | "system";
  text: string;
};

type PreviewState = {
  bubbles: PreviewBubble[];
  buttons: string[];
  helper: string;
};

function formatDateTime(value: string | null): string {
  if (!value) return "未曾儲存";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未曾儲存";
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: StaffRole): string {
  if (role === "admin") return "管理員";
  if (role === "doctor") return "醫師";
  return "姑娘";
}

function cloneSettings(settings: WidgetChatbotSettings): WidgetChatbotSettings {
  return JSON.parse(JSON.stringify(settings)) as WidgetChatbotSettings;
}

function buildPreview(settings: WidgetChatbotSettings, node: WidgetChatbotFlowNode): PreviewState {
  const mainMenuButtons = buildWidgetMainMenuOptions(settings).map((item) => item.label);
  const consultFlow = buildConsultationFormFlow(settings);
  const greeting = buildWidgetGreetingMessage(settings, ["荃灣診所 WhatsApp：按此聯絡姑娘"]);

  switch (node.id) {
    case "welcome":
      return {
        bubbles: [{ role: "assistant", text: greeting }],
        buttons: mainMenuButtons,
        helper: "一打開 widget 就會先出開場白，再列出主選單。",
      };
    case "mainMenu":
      return {
        bubbles: [{ role: "assistant", text: "主選單目前會顯示以下按鈕：" }],
        buttons: mainMenuButtons,
        helper: "每個 button 的顯示名稱、排序、顯示/隱藏，以及實際去向都可以在這裡設定。",
      };
    case "fees":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "fees") },
          { role: "assistant", text: settings.flows.fees.reply },
        ],
        buttons: [settings.flows.fees.endButtonLabel, settings.flows.fees.mainButtonLabel],
        helper: "收費節點之後只有兩個出口：結束，或者返回主選單。",
      };
    case "clinic":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "clinic") },
          { role: "assistant", text: settings.flows.clinic.prompt },
        ],
        buttons: [
          settings.flows.clinic.hoursButtonLabel,
          settings.flows.clinic.addressesButtonLabel,
          settings.flows.clinic.backButtonLabel,
        ],
        helper: "按「營業時間」或「地址」之後，會再進去下一個固定節點。",
      };
    case "clinicHours":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "clinic") },
          { role: "assistant", text: settings.flows.clinic.prompt },
          { role: "user", text: settings.flows.clinic.hoursButtonLabel },
          {
            role: "assistant",
            text: `[系統自動插入營業時間]\n\n${settings.flows.clinic.hoursClosingText}`,
          },
        ],
        buttons: [settings.flows.common.returnMainButtonLabel],
        helper: "營業時間資料由系統提供；你改的是尾段提醒與官方連結說明。",
      };
    case "clinicAddresses":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "clinic") },
          { role: "assistant", text: settings.flows.clinic.prompt },
          { role: "user", text: settings.flows.clinic.addressesButtonLabel },
          {
            role: "assistant",
            text: `${settings.flows.clinic.addressesPrompt}\n\n[系統自動插入診所地址與 Google 地圖連結]`,
          },
        ],
        buttons: [settings.flows.common.returnMainButtonLabel],
        helper: "地址與地圖 link 仍然跟系統資料走，避免姑娘改錯。",
      };
    case "booking":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "booking") },
          { role: "assistant", text: settings.flows.booking.prompt },
        ],
        buttons: ["[系統動態醫師清單]", settings.flows.common.returnMainButtonLabel],
        helper: "醫師、診所、日期、時段之後會進入系統預約流程，第一版先不在這頁逐句編輯。",
      };
    case "timetable":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "timetable") },
          { role: "assistant", text: settings.flows.timetable.reply },
        ],
        buttons: [settings.flows.common.returnMainButtonLabel],
        helper: "主要用來講解時間表連結和提醒用戶以官方平台為準。",
      };
    case "other":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "other") },
          {
            role: "assistant",
            text: `${settings.flows.other.prompt}\n荃灣診所 WhatsApp：按此聯絡姑娘`,
          },
          { role: "system", text: settings.flows.other.aiLoadingText },
        ],
        buttons: [],
        helper: "出完交接提示之後，會打開自由輸入框，交俾 AI 回答。",
      };
    case "consult":
      return {
        bubbles: [
          { role: "user", text: getWidgetChatbotMenuLabelByTarget(settings, "consult") },
          { role: "assistant", text: consultFlow[0]?.prompt || "" },
          { role: "system", text: `之後會依次再問：${consultFlow.slice(1).map((item) => item.prompt).join(" / ")}` },
        ],
        buttons: [],
        helper: "這個節點是逐條收集資料，不會顯示 button。",
      };
    case "common":
      return {
        bubbles: [
          { role: "assistant", text: settings.flows.common.returnToMainText },
          { role: "assistant", text: settings.flows.common.endText },
        ],
        buttons: [
          settings.flows.common.returnMainButtonLabel,
          settings.flows.common.bookingBackButtonLabel,
          settings.flows.common.bookingCancelButtonLabel,
        ],
        helper: "這些字眼會在多個節點重複出現，改動影響較大。",
      };
    default:
      return {
        bubbles: [],
        buttons: [],
        helper: "",
      };
  }
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-slate-900">{title}</label>
      {hint ? <p className="text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function TextInput({
  title,
  value,
  onChange,
  hint,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel title={title} hint={hint} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
      />
    </div>
  );
}

function TextareaInput({
  title,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <SectionLabel title={title} hint={hint} />
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
      />
    </div>
  );
}

export default function DoctorWidgetChatbotPage() {
  const [role, setRole] = useState<StaffRole>("assistant");
  const [settings, setSettings] = useState<WidgetChatbotSettings>(DEFAULT_WIDGET_CHATBOT_SETTINGS);
  const [draft, setDraft] = useState<WidgetChatbotSettings>(DEFAULT_WIDGET_CHATBOT_SETTINGS);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [selectedNodeId, setSelectedNodeId] = useState<WidgetChatbotNodeId>("welcome");
  const statusBannerRef = useRef<HTMLDivElement | null>(null);

  async function loadSettings() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/doctor/widget-chatbot/settings", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<WidgetChatbotSettingsPayload> & {
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const nextSettings = cloneSettings(payload.settings);
      setRole(payload.role ?? "assistant");
      setSettings(nextSettings);
      setDraft(cloneSettings(nextSettings));
      setUpdatedAt(payload.updatedAt ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "載入 widget chatbot 設定失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  const selectedNode = useMemo(
    () => WIDGET_CHATBOT_FLOW_NODES.find((node) => node.id === selectedNodeId) ?? WIDGET_CHATBOT_FLOW_NODES[0],
    [selectedNodeId]
  );
  const preview = useMemo(() => buildPreview(draft, selectedNode), [draft, selectedNode]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(draft),
    [settings, draft]
  );

  useEffect(() => {
    if (saveStatus !== "saved") return;

    const timer = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  const saveButtonLabel = saving
    ? "儲存中..."
    : saveStatus === "saved" && !hasUnsavedChanges
      ? "已儲存"
      : hasUnsavedChanges
        ? "儲存 widget 設定"
        : "未有改動";

  function resetDraft() {
    setDraft(cloneSettings(settings));
    setNotice("已還原到最近一次儲存版本。");
    setError(null);
    setSaveStatus("idle");
  }

  async function saveSettings() {
    const expectedSettings = normalizeWidgetChatbotSettings(cloneSettings(draft));
    const expectedSerialized = JSON.stringify(expectedSettings);

    setSaving(true);
    setError(null);
    setNotice(null);
    setSaveStatus("idle");

    try {
      const response = await fetch("/api/doctor/widget-chatbot/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<WidgetChatbotSettingsPayload> & {
        error?: string;
      };

      if (!response.ok || !payload.settings) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const persistedSettings = cloneSettings(payload.settings);
      if (JSON.stringify(persistedSettings) !== expectedSerialized) {
        throw new Error("資料庫回寫內容同你剛剛送出的修改不一致，請重新整理後再試。");
      }

      const verifyResponse = await fetch("/api/doctor/widget-chatbot/settings", {
        method: "GET",
        cache: "no-store",
      });
      const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as Partial<WidgetChatbotSettingsPayload> & {
        error?: string;
      };

      if (!verifyResponse.ok || !verifyPayload.settings) {
        throw new Error(verifyPayload.error || "儲存後重新讀取驗證失敗");
      }

      const verifiedSettings = cloneSettings(verifyPayload.settings);
      if (JSON.stringify(verifiedSettings) !== expectedSerialized) {
        throw new Error("已寫入後端，但重新讀取驗證時發現內容不一致，請重新整理檢查。");
      }

      setSettings(verifiedSettings);
      setDraft(cloneSettings(verifiedSettings));
      setUpdatedAt(verifyPayload.updatedAt ?? payload.updatedAt ?? null);
      setRole(verifyPayload.role ?? payload.role ?? role);
      setNotice("已成功寫入資料庫，並重新讀回確認修改一致。");
      setSaveStatus("saved");
      window.setTimeout(() => {
        statusBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "儲存失敗");
      window.setTimeout(() => {
        statusBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    } finally {
      setSaving(false);
    }
  }

  function updateMenuItem(itemId: WidgetChatbotMenuId, updater: (current: WidgetChatbotSettings["menu"]["items"][number]) => WidgetChatbotSettings["menu"]["items"][number]) {
    setDraft((previous) => ({
      ...previous,
      menu: {
        ...previous.menu,
        items: previous.menu.items.map((item) => (item.id === itemId ? updater(item) : item)),
      },
    }));
  }

  function moveMenuItem(itemId: WidgetChatbotMenuId, direction: "up" | "down") {
    setDraft((previous) => {
      const items = [...previous.menu.items];
      const index = items.findIndex((item) => item.id === itemId);
      if (index === -1) return previous;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return previous;

      const [moved] = items.splice(index, 1);
      items.splice(targetIndex, 0, moved);

      return {
        ...previous,
        menu: {
          ...previous.menu,
          items,
        },
      };
    });
  }

  function renderEditor(node: WidgetChatbotFlowNode) {
    switch (node.id) {
      case "welcome":
        return (
          <div className="space-y-4">
            <TextInput
              title="Header 標題"
              value={draft.header.title}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  header: { ...previous.header, title: value },
                }))
              }
              hint="Widget 頂部綠色 bar 顯示的名稱。"
            />
            <TextInput
              title="Header 副標題"
              value={draft.header.subtitle}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  header: { ...previous.header, subtitle: value },
                }))
              }
              hint="例如品牌英文名。"
            />
            <TextareaInput
              title="開場第一句"
              value={draft.greeting.title}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  greeting: { ...previous.greeting, title: value },
                }))
              }
              rows={3}
              hint="一打開 widget 就先見到。"
            />
            <TextareaInput
              title="開場補充句"
              value={draft.greeting.body}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  greeting: { ...previous.greeting, body: value },
                }))
              }
              rows={4}
              hint="通常用來講用途、真人交接提醒。"
            />
            <TextInput
              title="真人聯絡標題"
              value={draft.greeting.contactTitle}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  greeting: { ...previous.greeting, contactTitle: value },
                }))
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput
                title="Launcher 收起時文字"
                value={draft.header.launcherClosedLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    header: { ...previous.header, launcherClosedLabel: value },
                  }))
                }
              />
              <TextInput
                title="Launcher 展開時文字"
                value={draft.header.launcherOpenLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    header: { ...previous.header, launcherOpenLabel: value },
                  }))
                }
              />
              <TextInput
                title="重新開始按鈕"
                value={draft.header.restartButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    header: { ...previous.header, restartButtonLabel: value },
                  }))
                }
              />
            </div>
          </div>
        );
      case "mainMenu":
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
              主選單而家會一齊設定「顯示點樣」同「按落去去邊條 flow」，所以 label 同實際對話邏輯會同步。
            </div>
            <div className="space-y-3">
              {draft.menu.items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">主選單 Button {index + 1}</p>
                      <p className="text-xs text-slate-500">
                        按下後會去：{WIDGET_CHATBOT_MENU_TARGET_OPTIONS.find((option) => option.value === item.target)?.label || item.target}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateMenuItem(item.id, (current) => ({ ...current, visible: !current.visible }))}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700"
                    >
                      {item.visible ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {item.visible ? "顯示中" : "已隱藏"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <SectionLabel title="Button 顯示文字" />
                        <input
                          value={item.label}
                          onChange={(event) =>
                            updateMenuItem(item.id, (current) => ({ ...current, label: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <SectionLabel title="Button 去向" hint="按下這個主選單 button 之後，widget 會進入哪條流程。" />
                        <select
                          value={item.target}
                          onChange={(event) =>
                            updateMenuItem(item.id, (current) => {
                              const nextTarget = event.target.value as WidgetChatbotMenuId;
                              const currentDefaultLabel =
                                WIDGET_CHATBOT_MENU_TARGET_OPTIONS.find((option) => option.value === current.target)?.label
                                || current.target;
                              const shouldResetLabel =
                                current.label.trim() === "" || current.label === currentDefaultLabel;
                              const defaultLabel = WIDGET_CHATBOT_MENU_TARGET_OPTIONS.find((option) => option.value === nextTarget)?.label || nextTarget;

                              return {
                                ...current,
                                target: nextTarget,
                                label: shouldResetLabel ? defaultLabel : current.label,
                              };
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                        >
                          {WIDGET_CHATBOT_MENU_TARGET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <button
                        type="button"
                        onClick={() => moveMenuItem(item.id, "up")}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
                        aria-label={`Move ${item.id} up`}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMenuItem(item.id, "down")}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-200 hover:text-cyan-700"
                        aria-label={`Move ${item.id} down`}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "fees":
        return (
          <div className="space-y-4">
            <TextareaInput
              title="收費回覆"
              value={draft.flows.fees.reply}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    fees: { ...previous.flows.fees, reply: value },
                  },
                }))
              }
              rows={10}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                title="結束 button"
                value={draft.flows.fees.endButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      fees: { ...previous.flows.fees, endButtonLabel: value },
                    },
                  }))
                }
              />
              <TextInput
                title="返回主選單 button"
                value={draft.flows.fees.mainButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      fees: { ...previous.flows.fees, mainButtonLabel: value },
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      case "clinic":
        return (
          <div className="space-y-4">
            <TextareaInput
              title="診所資訊入口句"
              value={draft.flows.clinic.prompt}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    clinic: { ...previous.flows.clinic, prompt: value },
                  },
                }))
              }
              rows={3}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput
                title="營業時間 button"
                value={draft.flows.clinic.hoursButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      clinic: { ...previous.flows.clinic, hoursButtonLabel: value },
                    },
                  }))
                }
              />
              <TextInput
                title="地址 button"
                value={draft.flows.clinic.addressesButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      clinic: { ...previous.flows.clinic, addressesButtonLabel: value },
                    },
                  }))
                }
              />
              <TextInput
                title="返回主選單 button"
                value={draft.flows.clinic.backButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      clinic: { ...previous.flows.clinic, backButtonLabel: value },
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      case "clinicHours":
        return (
          <TextareaInput
            title="營業時間尾段文案"
            value={draft.flows.clinic.hoursClosingText}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                flows: {
                  ...previous.flows,
                  clinic: { ...previous.flows.clinic, hoursClosingText: value },
                },
              }))
            }
            rows={8}
            hint="系統會自動將真實營業時間接喺前面。"
          />
        );
      case "clinicAddresses":
        return (
          <TextareaInput
            title="地址提示句"
            value={draft.flows.clinic.addressesPrompt}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                flows: {
                  ...previous.flows,
                  clinic: { ...previous.flows.clinic, addressesPrompt: value },
                },
              }))
            }
            rows={3}
          />
        );
      case "booking":
        return (
          <TextareaInput
            title="預約入口句"
            value={draft.flows.booking.prompt}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                flows: {
                  ...previous.flows,
                  booking: { ...previous.flows.booking, prompt: value },
                },
              }))
            }
            rows={3}
            hint="之後醫師/日期/時段流程仍由系統控制。"
          />
        );
      case "timetable":
        return (
          <TextareaInput
            title="醫師時間表說明"
            value={draft.flows.timetable.reply}
            onChange={(value) =>
              setDraft((previous) => ({
                ...previous,
                flows: {
                  ...previous.flows,
                  timetable: { ...previous.flows.timetable, reply: value },
                },
              }))
            }
            rows={8}
          />
        );
      case "other":
        return (
          <div className="space-y-4">
            <TextareaInput
              title="AI 交接提示"
              value={draft.flows.other.prompt}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    other: { ...previous.flows.other, prompt: value },
                  },
                }))
              }
              rows={4}
            />
            <TextInput
              title="AI 連線中訊息"
              value={draft.flows.other.aiLoadingText}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    other: { ...previous.flows.other, aiLoadingText: value },
                  },
                }))
              }
            />
            <TextInput
              title="AI 出錯開頭句"
              value={draft.flows.other.aiErrorLead}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    other: { ...previous.flows.other, aiErrorLead: value },
                  },
                }))
              }
            />
          </div>
        );
      case "consult":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextareaInput
                title="第 1 條問題"
                value={draft.flows.consultation.prompts.reason}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        prompts: { ...previous.flows.consultation.prompts, reason: value },
                      },
                    },
                  }))
                }
                rows={4}
              />
              <TextInput
                title="第 1 條 placeholder"
                value={draft.flows.consultation.placeholders.reason}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        placeholders: { ...previous.flows.consultation.placeholders, reason: value },
                      },
                    },
                  }))
                }
              />
              <TextareaInput
                title="第 2 條問題"
                value={draft.flows.consultation.prompts.name}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        prompts: { ...previous.flows.consultation.prompts, name: value },
                      },
                    },
                  }))
                }
                rows={3}
              />
              <TextInput
                title="第 2 條 placeholder"
                value={draft.flows.consultation.placeholders.name}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        placeholders: { ...previous.flows.consultation.placeholders, name: value },
                      },
                    },
                  }))
                }
              />
              <TextareaInput
                title="第 3 條問題"
                value={draft.flows.consultation.prompts.email}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        prompts: { ...previous.flows.consultation.prompts, email: value },
                      },
                    },
                  }))
                }
                rows={3}
              />
              <TextInput
                title="第 3 條 placeholder"
                value={draft.flows.consultation.placeholders.email}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        placeholders: { ...previous.flows.consultation.placeholders, email: value },
                      },
                    },
                  }))
                }
              />
              <TextareaInput
                title="第 4 條問題"
                value={draft.flows.consultation.prompts.phone}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        prompts: { ...previous.flows.consultation.prompts, phone: value },
                      },
                    },
                  }))
                }
                rows={3}
              />
              <TextInput
                title="第 4 條 placeholder"
                value={draft.flows.consultation.placeholders.phone}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: {
                        ...previous.flows.consultation,
                        placeholders: { ...previous.flows.consultation.placeholders, phone: value },
                      },
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput
                title="提交中"
                value={draft.flows.consultation.submittingText}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: { ...previous.flows.consultation, submittingText: value },
                    },
                  }))
                }
              />
              <TextInput
                title="提交成功"
                value={draft.flows.consultation.successText}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: { ...previous.flows.consultation, successText: value },
                    },
                  }))
                }
              />
              <TextInput
                title="提交失敗"
                value={draft.flows.consultation.errorText}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      consultation: { ...previous.flows.consultation, errorText: value },
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      case "common":
        return (
          <div className="space-y-4">
            <TextareaInput
              title="返回主選單回覆"
              value={draft.flows.common.returnToMainText}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    common: { ...previous.flows.common, returnToMainText: value },
                  },
                }))
              }
              rows={3}
            />
            <TextareaInput
              title="結束句"
              value={draft.flows.common.endText}
              onChange={(value) =>
                setDraft((previous) => ({
                  ...previous,
                  flows: {
                    ...previous.flows,
                    common: { ...previous.flows.common, endText: value },
                  },
                }))
              }
              rows={3}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput
                title="返回主選單 button"
                value={draft.flows.common.returnMainButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      common: { ...previous.flows.common, returnMainButtonLabel: value },
                    },
                  }))
                }
              />
              <TextInput
                title="預約上一步 button"
                value={draft.flows.common.bookingBackButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      common: { ...previous.flows.common, bookingBackButtonLabel: value },
                    },
                  }))
                }
              />
              <TextInput
                title="預約取消 button"
                value={draft.flows.common.bookingCancelButtonLabel}
                onChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    flows: {
                      ...previous.flows,
                      common: { ...previous.flows.common, bookingCancelButtonLabel: value },
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Widget Chatbot
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            目前角色：{roleLabel(role)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            最後儲存：{formatDateTime(updatedAt)}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">客服 Widget 對話控制台</h1>
        <p className="max-w-4xl text-sm leading-6 text-slate-600">
          呢頁專係俾姑娘調整 WordPress / 網站 widget 客服機器人對答。唔係 G1/G2/G3 養生 chatbot。
          左邊睇 flow，中央改文字，右邊即時睇目前節點會點樣出現。
        </p>
      </header>

      {error ? (
        <div
          ref={statusBannerRef}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          ref={statusBannerRef}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Waypoints className="h-4 w-4 text-cyan-600" />
          <span>Flow-first 編輯：先揀節點，再改節點內文字。</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-sm font-medium ${
              saving
                ? "text-cyan-700"
                : saveStatus === "saved" && !hasUnsavedChanges
                  ? "text-emerald-700"
                  : hasUnsavedChanges
                    ? "text-amber-700"
                    : "text-slate-500"
            }`}
          >
            {saving
              ? "正在儲存設定..."
              : saveStatus === "saved" && !hasUnsavedChanges
                ? "所有改動已儲存"
                : hasUnsavedChanges
                  ? "有未儲存改動"
                  : "未有新改動"}
          </span>
          <button
            type="button"
            onClick={resetDraft}
            disabled={!hasUnsavedChanges || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCcw size={16} />
            還原未儲存改動
          </button>
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={!hasUnsavedChanges || saving}
            className={`inline-flex min-w-[170px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed ${
              saving
                ? "bg-cyan-700"
                : saveStatus === "saved" && !hasUnsavedChanges
                  ? "bg-emerald-600"
                  : hasUnsavedChanges
                    ? "bg-primary hover:bg-primary-hover"
                    : "bg-slate-300 disabled:opacity-100"
            }`}
          >
            {saving ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : saveStatus === "saved" && !hasUnsavedChanges ? (
              <CheckCircle2 size={16} />
            ) : (
              <Save size={16} />
            )}
            {saveButtonLabel}
          </button>
        </div>
      </div>

      {(saving || (saveStatus === "saved" && !hasUnsavedChanges)) ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-2xl ${
              saving ? "bg-cyan-700" : "bg-emerald-600"
            }`}
          >
            <div className="flex items-center gap-2">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>{saving ? "儲存中..." : "已儲存"}</span>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-slate-900">Flow Map</h2>
              <p className="text-xs leading-5 text-slate-500">姑娘先揀節點，再去右邊編輯內容。</p>
            </div>

            <div className="space-y-2">
              {WIDGET_CHATBOT_FLOW_NODES.map((node) => {
                const active = node.id === selectedNodeId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-cyan-300 bg-cyan-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{node.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{node.trigger}</p>
                      </div>
                      {active ? <Eye size={16} className="mt-0.5 text-cyan-700" /> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {node.nextSteps.map((step) => (
                        <span
                          key={step}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                {selectedNode.title}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">{selectedNode.description}</h2>
              <p className="text-sm leading-6 text-slate-500">
                觸發時機：{selectedNode.trigger}
              </p>
              <p className="text-sm leading-6 text-slate-500">
                可編輯範圍：{selectedNode.editScope}
              </p>
            </div>

            {renderEditor(selectedNode)}
          </section>

          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-20 xl:self-start">
            <div className="flex items-center gap-2">
              <MessageCircleMore className="h-4 w-4 text-cyan-700" />
              <h2 className="text-sm font-semibold text-slate-900">即時 Preview</h2>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3">
              <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-3 shadow-inner">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-center text-sm font-semibold leading-8 text-primary">
                    醫
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{draft.header.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{draft.header.subtitle}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {preview.bubbles.map((bubble, index) => {
                    if (bubble.role === "system") {
                      return (
                        <div
                          key={`${bubble.role}-${index}`}
                          className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
                        >
                          {bubble.text}
                        </div>
                      );
                    }

                    const isUser = bubble.role === "user";
                    return (
                      <div
                        key={`${bubble.role}-${index}`}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${
                            isUser
                              ? "bg-primary text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          {bubble.text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {preview.buttons.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {preview.buttons.map((button) => (
                      <span
                        key={button}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800"
                      >
                        {button}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-900">
              {preview.helper}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
