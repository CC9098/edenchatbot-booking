"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  GraduationCap,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

type LessonStep = {
  id: string;
  title: string;
  action: string;
  check: string;
  warning: string;
};

type ReplyOption = {
  id: string;
  label: string;
  correct: boolean;
  note: string;
};

const LESSON_STEPS: LessonStep[] = [
  {
    id: "triage",
    title: "判斷",
    action: "先分清本地、過海、偏遠或海外。",
    check: "本地可考慮 Lalamove / 順豐；海外轉郵局流程。",
    warning: "不要未查運費就承諾立即寄出。",
  },
  {
    id: "quote",
    title: "報價",
    action: "先查運費，再向病人確認。",
    check: "超過 $100 運費，要先 WhatsApp 問病人意願。",
    warning: "繁忙附加費高時，先給病人選擇。",
  },
  {
    id: "reply",
    title: "回覆",
    action: "用一句清楚回覆：可安排、先查價、何時再確認。",
    check: "病人要聽到下一步，不是內部流程。",
    warning: "不要講太多診所內部術語。",
  },
  {
    id: "record",
    title: "記錄",
    action: "把運費和安排寫回預約紀錄。",
    check: "同事之後可以追到病人已同意的運費。",
    warning: "不要只靠口頭記憶。",
  },
];

const REPLY_OPTIONS: ReplyOption[] = [
  {
    id: "fast",
    label: "可以，我現在幫你叫車，幾錢都照寄。",
    correct: false,
    note: "未查價、未確認超過 $100，風險太高。",
  },
  {
    id: "safe",
    label: "可以，我先查運費；如超過 $100 會先 WhatsApp 確認。若繁忙加價，可等回落或即時安排。",
    correct: true,
    note: "有下一步、有價錢界線、有病人選擇。",
  },
  {
    id: "vague",
    label: "寄藥應該可以，你等一等。",
    correct: false,
    note: "太含糊，新人容易漏了查價、確認和記錄。",
  },
];

const RELEASE_CHECKS = [
  "分到本地 / 海外寄藥",
  "講到超過 $100 先確認",
  "識處理繁忙加價",
  "記得寫回預約紀錄",
];

export function NurseTeachingLessonClient() {
  const [activeStepId, setActiveStepId] = useState(LESSON_STEPS[0].id);
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const activeStep = useMemo(
    () => LESSON_STEPS.find((step) => step.id === activeStepId) || LESSON_STEPS[0],
    [activeStepId],
  );
  const selectedReply = REPLY_OPTIONS.find((option) => option.id === selectedReplyId);
  const completedChecks = RELEASE_CHECKS.filter((item) => checkedItems[item]).length;
  const progress = Math.round((completedChecks / RELEASE_CHECKS.length) * 100);

  function toggleCheck(item: string) {
    setCheckedItems((current) => ({
      ...current,
      [item]: !current[item],
    }));
  }

  function resetLesson() {
    setActiveStepId(LESSON_STEPS[0].id);
    setSelectedReplyId(null);
    setCheckedItems({});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-amber-800">教學試驗</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              寄藥情境課
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              病人問寄藥：先判斷、再報價、最後記錄。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/nurse/knowledge"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
            >
              <BookOpenCheck className="h-4 w-4" />
              寄藥 SOP
            </Link>
            <Link
              href="/nurse/quiz"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
            >
              小測驗
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <GraduationCap className="h-4 w-4 text-amber-700" />
            學習路線
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {LESSON_STEPS.map((step, index) => {
              const active = step.id === activeStepId;

              return (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveStepId(step.id)}
                  className={`min-h-24 rounded-lg border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${
                    active
                      ? "border-amber-300 bg-amber-50 text-amber-950"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-200 hover:bg-amber-50/60"
                  }`}
                >
                  <span className="text-xs font-semibold">Step {index + 1}</span>
                  <span className="mt-2 block text-base font-semibold">{step.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-semibold text-amber-800">現在做</div>
            <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
              {activeStep.action}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="text-xs font-semibold text-emerald-800">要核對</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeStep.check}</p>
              </div>
              <div className="rounded-lg border border-white bg-white/80 p-3">
                <div className="text-xs font-semibold text-rose-800">不要做</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{activeStep.warning}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <ClipboardCheck className="h-4 w-4" />
            放行
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-emerald-700 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm font-semibold text-emerald-950">
            {completedChecks}/{RELEASE_CHECKS.length} 已掌握
          </div>
          <div className="mt-4 space-y-2">
            {RELEASE_CHECKS.map((item) => {
              const done = Boolean(checkedItems[item]);
              const Icon = done ? CheckCircle2 : Circle;

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={done}
                  onClick={() => toggleCheck(item)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                    done
                      ? "border-emerald-300 bg-white text-emerald-950"
                      : "border-emerald-100 bg-white/70 text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${done ? "text-emerald-700" : "text-slate-400"}`} />
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-950">
            <Send className="h-4 w-4" />
            病人訊息
          </div>
          <p className="mt-4 text-lg font-semibold leading-8 text-slate-950">
            「我想寄藥去元朗，今日可唔可以？如果太貴就遲少少都得。」
          </p>
          <p className="mt-4 text-sm leading-6 text-cyan-950/80">
            目標：病人知道會先查價，並知道何時要確認。
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-950">揀一句回覆</div>
          <div className="mt-4 space-y-3">
            {REPLY_OPTIONS.map((option, index) => {
              const selected = option.id === selectedReplyId;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedReplyId(option.id)}
                  className={`flex w-full gap-3 rounded-lg border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100 ${
                    selected
                      ? option.correct
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-rose-300 bg-rose-50"
                      : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/60"
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-6 text-slate-950">
                      {option.label}
                    </span>
                    {selected ? (
                      <span
                        className={`mt-2 flex items-start gap-2 text-sm leading-6 ${
                          option.correct ? "text-emerald-800" : "text-rose-800"
                        }`}
                      >
                        {option.correct ? (
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />
                        ) : (
                          <XCircle className="mt-1 h-4 w-4 shrink-0" />
                        )}
                        {option.note}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetLesson}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              重做
            </button>
            {selectedReply?.correct ? (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                可以進下一關
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
