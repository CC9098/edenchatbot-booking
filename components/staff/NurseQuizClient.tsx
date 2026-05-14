"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type QuizOption = {
  id: string;
  text: string;
};

type QuizQuestion = {
  id: string;
  title: string;
  scenario: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
};

type StoredResult = {
  score: number;
  total: number;
  completedAt: string;
};

const STORAGE_KEY = "eden-nurse-quiz-result-v1";
const PASS_SCORE = 5;

const QUESTIONS: QuizQuestion[] = [
  {
    id: "safe-close",
    title: "唔肯定點答",
    scenario: "病人問一件你未肯定的事，例如收費、保險、醫師安排。",
    options: [
      { id: "guess", text: "先估一個答案，之後錯咗再改。" },
      { id: "safe", text: "我先幫您確認清楚，再 WhatsApp 回覆您。" },
      { id: "ask-ai", text: "即刻問 AI，AI 答咩就照講。" },
    ],
    correctOptionId: "safe",
    explanation: "新人第一原則是不估。先收口、記低資料、再交當值同事或主管確認。",
  },
  {
    id: "record-question",
    title: "記低病人問題",
    scenario: "病人打電話問完一個要跟進的查詢。",
    options: [
      { id: "name-only", text: "只記低病人姓名，其他等同事再問。" },
      { id: "full", text: "記低姓名、電話、問題、想聯絡的分店或醫師。" },
      { id: "no-record", text: "如果問題簡單，可以不記錄。" },
    ],
    correctOptionId: "full",
    explanation: "要讓下一位同事可以接手，最少要有姓名、電話、問題和回覆方向。",
  },
  {
    id: "today-slot",
    title: "病人想今日睇",
    scenario: "病人問：今日一定有無位？可唔可以幫我插位？",
    options: [
      { id: "promise", text: "答應盡量插位，叫病人直接過來。" },
      { id: "check", text: "先查系統可約時段，今日滿就提供最近可約時間。" },
      { id: "medical", text: "問病情後代病人決定一定要今日睇。" },
    ],
    correctOptionId: "check",
    explanation: "姑娘只按系統可見時段處理，不承諾加位，也不替病人作醫療判斷。",
  },
  {
    id: "receipt-insurance",
    title: "收據 / 保險",
    scenario: "病人問：呢張收據一定 claim 到保險嗎？",
    options: [
      { id: "guarantee", text: "答一定 claim 到，因為診所開的收據通常得。" },
      { id: "safe", text: "不保證保險結果，先查紀錄和按診所收據流程處理。" },
      { id: "doctor-sign", text: "答醫師一定即日簽好所有文件。" },
    ],
    correctOptionId: "safe",
    explanation: "保險結果由保險公司決定；姑娘不可保證 claim 到或承諾醫師即日簽。",
  },
  {
    id: "delivery",
    title: "寄藥資料",
    scenario: "病人想寄藥，問你而家要俾咩資料。",
    options: [
      { id: "address-only", text: "只要地址就可以安排。" },
      { id: "complete", text: "收姓名、電話、完整地址、方便收件時間；運費或海外先確認。" },
      { id: "promise-today", text: "直接承諾一定今日送到。" },
    ],
    correctOptionId: "complete",
    explanation: "寄藥要收齊收件資料；海外、貴重藥物、運費偏高或投訴要升級確認。",
  },
  {
    id: "restricted",
    title: "密碼 / OTP / 銀行資料",
    scenario: "同事或病人問你後台密碼、OTP、銀行完整資料。",
    options: [
      { id: "share", text: "如果對方似係同事，可以直接講。" },
      { id: "restricted", text: "這類資料不可在一般對話講，按指定流程交主管。" },
      { id: "ai", text: "問 AI 有無記錄，再照 AI 回覆。" },
    ],
    correctOptionId: "restricted",
    explanation: "restricted 資料不可由新人自行回覆，也不應放入 AI 或病人對話。",
  },
];

function readStoredResult(): StoredResult | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      parsed &&
      typeof parsed.score === "number" &&
      typeof parsed.total === "number" &&
      typeof parsed.completedAt === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function formatStoredDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-HK", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NurseQuizClient() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null);

  useEffect(() => {
    setStoredResult(readStoredResult());
  }, []);

  const answeredCount = useMemo(
    () => QUESTIONS.filter((question) => answers[question.id]).length,
    [answers],
  );

  const score = useMemo(
    () => QUESTIONS.filter((question) => answers[question.id] === question.correctOptionId).length,
    [answers],
  );

  const passed = score >= PASS_SCORE;
  const canSubmit = answeredCount === QUESTIONS.length;

  function chooseAnswer(questionId: string, optionId: string) {
    if (submitted) return;
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  function submitQuiz() {
    if (!canSubmit) return;
    setSubmitted(true);
    const nextResult = {
      score,
      total: QUESTIONS.length,
      completedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextResult));
    setStoredResult(nextResult);
  }

  function resetQuiz() {
    setAnswers({});
    setSubmitted(false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-800">姑娘小測驗</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              前台安全判斷 Test
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              6 題實務情境。目標不是背答案，而是識得收口、查資料、問主管。
            </p>
          </div>

          <div className="grid min-w-[220px] gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="text-xs font-semibold text-emerald-800">完成進度</div>
            <div className="text-2xl font-semibold text-emerald-950">
              {answeredCount}/{QUESTIONS.length}
            </div>
            {storedResult ? (
              <div className="text-xs leading-5 text-emerald-900/80">
                上次：{storedResult.score}/{storedResult.total} · {formatStoredDate(storedResult.completedAt)}
              </div>
            ) : (
              <div className="text-xs leading-5 text-emerald-900/80">未有測驗紀錄</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {QUESTIONS.map((question, index) => {
          const selectedOptionId = answers[question.id];
          const isCorrect = selectedOptionId === question.correctOptionId;

          return (
            <fieldset
              key={question.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <legend className="sr-only">{question.title}</legend>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-500">第 {index + 1} 題</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{question.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{question.scenario}</p>
                </div>
                {submitted ? (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      isCorrect
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isCorrect ? "答對" : "要重溫"}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2">
                {question.options.map((option) => {
                  const checked = selectedOptionId === option.id;
                  const isAnswer = option.id === question.correctOptionId;
                  const showCorrect = submitted && isAnswer;
                  const showWrong = submitted && checked && !isAnswer;

                  return (
                    <label
                      key={option.id}
                      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm leading-6 transition ${
                        showCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : showWrong
                            ? "border-rose-300 bg-rose-50 text-rose-950"
                            : checked
                              ? "border-teal-300 bg-teal-50 text-teal-950"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/70"
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={checked}
                        disabled={submitted}
                        onChange={() => chooseAnswer(question.id, option.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-700"
                      />
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </div>

              {submitted ? (
                <div className="mt-4 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-3 text-sm leading-6 text-cyan-950">
                  {question.explanation}
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </section>

      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        {submitted ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
                passed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}>
                {passed ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {passed ? "過關" : "未過關"}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                {score}/{QUESTIONS.length}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {passed
                  ? "可以做 Day 1 低風險前台任務；高風險情況仍然要問主管。"
                  : "建議重溫錯題，再跟住上手棋盤練一次安全收口。"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={resetQuiz}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                重做
              </button>
              <Link
                href="/nurse/onboarding"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                上手棋盤
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/nurse/knowledge"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                查 SOP
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ClipboardCheck className="h-4 w-4" />
                過關分數：{PASS_SCORE}/{QUESTIONS.length}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                答晒 6 題就可以交卷。
              </p>
            </div>
            <button
              type="button"
              onClick={submitQuiz}
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              交卷
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
