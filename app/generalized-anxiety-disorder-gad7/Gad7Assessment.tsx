"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

const responseOptions = [
  { value: 0, label: "完全沒有" },
  { value: 1, label: "有幾日" },
  { value: 2, label: "超過一半日子" },
  { value: 3, label: "幾乎每日" },
] as const;

const questions = [
  "經常覺得緊張、焦慮，或心裡不安",
  "很難停止或控制擔心",
  "對不同事情擔心得太多",
  "難以放鬆",
  "坐立不安，難以安靜下來",
  "容易煩躁或被小事激怒",
  "害怕會有不好的事情發生",
] as const;

function getSeverity(score: number) {
  if (score >= 15) {
    return {
      label: "重度焦慮症狀",
      tone: "text-[#9a3412]",
      bg: "bg-[#fff7ed]",
      border: "border-[#fed7aa]",
      message: "建議盡快由專業人士進一步評估，並以量表持續追蹤變化。",
    };
  }

  if (score >= 10) {
    return {
      label: "中度焦慮症狀",
      tone: "text-[#8a5b10]",
      bg: "bg-[#fffbeb]",
      border: "border-[#fde68a]",
      message: "分數已達常用的進一步評估參考線，建議預約檢視症狀與生活影響。",
    };
  }

  if (score >= 5) {
    return {
      label: "輕度焦慮症狀",
      tone: "text-[#1f6b3f]",
      bg: "bg-[#eef8ef]",
      border: "border-[#cfe8d4]",
      message: "可先記錄基線，配合睡眠、胃口、胸悶、心悸等身體訊號一同觀察。",
    };
  }

  return {
    label: "焦慮程度較低",
    tone: "text-[#1f6b3f]",
    bg: "bg-white",
    border: "border-[#d8e2d8]",
    message: "如症狀已影響工作、睡眠或家庭生活，即使分數較低亦可預約了解。",
  };
}

function buildBookingHref(score: number) {
  const params = new URLSearchParams({
    doctor: "cheungmy",
    visitType: "first",
    source: "gad7-anxiety-page",
    gad7: String(score),
  });

  return `/booking?${params.toString()}`;
}

export function Gad7Assessment() {
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(questions.length).fill(null));
  const completedCount = answers.filter((value): value is number => value !== null).length;
  const isComplete = completedCount === questions.length;
  const score = answers.reduce<number>((total, value) => total + (value ?? 0), 0);
  const severity = getSeverity(score);
  const bookingHref = useMemo(
    () =>
      isComplete
        ? buildBookingHref(score)
        : "/booking?doctor=cheungmy&visitType=first&source=gad7-anxiety-page",
    [isComplete, score]
  );

  return (
    <section id="gad7" className="bg-[#f4f6f1] px-5 py-14 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.74fr)_minmax(360px,0.42fr)] lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">
              <BarChart3 className="h-4 w-4" />
              GAD-7 焦慮量表
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl">
              量表不是取代辨證，而是讓調理有清晰基線
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#496153]">
              請回想過去兩星期。每題選擇最接近你的情況，系統會即時計算總分。張敏言醫師會把分數與舌脈、睡眠、胃口、胸悶、心悸和情志誘因一同參考。
            </p>

            <div className="mt-8 overflow-hidden rounded-[24px] border border-[#d8e2d8] bg-white shadow-[0_22px_60px_-44px_rgba(15,63,42,0.75)]">
              {questions.map((question, questionIndex) => (
                <div
                  key={question}
                  className="grid gap-4 border-b border-[#edf1ea] p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(360px,1fr)] lg:items-center"
                >
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7f1e8] text-sm font-semibold text-[#1f6b3f]">
                      {questionIndex + 1}
                    </span>
                    <p className="pt-1 text-base font-semibold leading-relaxed text-[#20382a]">
                      {question}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {responseOptions.map((option) => {
                      const selected = answers[questionIndex] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setAnswers((current) =>
                              current.map((value, index) =>
                                index === questionIndex ? option.value : value
                              )
                            );
                          }}
                          className={[
                            "min-h-12 rounded-[14px] border px-2 py-2 text-sm font-semibold transition",
                            selected
                              ? "border-[#0d4c2d] bg-[#0d4c2d] text-white shadow-sm"
                              : "border-[#d8e2d8] bg-[#fbfdf9] text-[#496153] hover:border-[#9fc6a6] hover:bg-[#f4faf4]",
                          ].join(" ")}
                          aria-pressed={selected}
                        >
                          <span className="block text-xs opacity-75">{option.value} 分</span>
                          <span className="block leading-tight">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="sticky top-6 rounded-[26px] border border-[#d7c6a7] bg-white p-5 shadow-[0_24px_70px_-48px_rgba(15,63,42,0.8)]">
            <p className="text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">即時計分</p>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-6xl font-semibold leading-none text-[#0d4c2d]">
                {isComplete ? score : "—"}
              </p>
              <p className="pb-2 text-sm font-semibold text-[#496153]">/ 21 分</p>
            </div>

            <div className={`mt-5 rounded-[20px] border p-4 ${severity.bg} ${severity.border}`}>
              <p className={`text-lg font-semibold ${isComplete ? severity.tone : "text-[#0d4c2d]"}`}>
                {isComplete ? severity.label : "尚未完成量表"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                {isComplete
                  ? severity.message
                  : `已完成 ${completedCount} / ${questions.length} 題。完成 7 題後，系統會顯示總分及分級參考。`}
              </p>
            </div>

            <div className="mt-5 space-y-2 text-sm leading-relaxed text-[#496153]">
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b3f]" />
                初診記錄分數，配合中醫辨證建立調理方向。
              </p>
              <p className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b3f]" />
                覆診比較焦慮、睡眠、胃口、心悸、胸悶和精神狀態。
              </p>
            </div>

            <Link
              href={bookingHref}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-[#0d4c2d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
            >
              {isComplete ? "帶同分數預約張敏言醫師" : "直接預約張敏言醫師"}
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="mt-4 rounded-[18px] border border-[#fed7aa] bg-[#fff7ed] p-4 text-sm leading-relaxed text-[#7c2d12]">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  如有自殘、自殺念頭，或可能即時傷害自己或他人，請即時到急症室、致電 999，或聯絡 18111 精神健康支援熱線。
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
