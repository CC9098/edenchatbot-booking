"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Feather,
  ListChecks,
  ScrollText,
} from "lucide-react";

type NoteSection = {
  heading: string;
  items: string[];
  ordered?: boolean;
};

type NotebookPage = {
  eyebrow: string;
  title: string;
  intro?: string;
  sections: NoteSection[];
  sideNote?: string;
};

type FontStyle = "clear" | "classic" | "annotation";

type FontStyleOption = {
  id: FontStyle;
  label: string;
  sample: string;
  description: string;
  pageClassName: string;
};

const FONT_STYLE_STORAGE_KEY = "eden-doctor-notebook-font-style-v1";

const FONT_STYLE_OPTIONS: FontStyleOption[] = [
  {
    id: "clear",
    label: "清雅",
    sample: "正文字清楚",
    description: "適合長時間閱讀和培訓 SOP。",
    pageClassName: "doctor-notebook-font-clear",
  },
  {
    id: "classic",
    label: "書卷",
    sample: "明體書卷",
    description: "更似中醫手札和古籍筆記。",
    pageClassName: "doctor-notebook-font-classic",
  },
  {
    id: "annotation",
    label: "手寫批註",
    sample: "像醫師補筆",
    description: "較有人味，適合慢讀和內部文化。",
    pageClassName: "doctor-notebook-font-annotation",
  },
];

