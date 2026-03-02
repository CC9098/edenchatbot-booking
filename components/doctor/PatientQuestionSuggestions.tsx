"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SuggestionAnswerType = "yes_no" | "scale_0_10" | "trend" | "frequency" | "free_text";

interface QuestionSuggestion {
  id: string;
  question: string;
  answerType: SuggestionAnswerType;
  symptomKey: string;
  reason: string;
  note: string;
}

interface QuestionSuggestionResponse {
  summary: string;
  suggestions: QuestionSuggestion[];
  usedFallback?: boolean;
  model?: string | null;
  generatedAt?: string;
  error?: string;
}

const YES_NO_OPTIONS = ["有", "冇", "未清楚"];
const TREND_OPTIONS = ["好轉", "無變", "惡化"];
const FREQUENCY_OPTIONS = ["偶發", "每日", "持續", "夜晚多"];

function answerTypeLabel(answerType: SuggestionAnswerType): string {
  if (answerType === "yes_no") return "是/否";
  if (answerType === "scale_0_10") return "0-10 分";
  if (answerType === "trend") return "變化";
  if (answerType === "frequency") return "頻率";
  return "文字";
}

function formatGeneratedAt(dateString: string | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function PatientQuestionSuggestions({
  patientUserId,
  patientName,
}: {
  patientUserId: string;
  patientName: string | null;
}) {
  const [data, setData] = useState<QuestionSuggestionResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/doctor/patients/${patientUserId}/question-suggestions`);
      const payload = (await response.json().catch(() => ({}))) as QuestionSuggestionResponse;
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setData({
        summary: payload.summary || "",
        suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
        usedFallback: payload.usedFallback,
        model: payload.model,
        generatedAt: payload.generatedAt,
      });
      setAnswers({});
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "問診建議載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientUserId]);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions]);

  const copyBundleText = useMemo(() => {
    if (!data) return "";

    const lines = data.suggestions.map((suggestion, index) => {
      const answer = answers[suggestion.id]?.trim();
      return `${index + 1}. ${suggestion.question}${answer ? `\n暫記答案：${answer}` : ""}`;
    });

    const heading = patientName ? `${patientName}｜AI 問診建議` : "AI 問診建議";
    const summary = data.summary ? `重點：${data.summary}` : "";
    return [heading, summary, ...lines].filter(Boolean).join("\n\n");
  }, [answers, data, patientName]);

  async function copyBundle() {
    if (!copyBundleText) return;
    try {
      await navigator.clipboard.writeText(copyBundleText);
      setCopyStatus("問診建議已複製");
      setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("複製失敗，請手動選取文字");
      setTimeout(() => setCopyStatus(null), 2500);
    }
  }

  function setAnswer(suggestionId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [suggestionId]: value,
    }));
  }

  function renderAnswerControls(suggestion: QuestionSuggestion) {
    const currentValue = answers[suggestion.id] || "";

    if (suggestion.answerType === "scale_0_10") {
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 11 }, (_, value) => String(value)).map((value) => {
              const isActive = currentValue === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setAnswer(suggestion.id, value)}
                  className={`min-h-9 min-w-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/[0.05]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">0 = 無 / 10 = 最嚴重</p>
        </div>
      );
    }

    const options =
      suggestion.answerType === "yes_no"
        ? YES_NO_OPTIONS
        : suggestion.answerType === "trend"
          ? TREND_OPTIONS
          : suggestion.answerType === "frequency"
            ? FREQUENCY_OPTIONS
            : null;

    if (options) {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isActive = currentValue === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isActive}
                onClick={() => setAnswer(suggestion.id, option)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/[0.05]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={currentValue}
        onChange={(event) => setAnswer(suggestion.id, event.target.value)}
        placeholder="輸入即場答案..."
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-cyan-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">AI 問診建議</h2>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-cyan-900 ring-1 ring-cyan-100">
              {data?.usedFallback ? "基礎建議" : "AI 即時建議"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            根據病人最近症狀、體質、覆診同指引，先俾醫師睇一排可直接口問嘅問題卡。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchSuggestions()}
            disabled={loading}
            className="min-h-11 rounded-md border border-cyan-200 bg-white px-3 py-2 text-sm font-medium text-cyan-900 transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "更新中..." : "重新產生"}
          </button>
          <button
            type="button"
            onClick={() => void copyBundle()}
            disabled={!data || data.suggestions.length === 0}
            className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            複製問題卡
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void fetchSuggestions()}
              className="mt-3 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-red-200"
            >
              重試
            </button>
          </div>
        ) : !data || data.suggestions.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-sm text-gray-600">
            目前未能產生問診建議。
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-white/80 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-900">
                  今次先問
                </span>
                {data.generatedAt ? (
                  <span className="text-xs text-gray-500">更新時間：{formatGeneratedAt(data.generatedAt)}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-700">{data.summary || "先從目前最困擾症狀開始，逐步追問分數與變化。"}</p>
              <p className="mt-2 text-xs text-gray-500">
                目前為醫師即場提詞版；答案暫存在此頁，未自動寫入 chart 或症狀資料庫。
              </p>
            </div>

            {copyStatus ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {copyStatus}
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-2">
              {data.suggestions.map((suggestion, index) => (
                <article
                  key={suggestion.id}
                  className="rounded-xl border border-white/80 bg-white/95 p-4 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                        問題 {index + 1}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {answerTypeLabel(suggestion.answerType)}
                      </span>
                    </div>
                    {answers[suggestion.id] ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        暫記：{answers[suggestion.id]}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-base font-semibold leading-7 text-gray-900">
                    {suggestion.question}
                  </p>

                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">點解問</p>
                    <p className="mt-1 text-sm leading-6 text-gray-700">{suggestion.reason || "按現有病歷脈絡建議先跟進。"}</p>
                  </div>

                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">即場答案</p>
                    {renderAnswerControls(suggestion)}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    <p className="text-xs leading-5 text-gray-500">
                      {suggestion.note || "答完之後可再問持續時間、誘因同緩解因素。"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(suggestion.question)
                          .then(() => {
                            setCopyStatus("問題已複製");
                            setTimeout(() => setCopyStatus(null), 2000);
                          })
                          .catch(() => {
                            setCopyStatus("複製失敗，請手動選取文字");
                            setTimeout(() => setCopyStatus(null), 2500);
                          });
                      }}
                      className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      複製此題
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
