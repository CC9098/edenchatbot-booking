export const CONSTITUTION_BASE_DIET_TIPS = {
  depleting: [
    "三餐定時，盡量固定時段進食。",
    "早餐要食，避免空腹飲咖啡。",
    "主菜以溫熱熟食為主，減少生冷。",
    "每餐加入易消化蛋白質，例如蛋、魚、豆腐。",
    "多用燉、煮、蒸，少食乾硬炸脆。",
    "每餐保留少量優質油脂，避免太乾口。",
    "忙碌日子先備健康加餐，避免過飢。",
    "晚餐避免太遲，睡前兩至三小時完成。",
    "咖啡因每日控制，下午後盡量減少。",
    "調理期維持規律，比極端飲食更重要。",
  ],
  crossing: [
    "每餐至少半碟蔬菜，顏色越多越好。",
    "主油以橄欖油或菜籽油為主，少量多次使用。",
    "每周至少三次豆類主菜。",
    "全穀主食取代部分精製澱粉。",
    "每周兩至三次魚類，優先深海魚。",
    "紅肉份量縮小，以魚豆蛋禽替代。",
    "每日一小把原味堅果。",
    "多用香草香料提味，少靠重鹽。",
    "進食節奏放慢，避免情緒性暴食。",
    "優先追求長期穩定，而非短期極端。",
  ],
  hoarding: [
    "每餐以豆類或豆製品作主要蛋白之一。",
    "每日蔬菜至少五份，先食菜後食主食。",
    "主食優先全穀如糙米、燕麥、蕎麥。",
    "甜飲改白水或無糖茶。",
    "奶茶與含糖飲料盡量停。",
    "油炸食物留作偶爾聚會。",
    "乳製品量要控制，避免厚重黏滯。",
    "每餐七分飽，避免飽到頂住。",
    "晚餐提早，睡前不再進食。",
    "每次只改一兩項，但連續做滿四周再評估。",
  ],
  mixed: [
    "優先執行醫師已標註的宜忌。",
    "每次只改一至兩項習慣，較易持續。",
    "每周檢視身體反應再微調。",
    "先穩定三餐與睡眠，再談進階調理。",
    "一半餐盤用蔬菜，主食和蛋白按活動量調整。",
    "避免同時做太多極端飲食改動。",
    "若某食材令症狀加重，先記錄再與醫師討論。",
    "外食時先求清淡，再求花款。",
    "有壓力時先維持規律，不要用節食硬撐。",
    "每兩至四周回顧一次再決定下一步。",
  ],
  unknown: [
    "飲食定時定量，先穩定作息。",
    "先減少生冷、油炸、甜食。",
    "每餐加入蔬菜與優質蛋白。",
    "每日補充足夠水分，少飲含糖飲料。",
    "晚餐避免太夜太飽。",
    "減少超加工食品。",
    "外食優先蒸煮湯類而非油炸。",
    "先做可持續的小改動，不求一步到位。",
    "記錄食後反應，找出個人不合食材。",
    "如症狀持續，建議與醫師再評估。",
  ],
} as const;

export type ConstitutionDietKey = keyof typeof CONSTITUTION_BASE_DIET_TIPS;

export function getConstitutionDietTips(constitution: string | null | undefined): readonly string[] {
  if (!constitution) return CONSTITUTION_BASE_DIET_TIPS.unknown;
  if (constitution in CONSTITUTION_BASE_DIET_TIPS) {
    return CONSTITUTION_BASE_DIET_TIPS[constitution as ConstitutionDietKey];
  }
  return CONSTITUTION_BASE_DIET_TIPS.unknown;
}
