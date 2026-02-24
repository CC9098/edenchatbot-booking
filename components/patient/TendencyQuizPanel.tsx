"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BASE_QUESTION_COPY,
  applyDailyDecay,
  applyDelta,
  blendTendencyScores,
  computeBaseQuizScore,
  createEmptyScore,
  getDailyCheckinQuestion,
  getDaySpan,
  getLocalDateKey,
  getPersonalityCode,
  isBaseQuizComplete,
  normalizeToPercentages,
  rankTendency,
  type BaseQuizAnswers,
  type TendencyKey,
  type TendencyScore,
} from "@/lib/constitution-tendency";

type TendencyQuizPanelProps = {
  userId?: string;
};

type TendencyStorageState = {
  version: 1;
  baseAnswers: BaseQuizAnswers;
  baseScore: TendencyScore;
  liveScore: TendencyScore;
  personalityCode: string | null;
  answeredDaily: Record<string, { questionId: string; optionId: string; at: string }>;
  lastDecayDate: string | null;
  updatedAt: string;
};

const TENDENCY_STORAGE_VERSION = 1;

const TENDENCY_BAR_META: Record<TendencyKey, { label: string; barClass: string; textClass: string }> = {
  J: {
    label: "J（乾耗訊號）",
    barClass: "bg-amber-500",
    textClass: "text-amber-700",
  },
  K: {
    label: "K（屯積訊號）",
    barClass: "bg-indigo-500",
    textClass: "text-indigo-700",
  },
  L: {
    label: "L（高壓訊號）",
    barClass: "bg-rose-500",
    textClass: "text-rose-700",
  },
};

function createInitialTendencyState(): TendencyStorageState {
  return {
    version: TENDENCY_STORAGE_VERSION,
    baseAnswers: {},
    baseScore: createEmptyScore(),
    liveScore: createEmptyScore(),
    personalityCode: null,
    answeredDaily: {},
    lastDecayDate: null,
    updatedAt: new Date().toISOString(),
  };
}

