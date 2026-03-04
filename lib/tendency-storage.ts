import {
  applyDailyDecay,
  blendTendencyScores,
  createEmptyScore,
  getDaySpan,
  getLocalDateKey,
  isBaseQuizComplete,
  normalizeToPercentages,
  rankTendency,
  type BaseQuizAnswers,
  type TendencyKey,
  type TendencyScore,
} from "./constitution-tendency";

export type TendencyStorageState = {
  version: 1;
  baseAnswers: BaseQuizAnswers;
  baseScore: TendencyScore;
  liveScore: TendencyScore;
  personalityCode: string | null;
  answeredDaily: Record<string, { questionId: string; optionId: string; at: string }>;
  lastDecayDate: string | null;
  updatedAt: string;
};

export type ResolvedQuizConstitution = {
  constitution: "depleting" | "crossing" | "hoarding" | "mixed";
  source: "tendency_quiz";
  percentages: TendencyScore;
  primaryTendency: TendencyKey;
};

const TENDENCY_STORAGE_VERSION = 1;

const TENDENCY_TO_CONSTITUTION: Record<TendencyKey, "depleting" | "crossing" | "hoarding"> = {
  J: "depleting",
  K: "hoarding",
  L: "crossing",
};

export function getTendencyStorageKey(userId?: string): string {
  return `eden:tendency:v1:${userId || "guest"}`;
}

export function createInitialTendencyState(): TendencyStorageState {
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

export function parseStoredTendencyState(raw: string | null): TendencyStorageState | null {
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

export function hydrateTendencyState(
  state: TendencyStorageState | null,
  todayKey = getLocalDateKey(),
): TendencyStorageState {
  const baseState = state || createInitialTendencyState();
  const span = getDaySpan(baseState.lastDecayDate, todayKey);

  return {
    ...baseState,
    liveScore: applyDailyDecay(baseState.liveScore, span),
    lastDecayDate: todayKey,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveStoredQuizConstitution(
  state: TendencyStorageState | null,
  todayKey = getLocalDateKey(),
): ResolvedQuizConstitution | null {
  if (!state || !isBaseQuizComplete(state.baseAnswers)) return null;

  const hydratedState = hydrateTendencyState(state, todayKey);
  const blendedScore = blendTendencyScores(hydratedState.baseScore, hydratedState.liveScore);
  const percentages = normalizeToPercentages(blendedScore);
  const ranked = rankTendency(percentages);
  const primary = ranked[0];
  const secondary = ranked[1];

  if (!primary) return null;

  const isMixed = secondary ? percentages[primary] - percentages[secondary] < 20 : false;
  return {
    constitution: isMixed ? "mixed" : TENDENCY_TO_CONSTITUTION[primary],
    source: "tendency_quiz",
    percentages,
    primaryTendency: primary,
  };
}
