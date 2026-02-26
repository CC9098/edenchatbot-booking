export type SymptomElement = "water" | "wind" | "thunder" | "undetermined";

export const SYMPTOM_ELEMENT_VALUES: SymptomElement[] = [
  "water",
  "wind",
  "thunder",
  "undetermined",
];

export const SYMPTOM_ELEMENT_LABEL_ZH: Record<SymptomElement, string> = {
  water: "水",
  wind: "風",
  thunder: "雷",
  undetermined: "未定",
};

export type SymptomElementScores = {
  water: number;
  wind: number;
  thunder: number;
};

export function isSymptomElement(value: unknown): value is SymptomElement {
  return typeof value === "string" && SYMPTOM_ELEMENT_VALUES.includes(value as SymptomElement);
}

export function resolveSeverityWeight(severity: number | null | undefined): number {
  const normalizedSeverity = typeof severity === "number" ? severity : Number.NaN;
  if (!Number.isInteger(normalizedSeverity)) return 1;
  if (normalizedSeverity >= 4) return 2;
  return 1;
}

export function buildSymptomElementScores(
  cue: SymptomElement,
  severity: number | null | undefined,
): SymptomElementScores {
  const scores: SymptomElementScores = {
    water: 0,
    wind: 0,
    thunder: 0,
  };

  if (cue === "undetermined") return scores;

  const weightedScore = resolveSeverityWeight(severity);
  if (cue === "water") scores.water = weightedScore;
  if (cue === "wind") scores.wind = weightedScore;
  if (cue === "thunder") scores.thunder = weightedScore;

  return scores;
}

export function resolveSuggestedElement(scores: SymptomElementScores): SymptomElement {
  const pairs: Array<{ key: Exclude<SymptomElement, "undetermined">; score: number }> = [
    { key: "water", score: scores.water },
    { key: "wind", score: scores.wind },
    { key: "thunder", score: scores.thunder },
  ];

  const maxScore = Math.max(...pairs.map((item) => item.score));
  if (maxScore <= 0) return "undetermined";

  const winners = pairs.filter((item) => item.score === maxScore);
  if (winners.length !== 1) return "undetermined";

  return winners[0].key;
}

export function resolveFinalElementLabel(
  suggested: SymptomElement | null | undefined,
  reviewed: SymptomElement | null | undefined,
): SymptomElement {
  if (reviewed && isSymptomElement(reviewed)) return reviewed;
  if (suggested && isSymptomElement(suggested)) return suggested;
  return "undetermined";
}