function parseStoredTendencyState(raw: string | null): TendencyStorageState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TendencyStorageState>;
    if (parsed.version !== TENDENCY_STORAGE_VERSION) return null;
    if (!parsed.baseScore || !parsed.liveScore || !parsed.answeredDaily) return null;
    return {
      version: TENDENCY_STORAGE_VERSION,
      baseAnswers: parsed.baseAnswers || {},
      baseScore: {
        J: Number(parsed.baseScore.J || 0),
        K: Number(parsed.baseScore.K || 0),
        L: Number(parsed.baseScore.L || 0),
      },
      liveScore: {
        J: Number(parsed.liveScore.J || 0),
        K: Number(parsed.liveScore.K || 0),
        L: Number(parsed.liveScore.L || 0),
      },
      personalityCode: typeof parsed.personalityCode === "string" ? parsed.personalityCode : null,
      answeredDaily:
        typeof parsed.answeredDaily === "object" && parsed.answeredDaily !== null ? parsed.answeredDaily : {},
      lastDecayDate: typeof parsed.lastDecayDate === "string" ? parsed.lastDecayDate : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function TendencyQuizPanel({ userId }: TendencyQuizPanelProps) {
  const [tendencyState, setTendencyState] = useState<TendencyStorageState | null>(null);
  const [tendencyReady, setTendencyReady] = useState(false);
  const [tendencyError, setTendencyError] = useState<string | null>(null);
  const [baseAnswersDraft, setBaseAnswersDraft] = useState<BaseQuizAnswers>({});
  const [dailyOptionDraft, setDailyOptionDraft] = useState<string>("");

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const todayQuestion = useMemo(() => getDailyCheckinQuestion(todayKey), [todayKey]);
  const tendencyStorageKey = useMemo(() => `eden:tendency:v1:${userId || "guest"}`, [userId]);

  const persistTendencyState = useCallback(
    (nextState: TendencyStorageState) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(tendencyStorageKey, JSON.stringify(nextState));
      }
      setTendencyState(nextState);
    },
    [tendencyStorageKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRaw = window.localStorage.getItem(tendencyStorageKey);
    const stored = parseStoredTendencyState(storedRaw);
    const baseState = stored || createInitialTendencyState();
    const span = getDaySpan(baseState.lastDecayDate, todayKey);
    const liveScore = applyDailyDecay(baseState.liveScore, span);

    const nextState: TendencyStorageState = {
      ...baseState,
      liveScore,
      lastDecayDate: todayKey,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(tendencyStorageKey, JSON.stringify(nextState));
    setTendencyState(nextState);
    setBaseAnswersDraft(nextState.baseAnswers);
    setTendencyReady(true);
    setTendencyError(null);
  }, [tendencyStorageKey, todayKey]);

  useEffect(() => {
    setDailyOptionDraft("");
  }, [todayQuestion.id, tendencyState?.answeredDaily?.[todayKey]?.optionId, todayKey]);

  const baseQuizCompleted = useMemo(
    () => isBaseQuizComplete(tendencyState?.baseAnswers || {}),
    [tendencyState?.baseAnswers],
  );

  const blendedScore = useMemo(
    () =>
      blendTendencyScores(
        tendencyState?.baseScore || createEmptyScore(),
        tendencyState?.liveScore || createEmptyScore(),
      ),
    [tendencyState?.baseScore, tendencyState?.liveScore],
  );

  const tendencyPercentages = useMemo(() => normalizeToPercentages(blendedScore), [blendedScore]);
  const rankedTendencies = useMemo(() => rankTendency(tendencyPercentages), [tendencyPercentages]);

  const primaryTendency = rankedTendencies[0];
  const secondaryTendency = rankedTendencies[1];
  const isMixedTendency =
    primaryTendency && secondaryTendency
      ? tendencyPercentages[primaryTendency] - tendencyPercentages[secondaryTendency] < 20
      : false;

  const todayAnswerRecord = tendencyState?.answeredDaily?.[todayKey];
  const todayAnswerText =
    todayQuestion.options.find((option) => option.id === todayAnswerRecord?.optionId)?.text || null;

  const handleSaveBaseQuiz = useCallback(() => {
    setTendencyError(null);
    if (!tendencyState) return;
    if (!isBaseQuizComplete(baseAnswersDraft)) {
      setTendencyError("請先完成三組問題，先可以建立初型。");
      return;
    }

    const now = new Date().toISOString();
    const nextState: TendencyStorageState = {
      ...tendencyState,
      baseAnswers: baseAnswersDraft,
      baseScore: computeBaseQuizScore(baseAnswersDraft),
      personalityCode: getPersonalityCode(baseAnswersDraft),
      lastDecayDate: todayKey,
      updatedAt: now,
    };
    persistTendencyState(nextState);
  }, [baseAnswersDraft, persistTendencyState, tendencyState, todayKey]);

  const handleSubmitDailyCheckin = useCallback(() => {
    setTendencyError(null);
    if (!tendencyState) return;
    if (!isBaseQuizComplete(tendencyState.baseAnswers)) {
      setTendencyError("請先完成初型問卷，再做每日更新。");
      return;
    }
    if (todayAnswerRecord) return;
    if (!dailyOptionDraft) {
      setTendencyError("請先揀選今日狀態。");
      return;
    }

    const selectedOption = todayQuestion.options.find((option) => option.id === dailyOptionDraft);
    if (!selectedOption) {
      setTendencyError("今日題目資料有誤，請重新載入。");
      return;
    }

    const span = getDaySpan(tendencyState.lastDecayDate, todayKey);
    const decayedLiveScore = applyDailyDecay(tendencyState.liveScore, span);
    const nextLiveScore = applyDelta(decayedLiveScore, selectedOption.delta);
    const now = new Date().toISOString();

    const answeredDaily = {
      ...tendencyState.answeredDaily,
      [todayKey]: {
        questionId: todayQuestion.id,
        optionId: selectedOption.id,
        at: now,
      },
    };

    const nextState: TendencyStorageState = {
      ...tendencyState,
      liveScore: nextLiveScore,
      answeredDaily,
      lastDecayDate: todayKey,
      updatedAt: now,
    };
    persistTendencyState(nextState);
    setDailyOptionDraft("");
  }, [dailyOptionDraft, persistTendencyState, tendencyState, todayAnswerRecord, todayKey, todayQuestion]);

  if (!tendencyReady) {
    return <p className="text-sm text-slate-500">初始化中...</p>;
  }

  return (
    <div className="space-y-3">
      {!baseQuizCompleted ? (
        <div className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">{BASE_QUESTION_COPY.group1.prompt}</p>
            <div className="mt-3 space-y-2">
              {BASE_QUESTION_COPY.group1.options.map((option) => {
                const selected = baseAnswersDraft.group1 === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBaseAnswersDraft((prev) => ({ ...prev, group1: option.id }))}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-primary/50 bg-primary-light/40 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
                    }`}
                  >
                    <span className="mr-2 text-xs font-semibold text-slate-500">{option.id}</span>
                    {option.text}
                  </button>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">{BASE_QUESTION_COPY.group2.prompt}</p>
            <div className="mt-3 space-y-2">
              {BASE_QUESTION_COPY.group2.options.map((option) => {
                const selected = baseAnswersDraft.group2 === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBaseAnswersDraft((prev) => ({ ...prev, group2: option.id }))}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-primary/50 bg-primary-light/40 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-primary/30"
                    }`}
                  >
                    <span className="mr-2 text-xs font-semibold text-slate-500">{option.id}</span>
                    {option.text}
                  </button>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">{BASE_QUESTION_COPY.group3.prompt}</p>
            <div className="mt-3 space-y-2">
              {BASE_QUESTION_COPY.group3.options.map((option) => {
                const selected = baseAnswersDraft.group3 === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBaseAnswersDraft((prev) => ({ ...prev, group3: option.id }))}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
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
          </article>

          <button
            type="button"
            onClick={handleSaveBaseQuiz}
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
          >
            建立初型分佈
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(TENDENCY_BAR_META) as TendencyKey[]).map((key) => (
            <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className={`text-sm font-semibold ${TENDENCY_BAR_META[key].textClass}`}>
                  {TENDENCY_BAR_META[key].label}
                </p>
                <p className="text-sm font-semibold text-slate-700">{tendencyPercentages[key]}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-2 rounded-full ${TENDENCY_BAR_META[key].barClass}`}
                  style={{ width: `${tendencyPercentages[key]}%` }}
                />
              </div>
            </div>
          ))}
          {primaryTendency && secondaryTendency ? (
            <p className="text-xs text-slate-600">
              目前主傾向：{TENDENCY_BAR_META[primaryTendency].label}
              {isMixedTendency ? "（接近混合）" : ""}
              ，次傾向：{TENDENCY_BAR_META[secondaryTendency].label}
            </p>
          ) : null}
        </div>
      )}

      {baseQuizCompleted ? (
        <div className="rounded-2xl border border-primary/15 bg-primary-light/30 p-4">
          <p className="text-sm font-semibold text-slate-900">每日微調（每日 1 題）</p>
          <p className="mt-1 text-sm text-slate-700">{todayQuestion.prompt}</p>
          {todayAnswerRecord ? (
            <p className="mt-3 text-sm text-emerald-700">今日已更新：{todayAnswerText || "已完成今日作答"}</p>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {todayQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDailyOptionDraft(option.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                      dailyOptionDraft === option.id
                        ? "border-primary/50 bg-white text-slate-900"
                        : "border-slate-200 bg-white/80 text-slate-700 hover:border-primary/30"
                    }`}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSubmitDailyCheckin}
                className="mt-3 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
              >
                更新今日分數
              </button>
            </>
          )}
        </div>
      ) : null}

      {tendencyError ? <p className="text-sm text-red-600">{tendencyError}</p> : null}
    </div>
  );
}

