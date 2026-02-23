"use client";

import Link from "next/link";
import { useState } from "react";
import { getConstitutionDietTips } from "@/lib/constitution-diet-tips";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConstitutionKey = "depleting" | "crossing" | "hoarding" | "mixed" | "unknown";
type AnswerKey = ConstitutionKey | "neutral";

type Option = {
  id: AnswerKey;
  label: string;
};

type Question = {
  id: string;
  text: string;
  options: Option[];
};

type Scores = Record<"depleting" | "crossing" | "hoarding", number>;

// ---------------------------------------------------------------------------
// Questions  (3 questions – expandable later)
// ---------------------------------------------------------------------------

const QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "你平日精力狀態如何？",
    options: [
      { id: "neutral", label: "精力充沛，不太疲累" },
      { id: "depleting", label: "容易疲倦，稍動即累，比別人更需要休息" },
      { id: "hoarding", label: "感覺沉重、懶惰不想動，全身提不起勁" },
      { id: "crossing", label: "精力時好時壞，跟心情或壓力有很大關係" },
    ],
  },
  {
    id: "q2",
    text: "你平日情緒及壓力狀況如何？",
    options: [
      { id: "neutral", label: "情緒平穩，壓力一般可以應付" },
      { id: "depleting", label: "容易感到疲憊虛弱，情緒低落，比較怕冷" },
      { id: "hoarding", label: "情緒比較平淡，行動緩慢，較少受外界波動影響" },
      { id: "crossing", label: "容易緊張焦慮、思慮過多，情緒起伏較大" },
    ],
  },
  {
    id: "q3",
    text: "你的體型及消化情況如何？",
    options: [
      { id: "neutral", label: "體型適中，消化一般正常" },
      { id: "depleting", label: "偏瘦，食量較少，消化慢，手腳容易冰冷" },
      { id: "hoarding", label: "偏胖或容易水腫，腹部鬆軟，大便偏軟" },
      { id: "crossing", label: "體型一般，但消化時好時壞，與壓力情緒有關" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Scoring logic
// ---------------------------------------------------------------------------

function calcResult(answers: Record<string, AnswerKey>): {
  suggestedConstitution: ConstitutionKey;
  scores: Scores;
} {
  const scores: Scores = { depleting: 0, crossing: 0, hoarding: 0 };
  for (const answer of Object.values(answers)) {
    if (answer === "depleting") scores.depleting += 3;
    else if (answer === "crossing") scores.crossing += 3;
    else if (answer === "hoarding") scores.hoarding += 3;
  }

  const entries = Object.entries(scores) as [keyof Scores, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;

  // All neutral answers
  if (top[1] === 0) return { suggestedConstitution: "unknown", scores };

  // Two types are very close → mixed
  if (second[1] > 0 && top[1] - second[1] <= 2)
    return { suggestedConstitution: "mixed", scores };

  return { suggestedConstitution: top[0] as ConstitutionKey, scores };
}

// ---------------------------------------------------------------------------
// Constitution display metadata
// ---------------------------------------------------------------------------

const CONSTITUTION_META: Record<
  ConstitutionKey,
  { label: string; badgeClass: string; explanation: string; hint: string }
> = {
  depleting: {
    label: "虛損體質",
    badgeClass: "bg-emerald-100 text-emerald-800",
    explanation:
      "你的回應傾向於氣血不足、容易疲倦的虛損狀態。重點在於補氣養血、保持規律作息，避免過度消耗。",
    hint: "建議：三餐定時、多蒸煮少生冷、早睡早起是調養的基礎。",
  },
  crossing: {
    label: "鬱結體質",
    badgeClass: "bg-blue-100 text-blue-800",
    explanation:
      "你的回應傾向於氣機不暢、情緒與壓力容易積聚的鬱結狀態。重點在於疏肝解鬱、減少過度思慮。",
    hint: "建議：適當運動、保持社交、減少過度刺激性飲食。",
  },
  hoarding: {
    label: "痰濕體質",
    badgeClass: "bg-purple-100 text-purple-800",
    explanation:
      "你的回應傾向於濕濁積聚、身體沉重的痰濕狀態。重點在於健脾化濕、清淡飲食。",
    hint: "建議：減少甜食、奶製品及厚重飲食，每日保持輕量運動。",
  },
  mixed: {
    label: "混合體質",
    badgeClass: "bg-orange-100 text-orange-800",
    explanation:
      "你同時帶有多種體質特徵，屬於混合狀態。建議先與醫師詳細評估，找出主要調理方向。",
    hint: "建議：先穩定作息與三餐，再逐步微調。",
  },
  unknown: {
    label: "未能確定",
    badgeClass: "bg-gray-100 text-gray-700",
    explanation:
      "根據你的回答，未能清晰分辨體質偏向。這亦可能反映你目前狀態比較平衡，或需要更多資訊。",
    hint: "建議：先採用均衡清淡飲食，如有疑問可與醫師面診評估。",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "intro" | "questions" | "submitting" | "result" | "error";

export default function QuestionnairePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerKey>>({});
  const [result, setResult] = useState<ConstitutionKey | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---- handlers ----

  function handleOptionSelect(questionId: string, optionId: AnswerKey) {
    const updated = { ...answers, [questionId]: optionId };
    setAnswers(updated);

    if (currentQ < QUESTIONS.length - 1) {
      // Short delay so the selected state is visible before advancing
      setTimeout(() => setCurrentQ((q) => q + 1), 260);
    } else {
      // Last question – calculate and submit
      void submitAnswers(updated);
    }
  }

  async function submitAnswers(finalAnswers: Record<string, AnswerKey>) {
    setPhase("submitting");
    const { suggestedConstitution, scores } = calcResult(finalAnswers);

    try {
      const res = await fetch("/api/me/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, scores, suggestedConstitution }),
      });

      if (!res.ok && res.status !== 401) {
        // Non-auth errors: still show result locally even if save failed
        console.warn("[questionnaire] save failed:", res.status);
      }
    } catch (err) {
      console.warn("[questionnaire] network error saving result:", err);
    }

    setResult(suggestedConstitution);
    setPhase("result");
  }

  function restart() {
    setPhase("intro");
    setCurrentQ(0);
    setAnswers({});
    setResult(null);
    setErrorMsg(null);
  }

  // ---- render ----

  if (phase === "intro") {
    return (
      <main className="patient-pane text-slate-800">
        <div className="mx-auto max-w-lg space-y-6">
          <header className="space-y-3">
            <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
              體質自我評估
            </p>
            <h1 className="text-3xl font-semibold text-primary">了解你的體質</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              回答以下 {QUESTIONS.length} 條簡單問題，獲得初步的體質參考。
              結果僅供參考，正式評估請與醫師面診確認。
            </p>
          </header>

          <section className="patient-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">注意事項</h2>
            <ul className="space-y-2 text-sm text-slate-600 list-disc pl-4">
              <li>問卷設計以日常狀態為基礎，非急性症狀評估。</li>
              <li>每條問題請選最符合你近一至兩個月狀況的答案。</li>
              <li>結果會儲存至你的帳號供醫師參考（需要登入）。</li>
              <li>此問卷不能取代中醫師面診或臨床診斷。</li>
            </ul>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPhase("questions")}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
            >
              開始評估
            </button>
            <Link
              href="/care"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              返回養生宜忌
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "questions") {
    const question = QUESTIONS[currentQ];
    const progress = ((currentQ) / QUESTIONS.length) * 100;

    return (
      <main className="patient-pane text-slate-800">
        <div className="mx-auto max-w-lg space-y-5">
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>問題 {currentQ + 1} / {QUESTIONS.length}</span>
              <button
                type="button"
                onClick={restart}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                重新開始
              </button>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question card */}
          <section className="patient-card p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{question.text}</h2>
            <div className="space-y-2.5">
              {question.options.map((opt) => {
                const isSelected = answers[question.id] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleOptionSelect(question.id, opt.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isSelected
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-gray-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary-light/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (phase === "submitting") {
    return (
      <main className="patient-pane text-slate-800">
        <div className="mx-auto max-w-lg">
          <section className="patient-card px-6 py-12 text-center">
            <p className="text-sm text-slate-600">正在分析你的答案...</p>
          </section>
        </div>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="patient-pane text-slate-800">
        <div className="mx-auto max-w-lg">
          <section className="patient-card px-6 py-10 text-center space-y-4">
            <p className="text-sm text-red-600">{errorMsg || "出現錯誤，請稍後再試。"}</p>
            <button
              type="button"
              onClick={restart}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
            >
              重新嘗試
            </button>
          </section>
        </div>
      </main>
    );
  }

  // ---- Result ----
  const constitutionKey = result ?? "unknown";
  const meta = CONSTITUTION_META[constitutionKey];
  const dietTips = getConstitutionDietTips(constitutionKey);

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-lg space-y-5">
        <header className="space-y-2">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
            評估結果
          </p>
          <h1 className="text-2xl font-semibold text-primary">你的初步體質參考</h1>
        </header>

        {/* Constitution result card */}
        <section className="patient-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">建議體質類型</h2>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{meta.explanation}</p>
          <div className="rounded-2xl border border-primary/10 bg-primary-light/35 p-4">
            <p className="text-sm text-slate-700">{meta.hint}</p>
          </div>
          <p className="text-xs text-slate-500">
            ⚠️ 此結果為初步參考，以醫師面診評估為準。
          </p>
        </section>

        {/* Diet tips based on suggested constitution */}
        {constitutionKey !== "unknown" && (
          <section className="patient-card p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">飲食參考方針</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {dietTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Actions */}
        <section className="flex flex-wrap gap-3">
          <Link
            href="/care"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
          >
            查看養生宜忌
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
          >
            預約醫師確認
          </Link>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-gray-300 hover:bg-gray-50"
          >
            重新評估
          </button>
        </section>
      </div>
    </main>
  );
}
