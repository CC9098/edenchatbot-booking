"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type BaseQuizAnswers,
  type TendencyScore,
  DAILY_CHECKIN_QUESTIONS,
  applyDailyDecay,
  applyDelta,
  getDailyCheckinQuestion,
  getDaySpan,
  getLocalDateKey,
  isBaseQuizComplete,
} from "@/lib/constitution-tendency";
import { NARRATIVE } from "@/lib/narrative-copy";

type StoredAnsweredDaily = Record<string, { questionId: string; optionId: string; at: string }>;

type TendencyStorageState = {
  version: 1;
  baseAnswers: BaseQuizAnswers;
  baseScore: TendencyScore;
  liveScore: TendencyScore;
  personalityCode: string | null;
  answeredDaily: StoredAnsweredDaily;
  lastDecayDate: string | null;
  updatedAt: string;
};

type DailySensePromptProps = {
  userId?: string;
};

/**
 * A gentle, non-intrusive daily check-in prompt that appears on the care page.
 *
 * - If the user hasn't completed the base quiz → hidden (no nagging).
 * - If today's check-in is already done → hidden (just disappears).
 * - Otherwise shows a quiet invitation: "今天，你的身體想說什麼？"
 * - Tap to expand the daily question inline; answer then fade out.
 */
export function DailySensePrompt({ userId }: DailySensePromptProps) {
  const [state, setState] = useState<"loading" | "hidden" | "prompt" | "expanded" | "done">("loading");
  const [selectedOptionId, setSelectedOptionId] = useState("");

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const todayQuestion = useMemo(() => getDailyCheckinQuestion(todayKey), [todayKey]);
  const storageKey = useMemo(() => `eden:tendency:v1:${userId || "guest"}`, [userId]);

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setState("hidden");
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setState("hidden");
        return;
      }
      const parsed = JSON.parse(raw) as Partial<TendencyStorageState>;
      if (parsed.version !== 1) {
        setState("hidden");
        return;
      }

      // Must have completed base quiz
      if (!isBaseQuizComplete(parsed.baseAnswers || {})) {
        setState("hidden");
        return;
      }

      // Already answered today?
      if (parsed.answeredDaily?.[todayKey]) {
        setState("hidden");
        return;
      }

      setState("prompt");
    } catch {
      setState("hidden");
    }
  }, [storageKey, todayKey]);

  const handleExpand = useCallback(() => {
    setState("expanded");
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedOptionId) return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as TendencyStorageState;

      const selectedOption = todayQuestion.options.find((o) => o.id === selectedOptionId);
      if (!selectedOption) return;

      const span = getDaySpan(stored.lastDecayDate, todayKey);
      const decayedLive = applyDailyDecay(stored.liveScore, span);
      const nextLive = applyDelta(decayedLive, selectedOption.delta);
      const now = new Date().toISOString();

      const nextState: TendencyStorageState = {
        ...stored,
        liveScore: nextLive,
        answeredDaily: {
          ...stored.answeredDaily,
          [todayKey]: { questionId: todayQuestion.id, optionId: selectedOption.id, at: now },
        },
        lastDecayDate: todayKey,
        updatedAt: now,
      };

      window.localStorage.setItem(storageKey, JSON.stringify(nextState));
      setState("done");
    } catch {
      // Silently fail — this is a gentle feature, not critical.
    }
  }, [selectedOptionId, storageKey, todayKey, todayQuestion]);

  // Hidden states → render nothing
  if (state === "loading" || state === "hidden" || state === "done") return null;

  return (
    <div className="rounded-2xl border border-primary/10 bg-white/80 p-5">
      {state === "prompt" ? (
        <div className="text-center">
          <p className="text-sm text-slate-600">{NARRATIVE.dailySensePrompt}</p>
          <button
            type="button"
            onClick={handleExpand}
            className="mt-4 inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
          >
            {NARRATIVE.dailySenseButton}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">{todayQuestion.prompt}</p>
          <div className="space-y-2">
            {todayQuestion.options.map((option) => {
              const selected = selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className={`w-full rounded-2xl border px-3 py-2.5 text-left text-sm transition ${
                    selected
                      ? "border-primary/50 bg-primary-light/40 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
                  }`}
                >
                  {option.text}
                </button>
              );
            })}
          </div>
          {selectedOptionId ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3d6b20]"
            >
              好，記住了
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
