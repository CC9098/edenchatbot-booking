export const TENDENCY_KEYS = ["J", "K", "L"] as const;

export type TendencyKey = (typeof TENDENCY_KEYS)[number];
export type TendencyScore = Record<TendencyKey, number>;
export type ScoreDelta = Partial<TendencyScore>;

export type BaseGroupOneOption = "A" | "B" | "C";
export type BaseGroupTwoOption = "X" | "Y" | "Z";
export type BaseGroupThreeOption = "J" | "K" | "L";

export type BaseQuizAnswers = {
  group1?: BaseGroupOneOption;
  group2?: BaseGroupTwoOption;
  group3?: BaseGroupThreeOption;
};

export type DailyCheckinOption = {
  id: string;
  text: string;
  delta: ScoreDelta;
};

export type DailyCheckinQuestion = {
  id: string;
  prompt: string;
  options: DailyCheckinOption[];
};

export const TENDENCY_LABELS: Record<TendencyKey, string> = {
  J: "乾耗訊號",
  K: "屯積訊號",
  L: "高壓訊號",
};

export const BASE_QUESTION_COPY = {
  group1: {
    prompt: "第一組：以下邊段最接近你平時態度與行為？",
    options: [
      {
        id: "A",
        text: "我想發揮影響力。我不喜歡無所事事，知道自己想要什麼並努力追求。",
      },
      {
        id: "B",
        text: "很多人說我是個愛做夢的人，我在想像世界中會感到興奮，容易滿足；在人群中有時我會選擇獨處。",
      },
      {
        id: "C",
        text: "我常先做好該做的事（甚至犧牲自己），有時間才休息或做想做的事。",
      },
    ] as const,
  },
  group2: {
    prompt: "第二組：以下邊段最接近你面對壓力時的反應？",
    options: [
      {
        id: "X",
        text: "我保持樂觀，唔開心時都會盡量唔俾人睇到，但有時會拖住自己要處理嘅問題。",
      },
      {
        id: "Y",
        text: "我情感比較強烈，唔舒服時通常睇得出；我想自己決定做法，不喜歡被指揮。",
      },
      {
        id: "Z",
        text: "我偏向冷靜同效率，遇到衝突會盡量保持理性，但有時會被形容太抽離。",
      },
    ] as const,
  },
  group3: {
    prompt: "第三組：以下邊句最接近你近期身體狀態？",
    options: [
      {
        id: "J",
        text: "我常覺得腦袋停不下來，精神容易繃緊；睡眠偏淺或容易早醒，忙一陣子就有被掏空感。",
      },
      {
        id: "K",
        text: "我常覺得身體重重的、提不起勁；飯後容易昏沉，整體像卡住，不太想動。",
      },
      {
        id: "L",
        text: "我常有一直在撐的感覺；肩頸、胸口或腹部容易緊、脹、頂住，壓力上來時易煩躁或睡不沉。",
      },
    ] as const,
  },
} as const;

const BASE_SCORE_MAP: Record<string, Record<string, ScoreDelta>> = {
  group1: {
    A: { L: 20 },
    B: { J: 20 },
    C: { K: 20 },
  },
  group2: {
    X: { K: 20 },
    Y: { L: 20 },
    Z: { J: 20 },
  },
  group3: {
    J: { J: 60 },
    K: { K: 60 },
    L: { L: 60 },
  },
};

