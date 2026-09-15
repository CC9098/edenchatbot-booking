export const readingTopics = [
  {
    id: "sleep",
    label: "睡眠與壓力",
    question: "睡不安穩，日間也難以放鬆？",
    description: "從睡眠、出汗等身體變化，了解中醫文章中的觀察與辨證角度。",
    articles: [
      {
        title: "失眠個案：自律神經與睡眠的關係",
        description: "透過一篇病案分享，認識失眠的評估與跟進思路。個案經驗不代表每個人的治療結果。",
        href: "https://www.edenclinic.hk/2025/04/【病案治療經驗分享】失眠-自律神經失調所致/",
        category: "病案閱讀",
      },
      {
        title: "夜間盜汗：留意睡眠中的身體變化",
        description: "閱讀夜間出汗的相關介紹，以及中醫如何理解不同表現。",
        href: "https://www.edenclinic.hk/2024/05/night-sweats/",
        category: "症狀認識",
      },
    ],
  },
  {
    id: "food",
    label: "飲食與日常",
    question: "食完飯總是眼瞓，飲食可以怎樣留意？",
    description: "把餐後精神、進食習慣與作息放在一起看，從日常生活認識身體。",
    articles: [
      {
        title: "餐後嗜睡：認識「飯氣攻心」",
        description: "午餐後昏昏欲睡，是日常生理反應，還是值得進一步了解的健康訊號？",
        href: "https://www.edenclinic.hk/2024/09/飯氣攻心/",
        category: "飲食與精神",
      },
      {
        title: "減壓食譜：中醫食療的日常思路",
        description: "認識食材與食療的配搭想法。食療選擇仍需考慮個人體質、疾病及用藥。",
        href: "https://www.edenclinic.hk/2024/04/stress-relief-recipes/",
        category: "食療閱讀",
      },
    ],
  },
  {
    id: "lung",
    label: "呼吸道與飲食",
    question: "想了解肺部健康與飲食？",
    description: "從疾病知識到日常飲食，閱讀李醫師的相關文章；檢查與覆診安排應按主診醫生建議。",
    articles: [
      {
        title: "肺結節：成因、檢查與飲食問題",
        description: "了解肺結節相關知識及文章中的中醫觀點。飲食與中醫調理不能取代影像檢查或專科跟進。",
        href: "https://www.edenclinic.hk/2025/05/肺結節全面解析/",
        category: "肺部健康",
      },
      {
        title: "支氣管擴張：認識疾病與中醫觀點",
        description: "延伸閱讀呼吸道健康文章，了解中醫辨證的討論方向。",
        href: "https://www.edenclinic.hk/2024/12/中醫治療支氣管擴張/",
        category: "呼吸道健康",
      },
    ],
  },
  {
    id: "women",
    label: "婦科與飲食",
    question: "經期不適，日常飲食有甚麼值得了解？",
    description: "認識婦科疾病及飲食相關問題，為與醫師討論個人情況作準備。",
    articles: [
      {
        title: "子宮腺肌症：飲食指南",
        description: "閱讀子宮腺肌症的飲食討論，了解日常飲食與個人病情需要如何配合。",
        href: "https://www.edenclinic.hk/2026/03/adenomyosis-diet-guide/",
        category: "婦科飲食",
      },
      {
        title: "子宮內膜異位症：疾病與中醫認識",
        description: "從相關症狀到中醫辨證，了解文章所介紹的不同角度。",
        href: "https://www.edenclinic.hk/2024/04/endometriosis/",
        category: "婦科健康",
      },
    ],
  },
] as const;
