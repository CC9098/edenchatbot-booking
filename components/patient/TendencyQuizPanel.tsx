"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Droplet, Wind, Zap } from "lucide-react";
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
  type ScoreDelta,
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

const FORCE_META: Record<
  TendencyKey,
  {
    name: string;
    fillClass: string;
    textClass: string;
    iconClass: string;
    hint: string;
  }
> = {
  J: {
    name: "風勢",
    fillClass: "bg-[#4e8a96]",
    textClass: "text-[#2f6873]",
    iconClass: "text-[#3a7782]",
    hint: "流動、調頻、回氣",
  },
  K: {
    name: "水勢",
    fillClass: "bg-[#4a5278]",
    textClass: "text-[#343c62]",
    iconClass: "text-[#3b4368]",
    hint: "沉穩、聚養、修復",
  },
  L: {
    name: "雷勢",
    fillClass: "bg-[#b89a2c]",
    textClass: "text-[#876d15]",
    iconClass: "text-[#9a7d1c]",
    hint: "決斷、突破、行動",
  },
};

type BattleReportItem = {
  key: TendencyKey;
  direction: "增幅" | "消耗";
  count: number;
};

type ForceIconProps = {
  force: TendencyKey;
  className?: string;
};

function ForceIcon({ force, className = "h-4 w-4 text-primary" }: ForceIconProps) {
  if (force === "J") {
    return <Wind className={className} strokeWidth={1.9} aria-hidden="true" />;
  }

  if (force === "K") {
    return <Droplet className={className} strokeWidth={1.9} aria-hidden="true" />;
  }

  return <Zap className={className} strokeWidth={1.9} aria-hidden="true" />;
}

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

function buildDeltaBattleReport(delta: ScoreDelta): BattleReportItem[] {
  const items: BattleReportItem[] = [];
  (Object.keys(FORCE_META) as TendencyKey[]).forEach((key) => {
    const value = Number(delta[key] || 0);
    if (!value) return;
    items.push({
      key,
      direction: value > 0 ? "增幅" : "消耗",
      count: Math.max(1, Math.min(5, Math.abs(value))),
    });
  });
  return items;
}

function forceStateLabel(percent: number): string {
  if (percent >= 45) return "主勢啟動";
  if (percent >= 33) return "穩定上升";
  if (percent >= 24) return "平衡中";
  return "待補充";
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
  const todayAnswerOptionId = tendencyState?.answeredDaily?.[todayKey]?.optionId;

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
  }, [todayQuestion.id, todayAnswerOptionId, todayKey]);

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
  const todayAnswerOption = todayQuestion.options.find((option) => option.id === todayAnswerRecord?.optionId) || null;
  const todayBattleReport = useMemo(
    () => buildDeltaBattleReport(todayAnswerOption?.delta || {}),
    [todayAnswerOption],
  );

  const handleSaveBaseQuiz = useCallback(() => {
    setTendencyError(null);
    if (!tendencyState) return;
    if (!isBaseQuizComplete(baseAnswersDraft)) {
      setTendencyError("請完成三段選擇，先建立 SOUL 原力盤。");
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
      setTendencyError("請先完成原力初型，再做每日事件卡。");
      return;
    }
    if (todayAnswerRecord) return;
    if (!dailyOptionDraft) {
      setTendencyError("請先揀選你今日的抉擇。");
      return;
    }

    const selectedOption = todayQuestion.options.find((option) => option.id === dailyOptionDraft);
    if (!selectedOption) {
      setTendencyError("今日事件卡資料有誤，請重新載入。");
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
    return <p className="text-sm text-slate-500">初始化 SOUL 原力盤...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-primary-light/35 p-4">
        <p className="text-xs font-semibold tracking-wide text-primary">SOUL JOURNEY</p>
        <p className="mt-1 text-sm text-slate-700">
          你會喺日常抉擇中調整風、水、雷三勢，逐步搵返自己最穩定的原初力量。
        </p>
      </div>

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
            啟動原力盤
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500">原力版圖</p>
            <div className="mt-2 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200">
              <div className="flex h-3 w-full">
                {(Object.keys(FORCE_META) as TendencyKey[]).map((key, index, allKeys) => (
                  <div
                    key={key}
                    className={`h-3 transition-[width] duration-500 ${FORCE_META[key].fillClass} ${
                      index < allKeys.length - 1 ? "border-r border-white/60" : ""
                    }`}
                    style={{ width: `${tendencyPercentages[key]}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(Object.keys(FORCE_META) as TendencyKey[]).map((key) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2">
                  <p className={`inline-flex items-center gap-2 text-sm font-semibold ${FORCE_META[key].textClass}`}>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white ring-1 ring-black/5">
                      <ForceIcon force={key} className={`h-3.5 w-3.5 ${FORCE_META[key].iconClass}`} />
                    </span>
                    <span>{FORCE_META[key].name}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {Math.round(tendencyPercentages[key])}% ・ {forceStateLabel(tendencyPercentages[key])}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{FORCE_META[key].hint}</p>
                </div>
              ))}
            </div>
          </div>

          {primaryTendency && secondaryTendency ? (
            <p className="text-xs text-slate-600">
              目前主勢：
              <span className={`mx-1 inline-flex items-center gap-1 ${FORCE_META[primaryTendency].textClass}`}>
                <ForceIcon force={primaryTendency} className={`h-3.5 w-3.5 ${FORCE_META[primaryTendency].iconClass}`} />
                {FORCE_META[primaryTendency].name}
              </span>
              {isMixedTendency ? "（接近共鳴）" : ""}
              ，副勢：
              <span className={`mx-1 inline-flex items-center gap-1 ${FORCE_META[secondaryTendency].textClass}`}>
                <ForceIcon
                  force={secondaryTendency}
                  className={`h-3.5 w-3.5 ${FORCE_META[secondaryTendency].iconClass}`}
                />
                {FORCE_META[secondaryTendency].name}
              </span>
            </p>
          ) : null}
        </div>
      )}

      {baseQuizCompleted ? (
        <div className="rounded-2xl border border-primary/15 bg-primary-light/30 p-4">
          <p className="text-sm font-semibold text-slate-900">今日事件卡</p>
          <p className="mt-1 text-sm text-slate-700">{todayQuestion.prompt}</p>
          {todayAnswerRecord ? (
            <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-white/80 p-3">
              <p className="text-sm text-slate-800">今日戰報：{todayAnswerOption?.text || "已完成今日抉擇"}</p>
              {todayBattleReport.length > 0 ? (
                <ul className="space-y-1">
                  {todayBattleReport.map((item) => (
                    <li key={`${item.key}-${item.direction}`} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="min-w-[78px] font-medium text-slate-600">
                        {FORCE_META[item.key].name}
                        {item.direction}
                      </span>
                      <span className="flex items-center gap-1">
                        {Array.from({ length: item.count }).map((_, index) => (
                          <ForceIcon
                            key={`${item.key}-${item.direction}-${index}`}
                            force={item.key}
                            className={`h-3.5 w-3.5 ${FORCE_META[item.key].iconClass}`}
                          />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
                提交今日抉擇
              </button>
            </>
          )}
        </div>
      ) : null}

      {tendencyError ? <p className="text-sm text-red-600">{tendencyError}</p> : null}
    </div>
  );
}