const NOTEBOOK_PAGES: NotebookPage[] = [
  {
    eyebrow: "卷首",
    title: "醫師手札",
    intro: "把診症經驗、溝通心法、團隊合作與處方細節，寫成一本可翻閱的內部筆記。",
    sections: [
      {
        heading: "本冊用途",
        items: [
          "給醫師溫習臨床溝通和診所合作模式。",
          "把細碎但重要的經驗保存下來，方便新舊醫師用同一套語氣和原則處理病人。",
          "先求真誠、穩定、清楚；再求技巧。",
        ],
      },
      {
        heading: "目錄",
        items: [
          "如何鼓勵病人覆診調理",
          "如何處理奧客",
          "醫師與姑娘合作指引：非繁忙時段合作模式 2025",
          "處方、服藥與特殊情況提醒",
          "醫師角度反思題",
        ],
      },
    ],
    sideNote: "治病先治心，溝通先求明。",
  },
  {
    eyebrow: "第一帖",
    title: "如何鼓勵病人覆診調理？",
    intro: "病人願意長期調理，往往不是因為被推銷，而是因為真正明白自己的身體狀態和治療方向。",
    sections: [
      {
        heading: "診症時先建立理解",
        items: [
          "第 1 次診療時多花心思和時間，解釋病人的身體現況。",
          "可用具體比喻說明中醫較繁複的理論。",
          "讓病人明白中醫治病的目標是治「本」，改善體質。",
        ],
      },
      {
        heading: "把調理變成可預期的路",
        items: [
          "具體地說明調理所需時間。",
          "強調調理過程也會逐步改善，病人會感到一步一步好轉。",
          "願意長期調理的病人，可給予適當套票九折優惠。",
          "真誠對待病人，從心底裡希望醫治和幫助病人。",
        ],
      },
    ],
    sideNote: "不是催促覆診，而是讓病人看見調理的方向。",
  },
  {
    eyebrow: "第二帖",
    title: "如何處理奧客？",
    intro: "先把病人的情緒承接好，再守住專業邊界。溝通不是退讓，而是讓事情重新回到可處理的範圍。",
    sections: [
      {
        heading: "溝通技巧",
        items: [
          "先傾聽再回應：讓患者充分表達需求，表示您重視他們的感受。",
          "同理心表達：「我理解您的疑慮」比「您誤會了」更能緩和情緒。",
          "以病患為中心：將溝通重點放在「您的健康」，而非「我的專業」。",
          "清楚說明風險：治療前明確說明可能結果，避免不切實際期望。",
        ],
      },
      {
        heading: "避免病人變成奧客",
        items: [
          "治療過程有不適，應親身致電關心問候，包括中藥處方、針灸、手法，並教導舒緩方法。",
          "若病人極度敏感，對中藥或痛感十分敏感，治療應由輕量開始，不宜急進。",
          "面對新病人，醫師應避免做沒有把握、亦有可能造成損傷的治療。",
        ],
      },
    ],
    sideNote: "先穩情緒，再穩原則。",
  },
  {
    eyebrow: "第三帖",
    title: "面對貪婪型或情緒勒索型奧客",
    intro: "有些要求表面是投訴，實際是在測試診所邊界。醫師要保持溫和，但不能失去一致性。",
    sections: [
      {
        heading: "四個守位原則",
        items: [
          "堅守專業判斷，保持治療原則的一致性。",
          "學會拒絕，婉轉但堅定地拒絕不合理要求，並提出替代方案。",
          "區分需求類型，辨別合理請求與無理要求。",
          "制定診所規範，明確公告收費標準、預約政策。",
        ],
      },
      {
        heading: "可用語氣",
        items: [
          "我明白您希望盡快處理，我先按紀錄和診所規範幫您確認可以怎樣安排。",
          "這個要求我不能即場承諾，但我可以提供一個較合適的處理方法。",
          "治療上我需要按安全原則判斷，不適合為了趕快見效而做過度處理。",
        ],
      },
    ],
    sideNote: "拒絕也可以有醫德，有禮貌，有溫度。",
  },
  {
    eyebrow: "合作卷",
    title: "醫師與姑娘合作指引",
    intro: "非繁忙時段合作模式 2025。這不是責任推卸，而是讓診所人手有限時仍能順暢運作。",
    sections: [
      {
        heading: "治療房及診療區基本管理",
        items: [
          "熟悉診所物資擺放和電制位置，必要時可自取物資。",
          "自行執行基本事務：執針灸房、自己執自己嘅藥、自己填紙巾、換水。",
          "清潔治療用品，使用過的拔罐預備下次使用。",
          "有空餘時間時協助清空治療房垃圾、執針灸房。",
        ],
      },
      {
        heading: "治療房準備工作",
        items: [
          "負責 set 房：預備衫褲、毛巾、床墊，更換新的床墊。",
          "確保治療物品如針灸、拔罐已妥善清晰放置，方便取用。",
          "已用的治療用品包裝直接扔入垃圾桶或垃圾膠兜，勿隨處棄置。",
        ],
      },
    ],
    sideNote: "房內清楚，心中也清楚。",
  },
  {
    eyebrow: "合作卷",
    title: "自主帶領病人與溝通機制",
    intro: "醫師可以獨立處理的事，應盡量自己處理；需要姑娘協助時，則用清楚渠道通知。",
    sections: [
      {
        heading: "自主帶領病人處理",
        items: [
          "自己帶病人入治療房，除非需要姑娘協助的特殊情況，如女性病人換衣時。",
          "男性醫師特別注意女性病人隱私，需要換衣時請姑娘協助。",
          "若需要修改藥方，使用內線電話通知姑娘，避免姑娘執藥中遺漏。",
          "平時也應透過 WhatsApp 提前通知姑娘藥方變更。",
        ],
      },
      {
        heading: "緊急需求溝通",
        items: [
          "如姑娘 WhatsApp 冇覆，而事情需急切回應，請用內線電話搵姑娘。",
          "了解姑娘可能正在處理其他工作，非在電腦前。",
        ],
      },
      {
        heading: "互動原則",
        items: [
          "尊重姑娘服務崗位，保持友善態度。",
          "了解診所人手安排限制，彼此配合。",
          "認同紙巾、換水等工作在人手有限時需醫師自行處理。",
        ],
      },
      {
        heading: "醫師獨立操作意識",
        items: [
          "醫師應有義務了解自己醫師房及針灸房治療物品存放位置。",
          "若有日常用品物資缺乏，友善地向姑娘取補給。",
          "理解姑娘非萬能，不期望無時無刻照顧周到。",
        ],
      },
    ],
    sideNote: "好聲好氣，是最快的工作流程。",
  },
  {
    eyebrow: "分工卷",
    title: "前台、藥房與治療區分工",
    intro: "分工清楚不是為了分界線，而是為了讓每個崗位知道甚麼時候該主動補位。",
    sections: [
      {
        heading: "姑娘負責範圍：前台加藥房區",
        items: [
          "開診前準備：預備醫師袍、開醫師房電腦，檢查日用品和治療用品是否充足。",
          "前台工作：客服查詢和預約、代理醫師與病人之間溝通、掛號、收錢、分單處理、處理到診紙、病假紙、醫師簽名。",
          "藥房工作：執藥、其他病人配藥、換藥和扣藥表、預熱外敷藥、各類寄藥事項。",
        ],
      },
      {
        heading: "醫師責任：醫師房加治療房區",
        items: [
          "醫師房：叫病人名入房看診。",
          "治療房工作：預備所需物品、帶病人入房、進行治療。",
          "物資管理意識：了解物資存放位置，切勿長期過度依賴姑娘。",
        ],
      },
    ],
    sideNote: "人手少時，清楚分工就是互相體諒。",
  },
  {
    eyebrow: "應變卷",
    title: "人手不足、突發與服藥說明",
    intro: "非繁忙時段也會有突發。醫師懂得基本操作，診所就不會因單一環節卡住。",
    sections: [
      {
        heading: "人手不足時",
        items: [
          "了解只有一個姑娘時，醫師需承擔更多基本工作。",
          "優先處理核心診療工作，其他事務可彈性安排。",
        ],
      },
      {
        heading: "突發事件",
        items: [
          "如遇交通問題、姑娘遲到等情況，醫師應能基本掌握診所運作。",
          "例如知道電制、醫師袍位置，以及基本開診所需事項。",
        ],
      },
      {
        heading: "主動教導病人服藥時間",
        items: [
          "當病人下午就診，而藥方寫了早上或中午服用，醫師應在診症時向病人說明。",
          "提醒今天的藥可在幾點前食，或是否需要到明早才服用。",
          "主動解釋服藥時間，避免每位病人都來回詢問醫師，減輕姑娘不必要的工作負擔。",
        ],
      },
    ],
    sideNote: "一句清楚說明，可以少十次來回追問。",
  },
  {
    eyebrow: "處方卷",
    title: "新症、藥丸與孕婦處理",
    intro: "處方不只是一張藥方，也是姑娘能否安全準確執行的工作指令。",
    sections: [
      {
        heading: "新症藥方與沖藥指引",
        items: [
          "對新症或英語病人，處方上建議提供沖藥指引。",
          "醫師可在「中醫在線」系統設置快捷鍵，方便輸入服藥方法。",
        ],
      },
      {
        heading: "標準沖藥指引",
        ordered: true,
        items: [
          "先把 80 至 100 毫升熱水倒入杯子，再放入藥粉。",
          "泡焗 3 至 5 分鐘。",
          "然後攪拌一下，待變溫，不是燙，才飲用。",
        ],
      },
      {
        heading: "統一藥丸用量文字格式",
        items: [
          "備註欄寫清楚：每天服 __ 次，每次 __ 粒。",
          "後加其他特別服用指引，如有。",
          "此標準化格式可避免姑娘出錯，例如過往醫師可能誤打 1g = 1 粒。",
        ],
      },
      {
        heading: "孕婦特殊處理",
        items: [
          "若病人是孕婦，在出藥方同時必須先通知姑娘。",
          "姑娘會使用新藥匙為病人配藥，確保安全。",
        ],
      },
    ],
    sideNote: "安全處方，由清楚文字開始。",
  },
  {
    eyebrow: "同心卷",
    title: "團隊協作精神",
    intro: "診所順暢，不只靠流程，也靠語氣、節奏和互相理解。",
    sections: [
      {
        heading: "互相理解與支持",
        items: [
          "了解彼此工作壓力和限制。",
          "中環等繁忙診所尤其需要互相配合，保持良好心態和節奏。",
          "提倡「有需要幫忙，只要好聲好氣」的合作氛圍。",
        ],
      },
      {
        heading: "角色認同與彈性",
        items: [
          "認同某些基本工作需由醫師自行處理，不過分依賴姑娘。",
          "清楚了解人手較少時需互相協助的工作範圍。",
        ],
      },
      {
        heading: "溝通與培訓建議",
        items: [
          "定期舉行醫師與姑娘的溝通會議，確保彼此理解工作期望。",
          "新入職醫師特別需要了解這些合作規範。",
          "透過實例分享成功的合作模式，建立最佳實踐案例。",
        ],
      },
    ],
    sideNote: "規範的目的，是令合作更有人情味。",
  },
  {
    eyebrow: "自省卷",
    title: "醫師角度反思題",
    intro: "這些題目可作面談、培訓或醫師自我修煉的提綱。",
    sections: [
      {
        heading: "六個常問題",
        items: [
          "如何處理奧客？",
          "如何鼓勵病人覆診調理？",
          "當病人問起一些不是你知識範圍時，你會點處理或應對？",
          "面對某些病人療效不顯著時，你會點處理或應對？",
          "如何讓自己醫術進步？",
          "當你需要用的藥診所缺乏時，你會點處理？",
        ],
      },
      {
        heading: "留白",
        items: [
          "每位醫師可把自己的句式、案例和反省補充到這本手札。",
          "這本筆記不是一次完成，而是診所文化慢慢寫出來。",
        ],
      },
    ],
    sideNote: "醫術要長，心也要長。",
  },
];

