export type StaffEmojiOption = {
  emoji: string;
  label: string;
};

export type StaffEmojiGroup = {
  label: string;
  emojis: readonly StaffEmojiOption[];
};

/**
 * A small set of patient-safe emojis for the staff reply composer.
 * Keep this list curated so the picker stays quick to scan on a phone.
 */
export const STAFF_EMOJI_GROUPS: readonly StaffEmojiGroup[] = [
  {
    label: "常用",
    emojis: [
      { emoji: "👋", label: "揮手" },
      { emoji: "😊", label: "開心" },
      { emoji: "🙂", label: "微笑" },
      { emoji: "🙏", label: "多謝" },
      { emoji: "👍", label: "讚好" },
      { emoji: "👌", label: "好" },
      { emoji: "🤝", label: "合作" },
      { emoji: "💚", label: "綠心" },
      { emoji: "❤️", label: "紅心" },
      { emoji: "🤍", label: "白心" },
      { emoji: "✨", label: "閃亮" },
      { emoji: "✅", label: "完成" },
    ],
  },
  {
    label: "回覆",
    emojis: [
      { emoji: "📅", label: "日曆" },
      { emoji: "⏰", label: "時間" },
      { emoji: "📍", label: "位置" },
      { emoji: "📞", label: "電話" },
      { emoji: "💬", label: "對話" },
      { emoji: "📩", label: "訊息" },
      { emoji: "🔗", label: "連結" },
      { emoji: "📝", label: "筆記" },
      { emoji: "❓", label: "問題" },
      { emoji: "❗", label: "提示" },
      { emoji: "🔔", label: "提醒" },
      { emoji: "✔️", label: "勾號" },
    ],
  },
  {
    label: "關懷",
    emojis: [
      { emoji: "🫶", label: "比心" },
      { emoji: "🤗", label: "擁抱" },
      { emoji: "💪", label: "加油" },
      { emoji: "😌", label: "安心" },
      { emoji: "🌿", label: "葉子" },
      { emoji: "🌸", label: "花" },
      { emoji: "☀️", label: "陽光" },
      { emoji: "🌈", label: "彩虹" },
      { emoji: "🍀", label: "幸運" },
      { emoji: "🩺", label: "醫療" },
      { emoji: "💊", label: "藥物" },
      { emoji: "🌙", label: "夜晚" },
    ],
  },
  {
    label: "慶祝",
    emojis: [
      { emoji: "🎉", label: "慶祝" },
      { emoji: "🎂", label: "生日蛋糕" },
      { emoji: "🎁", label: "禮物" },
      { emoji: "🎊", label: "彩帶" },
      { emoji: "🎈", label: "氣球" },
      { emoji: "☕️", label: "咖啡" },
      { emoji: "🍵", label: "茶" },
      { emoji: "🥳", label: "開心" },
      { emoji: "👏", label: "鼓掌" },
      { emoji: "🙌", label: "歡呼" },
      { emoji: "⭐", label: "星星" },
      { emoji: "💐", label: "花束" },
    ],
  },
] as const;

function clampSelection(
  position: number | null | undefined,
  length: number,
  fallback: number,
): number {
  if (typeof position !== "number" || !Number.isFinite(position)) {
    return fallback;
  }

  return Math.min(length, Math.max(0, Math.floor(position)));
}

export type EmojiInsertion = {
  value: string;
  caret: number;
};

/**
 * Insert an emoji at the textarea selection and return the caret offset in
 * UTF-16 code units, which is the offset used by HTMLTextAreaElement.
 */
export function insertEmojiAtCaret(
  value: string,
  emoji: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined = selectionStart,
): EmojiInsertion {
  const start = clampSelection(selectionStart, value.length, value.length);
  const end = clampSelection(selectionEnd, value.length, start);
  const from = Math.min(start, end);
  const to = Math.max(start, end);

  return {
    value: `${value.slice(0, from)}${emoji}${value.slice(to)}`,
    caret: from + emoji.length,
  };
}
