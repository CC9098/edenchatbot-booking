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
    prompt: "你平時最常見嘅身體感受係咩？",
    options: [
      {
        id: "A",
        text: "偏怕熱、易煩躁，胸口或上腹時常有繃住感。",
      },
      {
        id: "B",
        text: "容易疲倦、口乾，做少少嘢都覺得被耗住。",
      },
      {
        id: "C",
        text: "偏怕冷、身重，成日覺得人冇乜力又唔想郁。",
      },
    ] as const,
  },
  group2: {
    prompt: "你嘅睡眠同精神狀態如何？",
    options: [
      {
        id: "X",
        text: "瞓夠都仍然頭重身重，日頭易昏沉、冇精神。",
      },
      {
        id: "Y",
        text: "入睡困難、易醒或多夢，醒來後心情偏急同煩躁。",
      },
      {
        id: "Z",
        text: "睡得淺又容易早醒，起身後仍然疲累、專注力差。",
      },
    ] as const,
  },
  group3: {
    prompt: "你嘅消化同排便情況如何？",
    options: [
      {
        id: "J",
        text: "偏便秘、口乾，腸胃偶爾乾滯，排便唔順暢。",
      },
      {
        id: "K",
        text: "胃脹、食慾一般，大便偏稀或唔成形。",
      },
      {
        id: "L",
        text: "消化易受情緒影響，胃氣頂住，排便時乾時黏唔穩定。",
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
    prompt: "昨晚休息之後，你今朝最接近邊種狀態？",
    options: [
      { id: "sleep_j", text: "半夜醒兩次以上或太早醒，起身後仍覺得心神被耗住。", delta: { J: 5 } },
      { id: "sleep_k", text: "瞓夠時間都頭重身重，起身後一段時間都未清醒。", delta: { K: 5 } },
      { id: "sleep_l", text: "帶住緊張入睡，夜晚因心口/上腹繃住或煩躁而醒。", delta: { L: 5 } },
    ],
  },
  {
    id: "body_signal",
    prompt: "今日「腹 / 腦 / 心」三區之中，邊個訊號最明顯？",
    options: [
      { id: "body_j", text: "【腦】眼同頭容易攰，專注一陣就乾耗，腦內停唔到。", delta: { J: 4 } },
      { id: "body_k", text: "【腹】腹脹同身重較明顯，坐耐少少就滯住唔想郁。", delta: { K: 4 } },
      { id: "body_l", text: "【心】胸口或上腹有繃住頂住感，要深呼吸先鬆到。", delta: { L: 4 } },
    ],
  },
  {
    id: "after_meal",
    prompt: "食完飯後，你最常見反應係？",
    options: [
      { id: "meal_j", text: "1-2 小時內已經再虛，專注力跌，要靠咖啡或甜食頂住。", delta: { J: 4, L: 1 } },
      { id: "meal_k", text: "飯後明顯眼瞓兼腹脹，個人慢半拍。", delta: { K: 5 } },
      { id: "meal_l", text: "食後有焗悶或頂住感，胸腹唔太舒展，情緒易急。", delta: { L: 5 } },
    ],
  },
  {
    id: "stress",
    prompt: "工作或生活壓力高時，你最易進入邊種狀態？",
    options: [
      { id: "stress_j", text: "腦內對話停唔到，越諗越攰，夜晚仲會重播。", delta: { J: 5 } },
      { id: "stress_k", text: "會拖延同收埋自己，明知要做都提唔起勁。", delta: { K: 5 } },
      { id: "stress_l", text: "語速同火氣上升，胸腹收緊，想即刻處理晒先安心。", delta: { L: 5 } },
    ],
  },
  {
    id: "stable",
    prompt: "以今日整體狀態計，邊句最貼近？",
    options: [
      { id: "stable_j", text: "今日最需要回神同補氣，否則好快透支。", delta: { J: 3 } },
      { id: "stable_k", text: "今日最需要啟動循環，否則越坐越滯。", delta: { K: 3 } },
      { id: "stable_l", text: "今日最需要降壓鬆開胸腹，否則容易繃住上火。", delta: { L: 3 } },
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