export const DAILY_CHECKIN_QUESTIONS: DailyCheckinQuestion[] = [
  {
    id: "sleep",
    prompt: "你昨晚瞓覺最接近以下邊個狀態？",
    options: [
      { id: "sleep_j", text: "偏淺眠、易醒，瞓完都有耗損感。", delta: { J: 5 } },
      { id: "sleep_k", text: "瞓好多但仍然沉重、醒來未清。", delta: { K: 5 } },
      { id: "sleep_l", text: "帶住緊張或壓力入睡，夜晚易躁醒。", delta: { L: 5 } },
    ],
  },
  {
    id: "body_signal",
    prompt: "今日身體訊號最明顯係？",
    options: [
      { id: "body_j", text: "偏乾、偏緊，像一直耗緊。", delta: { J: 4 } },
      { id: "body_k", text: "偏重、偏滯，像卡住唔郁。", delta: { K: 4 } },
      { id: "body_l", text: "偏脹、偏頂，像有壓力未散。", delta: { L: 4 } },
    ],
  },
  {
    id: "after_meal",
    prompt: "食完飯後最常見嘅反應係？",
    options: [
      { id: "meal_j", text: "偏快耗，想靠提神先頂到。", delta: { J: 4, L: 1 } },
      { id: "meal_k", text: "偏困倦、偏脹，節奏慢落嚟。", delta: { K: 5 } },
      { id: "meal_l", text: "偏焗、偏躁，胸腹有頂住感。", delta: { L: 5 } },
    ],
  },
  {
    id: "stress",
    prompt: "工作或生活壓力高時，你最易出現邊種狀態？",
    options: [
      { id: "stress_j", text: "腦不停轉，心神耗得快。", delta: { J: 5 } },
      { id: "stress_k", text: "人會拖住，動力跌落去。", delta: { K: 5 } },
      { id: "stress_l", text: "人會繃住，火氣同張力上升。", delta: { L: 5 } },
    ],
  },
  {
    id: "stable",
    prompt: "如果以今日整體狀態計，邊句最貼近？",
    options: [
      { id: "stable_j", text: "仍然偏乾耗，需要慢落嚟。", delta: { J: 3 } },
      { id: "stable_k", text: "仍然偏沉滯，需要動起來。", delta: { K: 3 } },
      { id: "stable_l", text: "仍然偏高壓，需要鬆開張力。", delta: { L: 3 } },
    ],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function createEmptyScore(): TendencyScore {
  return { J: 0, K: 0, L: 0 };
}

export function getPersonalityCode(answers: BaseQuizAnswers): string | null {
  if (!answers.group1 || !answers.group2) return null;
  return `${answers.group1}${answers.group2}`;
}

export function isBaseQuizComplete(answers: BaseQuizAnswers): boolean {
  return Boolean(answers.group1 && answers.group2 && answers.group3);
}

export function applyDelta(score: TendencyScore, delta: ScoreDelta): TendencyScore {
  return {
    J: Math.max(0, score.J + (delta.J ?? 0)),
    K: Math.max(0, score.K + (delta.K ?? 0)),
    L: Math.max(0, score.L + (delta.L ?? 0)),
  };
}

export function computeBaseQuizScore(answers: BaseQuizAnswers): TendencyScore {
  let score = createEmptyScore();

  if (answers.group1) {
    score = applyDelta(score, BASE_SCORE_MAP.group1[answers.group1]);
  }
  if (answers.group2) {
    score = applyDelta(score, BASE_SCORE_MAP.group2[answers.group2]);
  }
  if (answers.group3) {
    score = applyDelta(score, BASE_SCORE_MAP.group3[answers.group3]);
  }

  return score;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map((v) => Number.parseInt(v, 10));
  if (!year || !month || !day) return 0;
  return Math.floor(new Date(year, month - 1, day).getTime() / DAY_MS);
}

export function getDaySpan(fromDateKey: string | null | undefined, toDateKey: string): number {
  if (!fromDateKey) return 0;
  return Math.max(0, dateKeyToDayNumber(toDateKey) - dateKeyToDayNumber(fromDateKey));
}

export function applyDailyDecay(score: TendencyScore, days: number, dailyRate = 0.95): TendencyScore {
  if (days <= 0) return score;
  const factor = dailyRate ** days;
  return {
    J: Number((score.J * factor).toFixed(4)),
    K: Number((score.K * factor).toFixed(4)),
    L: Number((score.L * factor).toFixed(4)),
  };
}

export function blendTendencyScores(
  baseScore: TendencyScore,
  liveScore: TendencyScore,
  baseWeight = 0.7,
  liveWeight = 0.3,
): TendencyScore {
  return {
    J: baseScore.J * baseWeight + liveScore.J * liveWeight,
    K: baseScore.K * baseWeight + liveScore.K * liveWeight,
    L: baseScore.L * baseWeight + liveScore.L * liveWeight,
  };
}

export function normalizeToPercentages(score: TendencyScore): TendencyScore {
  const total = score.J + score.K + score.L;
  if (total <= 0) return { J: 34, K: 33, L: 33 };

  const raw = {
    J: (score.J / total) * 100,
    K: (score.K / total) * 100,
    L: (score.L / total) * 100,
  };

  const floorValues = {
    J: Math.floor(raw.J),
    K: Math.floor(raw.K),
    L: Math.floor(raw.L),
  };

  const remainderCount = 100 - (floorValues.J + floorValues.K + floorValues.L);
  const remainders = TENDENCY_KEYS
    .map((key) => ({ key, remainder: raw[key] - floorValues[key] }))
    .sort((a, b) => b.remainder - a.remainder);

  const result = { ...floorValues };
  for (let i = 0; i < remainderCount; i += 1) {
    const key = remainders[i % remainders.length]?.key;
    if (!key) break;
    result[key] += 1;
  }

  return result;
}

export function rankTendency(score: TendencyScore): TendencyKey[] {
  return [...TENDENCY_KEYS].sort((a, b) => score[b] - score[a]);
}

export function getDailyCheckinQuestion(dateKey = getLocalDateKey()): DailyCheckinQuestion {
  const dayNumber = dateKeyToDayNumber(dateKey);
  const index = Math.abs(dayNumber) % DAILY_CHECKIN_QUESTIONS.length;
  return DAILY_CHECKIN_QUESTIONS[index];
}