function getSpreadNumber(pageIndex: number) {
  return Math.floor(pageIndex / 2);
}

function splitIntoSpreads(pages: NotebookPage[]) {
  const spreads: Array<[NotebookPage, NotebookPage | null]> = [];

  for (let index = 0; index < pages.length; index += 2) {
    spreads.push([pages[index], pages[index + 1] ?? null]);
  }

  return spreads;
}

function readStoredFontStyle(): FontStyle {
  if (typeof window === "undefined") return "clear";

  const stored = window.localStorage.getItem(FONT_STYLE_STORAGE_KEY);
  return FONT_STYLE_OPTIONS.some((option) => option.id === stored) ? (stored as FontStyle) : "clear";
}

function PageContent({
  page,
  pageNumber,
  fontStyle,
}: {
  page: NotebookPage;
  pageNumber: number;
  fontStyle: FontStyle;
}) {
  const fontOption = FONT_STYLE_OPTIONS.find((option) => option.id === fontStyle) ?? FONT_STYLE_OPTIONS[0];

  return (
    <article className={`relative min-h-[620px] overflow-hidden rounded-[18px] border border-[#d8c6a3] bg-[#fffaf0] px-5 py-6 text-[#3f3424] shadow-[inset_0_0_40px_rgba(123,93,49,0.08)] sm:px-7 sm:py-8 ${fontOption.pageClassName}`}>
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(87,67,35,0.06)_1px,transparent_1px)] [background-size:100%_30px]" />
      <div className="pointer-events-none absolute -right-16 top-10 h-48 w-48 rounded-full border border-[#d4ad5d]/25" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-[#c5a35b]/40 bg-[#f8efd8] px-3 py-1 text-xs font-semibold tracking-[0.24em] text-[#8a6129]">
            {page.eyebrow}
          </span>
          <span className="font-serif text-xs text-[#9a7f52]">第 {pageNumber} 頁</span>
        </div>

        <h2 className="doctor-notebook-page-title mt-5 max-w-[12em] text-3xl font-semibold leading-tight text-[#263d2b] sm:text-4xl">
          {page.title}
        </h2>

        {page.intro ? (
          <p className="doctor-notebook-page-intro mt-4 border-l-2 border-[#a65d3b] pl-4 text-sm leading-7 text-[#5d513f] sm:text-[15px]">
            {page.intro}
          </p>
        ) : null}

        <div className="mt-6 space-y-5">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="doctor-notebook-section-title flex items-center gap-2 text-lg font-semibold text-[#365a3f]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a65d3b]" />
                {section.heading}
              </h3>
              {section.ordered ? (
                <ol className="doctor-notebook-page-body mt-2 space-y-2 pl-5 text-sm leading-7 text-[#493f31] sm:text-[15px]">
                  {section.items.map((item) => (
                    <li key={item} className="list-decimal pl-1">
                      {item}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="doctor-notebook-page-body mt-2 space-y-2 text-sm leading-7 text-[#493f31] sm:text-[15px]">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#b28b4b]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {page.sideNote ? (
          <div className="mt-7 flex items-start gap-3 rounded-md border border-[#d9c698] bg-[#fff6df] px-4 py-3 text-sm leading-6 text-[#6d4a24]">
            <Feather className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="doctor-notebook-side-note">{page.sideNote}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DoctorNotebook() {
  const spreads = useMemo(() => splitIntoSpreads(NOTEBOOK_PAGES), []);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [fontStyle, setFontStyle] = useState<FontStyle>("clear");

  const [leftPage, rightPage] = spreads[spreadIndex];
  const isFirst = spreadIndex === 0;
  const isLast = spreadIndex === spreads.length - 1;

  useEffect(() => {
    setFontStyle(readStoredFontStyle());
  }, []);

  function chooseFontStyle(nextFontStyle: FontStyle) {
    setFontStyle(nextFontStyle);
    window.localStorage.setItem(FONT_STYLE_STORAGE_KEY, nextFontStyle);
  }

  function goToSpread(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= spreads.length) return;
    setDirection(nextIndex > spreadIndex ? "next" : "prev");
    setSpreadIndex(nextIndex);
  }

  return (
    <div className="doctor-notebook -mx-4 -my-6 min-h-[calc(100vh-56px)] bg-[#efe7d5] px-4 py-5 text-[#263327] sm:-mx-6 sm:px-6 lg:py-8">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[20px] border border-[#c8b082] bg-[#243629] text-[#fff8ea] shadow-2xl shadow-[#4a3520]/20">
            <div className="relative h-72">
              <Image
                src="/images/doctor-notebook-cover.png"
                alt="醫師手札書法封面"
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover opacity-85"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17231a] via-[#17231a]/35 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="font-serif text-4xl font-semibold leading-tight">醫師手札</div>
                <div className="mt-2 text-sm leading-6 text-[#eadfc4]">內部筆記 · 診症溝通 · 團隊合作</div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#d5b56b]">
                <BookOpen className="h-4 w-4" />
                可翻閱章節
              </div>
              <div className="grid gap-2">
                {spreads.map((spread, index) => {
                  const active = index === spreadIndex;
                  const pageStart = index * 2 + 1;
                  const title = index === 0 ? "封面與覆診調理" : spread[0].title;

                  return (
                    <button
                      key={`${spread[0].title}-${index}`}
                      type="button"
                      onClick={() => goToSpread(index)}
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? "border-[#d5b56b] bg-[#d5b56b] text-[#213021]"
                          : "border-white/10 bg-white/5 text-[#efe7d5] hover:border-[#d5b56b]/60 hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate">{title}</span>
                      <span className="ml-3 shrink-0 text-xs opacity-70">p.{pageStart}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm leading-6 text-[#eadfc4]">
                <div className="mb-2 flex items-center gap-2 font-semibold text-[#f5d98f]">
                  <Bookmark className="h-4 w-4" />
                  手札原則
                </div>
                這頁不是給病人看的宣傳頁，而是醫師內部溫習、面談、培訓時使用的臨床筆記。
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-[#d0bd91] bg-[#fff8ea]/85 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#8c632c]">
                  <ScrollText className="h-4 w-4" />
                  醫天圓 · 醫師內部手札
                </div>
                <h1 className="mt-1 font-serif text-2xl font-semibold text-[#263d2b] sm:text-3xl">
                  一本真的可以揭的醫師筆記本
                </h1>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <div className="grid grid-cols-3 gap-1 rounded-full border border-[#d6c297] bg-[#fbf0d8] p-1">
                  {FONT_STYLE_OPTIONS.map((option) => {
                    const active = option.id === fontStyle;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseFontStyle(option.id)}
                        aria-pressed={active}
                        title={option.description}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-[#263d2b] text-[#fff8ea]"
                            : "text-[#6a512f] hover:bg-[#efe0bc]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToSpread(spreadIndex - 1)}
                    disabled={isFirst}
                    aria-label="上一頁"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#c5a35b] bg-[#fffaf0] text-[#5a4b35] transition-colors hover:bg-[#f4e7c7] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="min-w-[92px] text-center text-sm font-semibold text-[#5a4b35]">
                    {spreadIndex + 1} / {spreads.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToSpread(spreadIndex + 1)}
                    disabled={isLast}
                    aria-label="下一頁"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#c5a35b] bg-[#fffaf0] text-[#5a4b35] transition-colors hover:bg-[#f4e7c7] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {FONT_STYLE_OPTIONS.map((option) => {
                const active = option.id === fontStyle;

                return (
                  <button
                    key={`sample-${option.id}`}
                    type="button"
                    onClick={() => chooseFontStyle(option.id)}
                    className={`rounded-md border px-4 py-3 text-left transition-colors ${
                      active
                        ? "border-[#9a6a2e] bg-[#fff6df] shadow-sm"
                        : "border-[#d7c59d] bg-[#fffaf0]/75 hover:bg-[#fff6df]"
                    }`}
                  >
                    <div className={`text-lg text-[#263d2b] ${option.pageClassName}`}>
                      <span className="doctor-notebook-page-body">{option.sample}</span>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#7a6240]">{option.description}</div>
                  </button>
                );
              })}
            </div>

            <div className="relative rounded-[26px] border border-[#8d6a35]/25 bg-[#5f3d20] p-3 shadow-2xl shadow-[#4f351d]/20 sm:p-5">
              <div className="absolute bottom-8 left-1/2 top-8 hidden w-px -translate-x-1/2 bg-[#a97b3e]/45 lg:block" />
              <div
                key={spreadIndex}
                className={`grid gap-4 lg:grid-cols-2 ${
                  direction === "next" ? "doctor-notebook-turn-next" : "doctor-notebook-turn-prev"
                }`}
              >
                <PageContent page={leftPage} pageNumber={spreadIndex * 2 + 1} fontStyle={fontStyle} />
                {rightPage ? (
                  <PageContent page={rightPage} pageNumber={spreadIndex * 2 + 2} fontStyle={fontStyle} />
                ) : (
                  <article className="relative min-h-[620px] overflow-hidden rounded-[18px] border border-[#d8c6a3] bg-[#fffaf0] p-8 shadow-[inset_0_0_40px_rgba(123,93,49,0.08)]">
                    <div className="flex h-full items-center justify-center text-center font-serif text-xl text-[#a38455]">
                      留白，待醫師補筆。
                    </div>
                  </article>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                "先聆聽，再說明",
                "以比喻解釋身體現況",
                "治本，調體質",
              ].map((line) => (
                <div
                  key={line}
                  className="flex items-center gap-2 rounded-md border border-[#d7c59d] bg-[#fff8ea] px-4 py-3 font-serif text-sm text-[#5f4b2f]"
                >
                  <ListChecks className="h-4 w-4 text-[#8b6733]" />
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
