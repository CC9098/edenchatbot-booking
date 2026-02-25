import type { TendencyKey, TendencyScore } from "./constitution-tendency";

/**
 * Centralised narrative copy for the Eden Care patient-facing app.
 *
 * All patient-visible narrative text lives here so the voice stays consistent
 * across screens.  The tone is that of a quiet companion — warm but never
 * pushy, suggestive but never commanding.
 */

// ---------------------------------------------------------------------------
// Constitution / Force narratives
// ---------------------------------------------------------------------------

export type ConstitutionNarrative = {
  /** Single Chinese character: 風 / 水 / 雷 */
  forceName: string;
  /** Display label: 風勢 / 水勢 / 雷勢 */
  forceLabel: string;
  /** TCM label shown in small print */
  tcmLabel: string;
  /** Four-character hint for the chat whisper bar */
  shortHint: string;
  /** Two-sentence body description for the care page card */
  bodyDescription: string;
  /** One-sentence introduction before diet tips */
  dietIntro: string;
  /** Diet section heading */
  dietHeading: string;
  /** Template for the force-panel reading (2-3 sentences) */
  readingWhenPrimary: string;
  /** Chat top-bar whisper line */
  whisperLine: string;
  /** Extremely pale background class (Tailwind) for accent cards */
  accentBg: string;
};

export const FORCE_NARRATIVE: Record<TendencyKey, ConstitutionNarrative> = {
  J: {
    forceName: "風",
    forceLabel: "風勢",
    tcmLabel: "虛損",
    shortHint: "留意回氣",
    bodyDescription:
      "你的身體容易消耗，\n需要更多回氣的空間。",
    dietIntro: "風勢偏高的人，消化是最需要被溫柔對待的地方。",
    dietHeading: "養生飲食方針",
    readingWhenPrimary:
      "風勢為主。你近來的節奏偏快，身體在提醒你回氣。",
    whisperLine: "風勢偏高 · 留意回氣",
    accentBg: "bg-teal-50/60",
  },
  K: {
    forceName: "水",
    forceLabel: "水勢",
    tcmLabel: "痰濕",
    shortHint: "讓它流動",
    bodyDescription:
      "你的身體偏向沉積，\n需要更多輕盈和流動。",
    dietIntro: "水勢偏高的人，身體需要的是輕盈和流動。",
    dietHeading: "養生飲食方針",
    readingWhenPrimary:
      "水勢為主。你近來的身體偏向沉澱，讓它慢慢找到出口。",
    whisperLine: "水勢偏高 · 讓它流動",
    accentBg: "bg-indigo-50/60",
  },
  L: {
    forceName: "雷",
    forceLabel: "雷勢",
    tcmLabel: "鬱結",
    shortHint: "鬆開張力",
    bodyDescription:
      "你的身體容易繃緊，\n需要更多空間讓張力散開。",
    dietIntro: "雷勢偏高的人，舒展比壓抑更重要。",
    dietHeading: "養生飲食方針",
    readingWhenPrimary:
      "雷勢為主。你近來的壓力在聚，深呼吸，讓張力有空間散開。",
    whisperLine: "雷勢偏高 · 鬆開張力",
    accentBg: "bg-amber-50/60",
  },
};

// ---------------------------------------------------------------------------
// Mapping from server-side constitution keys to tendency keys
// ---------------------------------------------------------------------------

const CONSTITUTION_TO_TENDENCY: Record<string, TendencyKey> = {
  depleting: "J",
  crossing: "L",
  hoarding: "K",
};

export function constitutionToTendencyKey(constitution: string | null | undefined): TendencyKey | null {
  if (!constitution) return null;
  return CONSTITUTION_TO_TENDENCY[constitution] ?? null;
}

// ---------------------------------------------------------------------------
// General copy
// ---------------------------------------------------------------------------

export const NARRATIVE = {
  /** Care page opening quote (two lines) */
  carePageQuote: "回到自己的節奏，\n就是最好的開始。",

  /** Booking success confirmation line */
  bookingSuccessLine: "每一次回來，身體都記得。",

  /** Daily sense prompt — shown when today's check-in is not done */
  dailySensePrompt: "今天，你的身體想說什麼？",
  dailySenseButton: "停一停，聽聽",

  /** Daily tip label (right-aligned small text) */
  dailyTipLabel: "— 今日一念",

  /** Chat welcome message — warm companion tone */
  chatWelcome:
    "你好。我是醫天圓的體質顧問。\n\n飲食、作息、體質調養⋯⋯或者就是想聊聊今天的感覺，我都在這裡。",

  /** Booking page opening quote */
  bookingQuote: "每一次預約，\n都是照顧自己的開始。",

  /** Booking page subtitle (native in-app flow) */
  bookingSubtitle: "選好醫師和時間，其餘的交給我們。",

  /** Web booking page description */
  webBookingDescription:
    "你可以先用 AI 助手了解體質與養生建議，再完成預約；\n或直接前往預約平台選擇時段。",

  /** Mixed constitution narrative */
  mixedBodyDescription: "你的三勢正在尋找平衡，\n先跟隨醫師的方向走。",
  mixedDietIntro: "混合狀態下，穩定比追求完美更重要。",
  mixedTcmLabel: "混合",

  /** Unknown constitution narrative */
  unknownBodyDescription: "你的體質尚未完整評估，\n先用最基本的節奏照顧自己。",
  unknownDietIntro: "在認識自己之前，清淡和規律是最安全的起點。",
  unknownTcmLabel: "未評估",
} as const;

// ---------------------------------------------------------------------------
// Personalised force-panel reading generator
// ---------------------------------------------------------------------------

export function generateForceReading(
  primaryKey: TendencyKey,
  secondaryKey: TendencyKey,
  percentages: TendencyScore,
  isMixed: boolean,
): string {
  const primary = FORCE_NARRATIVE[primaryKey];
  if (isMixed) {
    const secondary = FORCE_NARRATIVE[secondaryKey];
    return `${primary.forceLabel}和${secondary.forceLabel}正在共鳴。你的身體在兩種節奏之間尋找平衡。`;
  }
  return primary.readingWhenPrimary;
}
