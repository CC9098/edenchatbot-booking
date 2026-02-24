"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getConstitutionDietTips } from "@/lib/constitution-diet-tips";
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

type CareInstruction = {
  id: string;
  instructionType: string;
  title: string;
  contentMd: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

type NextFollowUp = {
  id: string;
  suggestedDate: string;
  status: string;
};

type CareContextResponse = {
  userId?: string;
  constitution: string;
  constitutionSource?: "patient_care_profile" | "profiles" | "chat_sessions" | "default";
  constitutionNote: string | null;
  activeInstructions: CareInstruction[];
  nextFollowUp: NextFollowUp | null;
  error?: string;
};

type ConstitutionMeta = {
  label: string;
  badgeClass: string;
  summary: string;
};

const CONSTITUTION_META: Record<string, ConstitutionMeta> = {
  depleting: {
    label: "虛損",
    badgeClass: "bg-emerald-100 text-emerald-800",
    summary: "重點是補氣養血、減少過度勞累，飲食以溫和、易消化為主。",
  },
  crossing: {
    label: "鬱結",
    badgeClass: "bg-blue-100 text-blue-800",
    summary: "重點是疏導壓力、調節作息，飲食避免過度刺激與偏性太強。",
  },
  hoarding: {
    label: "痰濕",
    badgeClass: "bg-purple-100 text-purple-800",
    summary: "重點是化濕健脾，飲食以清淡為主，減少濕重與黏滯食物。",
  },
  mixed: {
    label: "混合",
    badgeClass: "bg-orange-100 text-orange-800",
    summary: "目前屬混合狀態，先跟隨醫師指示，逐步微調飲食與作息。",
  },
  unknown: {
    label: "未評估",
    badgeClass: "bg-gray-100 text-gray-700",
    summary: "尚未建立完整體質評估，先採用清淡、規律、少刺激的基本原則。",
  },
};

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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatInstructionDateRange(item: CareInstruction): string {
  if (item.startDate && item.endDate) {
    return `${formatDate(item.startDate)} 至 ${formatDate(item.endDate)}`;
  }
  if (item.startDate) return `開始：${formatDate(item.startDate)}`;
  if (item.endDate) return `截止：${formatDate(item.endDate)}`;
  return `建立：${formatDate(item.createdAt)}`;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function instructionMetaText(item: CareInstruction): string {
  const doctorName = item.createdByName || "醫師";
  const updatedAt = formatDateTime(item.updatedAt || item.createdAt);
  return `${formatInstructionDateRange(item)} ・ 醫師：${doctorName} ・ 更新：${updatedAt}`;
}

function constitutionSourceLabel(source: CareContextResponse["constitutionSource"]): string {
  if (source === "patient_care_profile") return "來源：醫師評估";
  if (source === "profiles") return "來源：帳號體質檔案";
  if (source === "chat_sessions") return "來源：登入帳號對話紀錄";
  return "來源：未有完整資料";
}

export default function CareAdvicePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CareContextResponse | null>(null);
  const [tendencyState, setTendencyState] = useState<TendencyStorageState | null>(null);
  const [tendencyReady, setTendencyReady] = useState(false);
  const [tendencyError, setTendencyError] = useState<string | null>(null);
  const [baseAnswersDraft, setBaseAnswersDraft] = useState<BaseQuizAnswers>({});
  const [dailyOptionDraft, setDailyOptionDraft] = useState<string>("");

  const loadCareContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/me/care-context");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("請先登入，先可以查看你的養生宜忌建議。");
        }
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "載入養生宜忌建議失敗");
      }
      const payload = (await res.json()) as CareContextResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入養生宜忌建議失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCareContext();
  }, [loadCareContext]);

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const todayQuestion = useMemo(() => getDailyCheckinQuestion(todayKey), [todayKey]);
  const tendencyStorageKey = useMemo(
    () => `eden:tendency:v1:${data?.userId || "guest"}`,
    [data?.userId],
  );

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
    if (!data) return;
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
  }, [data, tendencyStorageKey, todayKey]);

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

  const constitutionKey = data?.constitution ?? "unknown";
  const constitutionMeta = CONSTITUTION_META[constitutionKey] || CONSTITUTION_META.unknown;
  const fallbackDietTips = useMemo(
    () => getConstitutionDietTips(constitutionKey),
    [constitutionKey],
  );

  const dietRecommendItems = useMemo(
    () => (data?.activeInstructions || []).filter((item) => item.instructionType === "diet_recommend"),
    [data?.activeInstructions],
  );

  const dietAvoidItems = useMemo(
    () => (data?.activeInstructions || []).filter((item) => item.instructionType === "diet_avoid"),
    [data?.activeInstructions],
  );

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="space-y-3">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">個人化照護</p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">養生宜忌建議</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            這裡整合你的體質、飲食方向與醫師戒口提醒，方便你每日跟住做。
          </p>
        </header>

        {loading ? (
          <section className="patient-card px-6 py-10 text-center">
            <p className="text-sm text-slate-600">載入中...</p>
          </section>
        ) : error ? (
          <section className="patient-card px-6 py-10 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void loadCareContext()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3d6b20]"
              >
                重新載入
              </button>
              <Link
                href="/login"
                className="rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                前往登入
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="patient-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">我的體質</h2>
                  <p className="mt-1 text-sm text-slate-600">{constitutionMeta.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">{constitutionSourceLabel(data?.constitutionSource)}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${constitutionMeta.badgeClass}`}
                >
                  {constitutionMeta.label}
                </span>
              </div>

              {data?.constitutionNote ? (
                <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-light/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">醫師體質備註</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{data.constitutionNote}</p>
                </div>
              ) : null}

              {data?.nextFollowUp ? (
                <p className="mt-4 text-xs text-slate-500">下次建議覆診：{formatDate(data.nextFollowUp.suggestedDate)}</p>
              ) : null}
            </section>

            <section className="patient-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">自我狀態傾向（Beta）</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    初型用 3 題建立基線，之後每日 1 題微調。結果為生活傾向分析，並非醫療診斷。
                  </p>
                </div>
                {tendencyState?.personalityCode ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    人格碼：{tendencyState.personalityCode}
                  </span>
                ) : null}
              </div>

              {!tendencyReady ? (
                <p className="mt-4 text-sm text-slate-500">初始化中...</p>
              ) : (
                <>
                  {!baseQuizCompleted ? (
                    <div className="mt-4 space-y-5">
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
                    <div className="mt-4 space-y-3">
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
                    <div className="mt-5 rounded-2xl border border-primary/15 bg-primary-light/30 p-4">
                      <p className="text-sm font-semibold text-slate-900">每日微調（每日 1 題）</p>
                      <p className="mt-1 text-sm text-slate-700">{todayQuestion.prompt}</p>
                      {todayAnswerRecord ? (
                        <p className="mt-3 text-sm text-emerald-700">
                          今日已更新：{todayAnswerText || "已完成今日作答"}
                        </p>
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

                  {tendencyError ? <p className="mt-3 text-sm text-red-600">{tendencyError}</p> : null}
                </>
              )}
            </section>

            <section className="patient-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">養生飲食方針</h2>
              {dietRecommendItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dietRecommendItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">{item.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.contentMd}</p>
                      <p className="mt-3 text-xs text-slate-500">{instructionMetaText(item)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-primary/10 bg-primary-light/35 p-4">
                  <p className="text-sm font-medium text-slate-900">以下是你的體質方針建議：</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                    {fallbackDietTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="patient-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">醫師點評的戒口指引</h2>
              {dietAvoidItems.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {dietAvoidItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-red-200 bg-red-50/55 p-4">
                      <p className="text-sm font-semibold text-red-900">{item.title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.contentMd}</p>
                      <p className="mt-3 text-xs text-slate-500">{instructionMetaText(item)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
                  <p className="text-sm text-slate-600">暫時未有醫師新增戒口指引。</p>
                </div>
              )}
            </section>

            <section className="flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                去 AI 諮詢
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
              >
                查看電子課程
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
