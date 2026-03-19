"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CHATBOT_PROMPT_DESCRIPTIONS,
  CHATBOT_PROMPT_LABELS,
  CHATBOT_PROMPT_TYPES,
  type ChatbotPromptType,
} from "@/lib/chatbot-prompt-settings";

type StaffRole = "doctor" | "assistant" | "admin";

interface ChatbotSettingItem {
  type: ChatbotPromptType;
  variant: string | null;
  enabled: boolean;
  isActive: boolean;
  promptMd: string;
  gearG1Md: string;
  gearG2Md: string;
  gearG3Md: string;
  extraInstructionsMd: string;
  updatedAt: string;
  canEditCorePrompt: boolean;
}

interface DraftState {
  extraInstructionsMd: string;
  gearG1Md: string;
  gearG2Md: string;
  gearG3Md: string;
  promptMd: string;
}

interface SettingsResponse {
  role: StaffRole;
  items: ChatbotSettingItem[];
}

const GEAR_COPY = [
  {
    key: "gearG1Md" as const,
    title: "G1 初步回覆",
    hint: "適合第一輪回應，短一點、穩定一點，先接住用戶。",
  },
  {
    key: "gearG2Md" as const,
    title: "G2 延伸回覆",
    hint: "適合已有上下文時，補多一層分析、生活建議或低頻預約引導。",
  },
  {
    key: "gearG3Md" as const,
    title: "G3 深入回覆",
    hint: "適合較複雜情況，用較完整角度整理與拆解。",
  },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createDraft(item: ChatbotSettingItem): DraftState {
  return {
    extraInstructionsMd: item.extraInstructionsMd,
    gearG1Md: item.gearG1Md,
    gearG2Md: item.gearG2Md,
    gearG3Md: item.gearG3Md,
    promptMd: item.promptMd,
  };
}

function isDraftEqual(item: ChatbotSettingItem, draft: DraftState | null): boolean {
  if (!draft) return true;

  return (
    draft.extraInstructionsMd === item.extraInstructionsMd &&
    draft.gearG1Md === item.gearG1Md &&
    draft.gearG2Md === item.gearG2Md &&
    draft.gearG3Md === item.gearG3Md &&
    draft.promptMd === item.promptMd
  );
}

export default function DoctorChatbotSettingsPage() {
  const [items, setItems] = useState<ChatbotSettingItem[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<ChatbotPromptType, DraftState>>>({});
  const [role, setRole] = useState<StaffRole>("assistant");
  const [selectedType, setSelectedType] = useState<ChatbotPromptType>("depleting");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/doctor/chatbot/settings", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<SettingsResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const nextItems = payload.items ?? [];
      setItems(nextItems);
      setRole(payload.role ?? "assistant");
      setDrafts(
        nextItems.reduce<Partial<Record<ChatbotPromptType, DraftState>>>((accumulator, item) => {
          accumulator[item.type] = createDraft(item);
          return accumulator;
        }, {})
      );

      setSelectedType((previous) =>
        nextItems.some((item) => item.type === previous) ? previous : nextItems[0]?.type ?? previous
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "載入 chatbot 設定失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const currentItem = useMemo(
    () => items.find((item) => item.type === selectedType) ?? null,
    [items, selectedType]
  );
  const currentDraft = currentItem ? drafts[currentItem.type] ?? null : null;
  const hasUnsavedChanges = currentItem ? !isDraftEqual(currentItem, currentDraft) : false;

  function updateDraft(field: keyof DraftState, value: string) {
    if (!currentItem) return;
    setDrafts((previous) => ({
      ...previous,
      [currentItem.type]: {
        ...(previous[currentItem.type] ?? createDraft(currentItem)),
        [field]: value,
      },
    }));
  }

  function resetCurrentDraft() {
    if (!currentItem) return;
    setDrafts((previous) => ({
      ...previous,
      [currentItem.type]: createDraft(currentItem),
    }));
    setMessage("已還原到最近一次儲存版本。");
    setError(null);
  }

  async function saveCurrent() {
    if (!currentItem || !currentDraft) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/doctor/chatbot/settings/${currentItem.type}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extraInstructionsMd: currentDraft.extraInstructionsMd,
          gearG1Md: currentDraft.gearG1Md,
          gearG2Md: currentDraft.gearG2Md,
          gearG3Md: currentDraft.gearG3Md,
          ...(currentItem.canEditCorePrompt ? { promptMd: currentDraft.promptMd } : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        item?: ChatbotSettingItem;
        error?: string;
      };

      if (!response.ok || !payload.item) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const updatedItem = payload.item;
      setItems((previous) =>
        previous.map((item) => (item.type === updatedItem.type ? updatedItem : item))
      );
      setDrafts((previous) => ({
        ...previous,
        [updatedItem.type]: createDraft(updatedItem),
      }));
      setMessage(`${CHATBOT_PROMPT_LABELS[updatedItem.type]} 對話設定已更新，chat v2 會即時讀取新內容。`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  const selectedLabel = currentItem ? CHATBOT_PROMPT_LABELS[currentItem.type] : "Chatbot";
  const roleLabel = role === "assistant" ? "姑娘" : role === "admin" ? "管理員" : "醫師";

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Wellness Chatbot Console
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            目前角色：{roleLabel}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">養生 Chatbot 對話控制台</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          呢頁係 G1 / G2 / G3 養生 chatbot 用，俾姑娘直接調整三種體質 chatbot 的說話方式、回覆深度同額外指示。儲存之後，
          <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
            /api/chat/v2
          </span>
          會即時讀取最新設定。
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">體質模式</h2>
            <p className="text-xs leading-5 text-slate-500">左邊揀模式，右邊即時編輯對話語氣。</p>
          </div>

          <div className="space-y-2">
            {CHATBOT_PROMPT_TYPES.map((type) => {
              const item = items.find((candidate) => candidate.type === type);
              const active = selectedType === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setError(null);
                    setMessage(null);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-cyan-300 bg-cyan-50 shadow-sm"
                      : "border-slate-200 bg-slate-50/70 hover:border-cyan-200 hover:bg-cyan-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{CHATBOT_PROMPT_LABELS[type]}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{CHATBOT_PROMPT_DESCRIPTIONS[type]}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        item?.isActive && item.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {item?.isActive && item.enabled ? "生效中" : "未啟用"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>variant: {item?.variant || "--"}</span>
                    <span>更新於 {item ? formatDateTime(item.updatedAt) : "--"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            建議 workflow：先改「額外指示」同 G1/G2/G3，再去測試真實對話。若想動到底層模板，
            只限 admin 進入進階區塊。
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
            </div>
          ) : !currentItem || !currentDraft ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              暫時未找到 chatbot 設定。
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedLabel}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    {CHATBOT_PROMPT_DESCRIPTIONS[currentItem.type]}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>最後更新</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDateTime(currentItem.updatedAt)}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-semibold text-slate-900">額外對話指示</label>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    適合放語氣方向、禁忌句式、想強調的臨床說話習慣。
                  </p>
                  <textarea
                    value={currentDraft.extraInstructionsMd}
                    onChange={(event) => updateDraft("extraInstructionsMd", event.target.value)}
                    rows={12}
                    className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-900">編輯提示</h2>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-3 shadow-sm">
                      盡量寫成「希望 AI 點講」而唔係抽象形容詞。例如：
                      <span className="mt-2 block rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                        先接住病人感受，再講建議；每次只問一條跟進問題；避免好似責備咁糾正病人。
                      </span>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-3 shadow-sm">
                      如果只想微調對話深淺，優先改 G1 / G2 / G3，不用先動底層 prompt。
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white px-3 py-3 shadow-sm">
                      儲存後建議即刻用真實句子測試，例如「最近成日攰又訓得唔好」。
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {GEAR_COPY.map((section) => (
                  <div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-900">{section.title}</label>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{section.hint}</p>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {(currentDraft[section.key] || "").length} 字元
                      </span>
                    </div>
                    <textarea
                      value={currentDraft[section.key]}
                      onChange={(event) => updateDraft(section.key, event.target.value)}
                      rows={7}
                      className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm text-slate-900 transition-colors focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                ))}
              </div>

              {currentItem.canEditCorePrompt ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">進階區塊：核心 Prompt</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        只限 admin。請保留
                        <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          {`{{KNOWLEDGE}}`}
                        </span>
                        、
                        <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          {`{{SOURCES}}`}
                        </span>
                        同
                        <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                          {`{{EXTRA_INSTRUCTIONS}}`}
                        </span>
                        等 placeholder。
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white">
                      admin only
                    </span>
                  </div>
                  <textarea
                    value={currentDraft.promptMd}
                    onChange={(event) => updateDraft("promptMd", event.target.value)}
                    rows={16}
                    className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm text-slate-600">
                  {hasUnsavedChanges ? "你有未儲存修改。" : "目前內容已同步到最新儲存版本。"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={resetCurrentDraft}
                    disabled={saving || !hasUnsavedChanges}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    還原
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveCurrent()}
                    disabled={saving || !hasUnsavedChanges}
                    className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "儲存中..." : "儲存 chatbot 設定"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
