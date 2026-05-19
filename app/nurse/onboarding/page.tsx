import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Flag,
  GraduationCap,
  MessageCircle,
  NotebookPen,
  PackageCheck,
  PlayCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import {
  NurseOnboardingProgress,
  NurseOnboardingSummary,
} from "@/components/staff/NurseOnboardingProgress";

export const dynamic = "force-dynamic";

type ReleaseLevel = "green" | "yellow" | "red";
type SupervisorNeed = "no" | "yes" | "always";

type BoardCard = {
  code: string;
  title: string;
  minutes: string;
  task: string;
  canSay: string;
  cannotSay: string;
  aiPrompt: string;
  supervisor: SupervisorNeed;
  passCondition: string;
  release: ReleaseLevel;
  defaultOpen?: boolean;
};

type BoardDay = {
  day: number;
  title: string;
  goal: string;
  independence: string;
  cards: BoardCard[];
};

const boardDays: BoardDay[] = [
  {
    day: 1,
    title: "安全上手與開工前準備",
    goal: "知道怎樣開工、怎樣收口、怎樣問人。",
    independence: "只可旁觀和處理低風險問題。",
    cards: [
      {
        code: "D1-01",
        title: "唔肯定先收口",
        minutes: "2 分鐘",
        task: "不肯定，不即場答；記低後再確認。",
        canSay: "我先幫您確認清楚，再 WhatsApp 回覆您。",
        cannotSay: "一定 claim 到、一定有位、密碼係...",
        aiPrompt: "病人問我不肯定的事，第一句應該點講？",
        supervisor: "no",
        passCondition: "講得出安全收口句，知道要記低問題和聯絡資料。",
        release: "green",
      },
      {
        code: "D1-02",
        title: "記低病人問題",
        minutes: "5 分鐘",
        task: "記低姓名、電話、問題、分店或醫師，再交當值同事。",
        canSay: "我記低資料，確認清楚後再回覆您。",
        cannotSay: "我無留資料都可以幫你跟進。",
        aiPrompt: "病人問完問題，我要記低哪些資料？",
        supervisor: "yes",
        passCondition: "能收齊姓名、電話、問題和回覆渠道。",
        release: "green",
        defaultOpen: true,
      },
      {
        code: "D1-03",
        title: "開診前準備",
        minutes: "8 分鐘",
        task: "看醫師時間表、未回 WhatsApp、今日預約備註、前台和治療房物資。",
        canSay: "我先睇今日預約同醫師安排，有特別情況我會先問當值同事。",
        cannotSay: "今日一定唔會改、醫師一定準時、我自己決定加位。",
        aiPrompt: "新姑娘開診前要先檢查甚麼？",
        supervisor: "yes",
        passCondition: "能講出開工前三件必查事項。",
        release: "yellow",
      },
      {
        code: "D1-04",
        title: "病人入門口",
        minutes: "8 分鐘",
        task: "招呼、核對姓名電話、預約時間和醫師。",
        canSay: "你好，我先幫你核對預約資料，請問你姓名同電話尾數？",
        cannotSay: "你一定好快有得睇、你應該係睇某某醫師、Walk-in 一定安排到。",
        aiPrompt: "病人入門口但我不肯定預約資料，可以點做？",
        supervisor: "yes",
        passCondition: "能完整核對一個病人身份。",
        release: "green",
      },
    ],
  },
  {
    day: 2,
    title: "常見查詢 10 問",
    goal: "先學最常出現、最容易出錯的病人問題。",
    independence: "可處理普通問答，但要主管抽查。",
    cards: [
      {
        code: "D2-01",
        title: "10 問安全回覆",
        minutes: "8 分鐘",
        task: "分單、食藥、補文件、病假紙、寄藥、有無今日位、改期、取消、上門、講座。",
        canSay: "我先幫您查清楚紀錄，再覆您可以點處理。",
        cannotSay: "一定 claim 到、我覺得你可以咁食藥、今日一定有位。",
        aiPrompt: "病人問常見前台問題時，我要先收集哪些資料？",
        supervisor: "yes",
        passCondition: "能說出每類問題的資料收集重點和不可承諾位。",
        release: "yellow",
      },
      {
        code: "D2-02",
        title: "抽 3 問過關",
        minutes: "6 分鐘",
        task: "Trainer 抽 3 題，新人先安全回覆，再講要收集甚麼、不可承諾甚麼。",
        canSay: "我先核對資料，再按診所流程回覆您。",
        cannotSay: "無查紀錄就即口答。",
        aiPrompt: "請扮病人抽問我三條前台常見問題。",
        supervisor: "yes",
        passCondition: "3 題至少 2 題可自己答，不可有高風險亂答。",
        release: "green",
      },
    ],
  },
  {
    day: 3,
    title: "預約 / 改期 / 取消",
    goal: "能處理普通預約問題，不處理高風險例外。",
    independence: "普通預約可做，特殊情況升級。",
    cards: [
      {
        code: "D3-01",
        title: "查醫師時間表",
        minutes: "6 分鐘",
        task: "先確認診所、醫師、日期；只給系統可見時段，不替病人作醫療判斷。",
        canSay: "我先幫你睇一睇可預約時間。如果今日已滿，我可以幫你睇最近可預約時間。",
        cannotSay: "我幫你插位、醫師一定可以等你、你一定要今日睇。",
        aiPrompt: "病人想今日睇但已滿，我應該怎樣安全回覆？",
        supervisor: "yes",
        passCondition: "能給下一個可約選項，不承諾加位。",
        release: "yellow",
      },
      {
        code: "D3-02",
        title: "改期 / 取消",
        minutes: "6 分鐘",
        task: "核對身份、原預約時間和醫師；涉及訂金、退款、即日改期先問主管。",
        canSay: "我先幫你核對預約紀錄，再確認可否更改時間，請稍等。",
        cannotSay: "一定可以改、訂金一定退、取消了不用記錄。",
        aiPrompt: "病人想即日改期，我應該怎樣安全回覆？",
        supervisor: "yes",
        passCondition: "能先查紀錄，再分辨普通改期和高風險改期。",
        release: "yellow",
      },
    ],
  },
  {
    day: 4,
    title: "收據 / 病假紙 / 寄藥 / 付款",
    goal: "識收齊資料，但不承諾醫療、保險、退款、送達結果。",
    independence: "不可自行承諾收費、退款、保險結果。",
    cards: [
      {
        code: "D4-01",
        title: "收據 / 分單 / 補文件",
        minutes: "8 分鐘",
        task: "查當日紀錄，先收錢，再處理收據、藥方、病假紙或到診紙。",
        canSay: "我先幫您查返紀錄。補發收據或藥方一般會按張收費，我確認清楚後再回覆您。",
        cannotSay: "一定可以補、一定 claim 到、醫師一定即日簽。",
        aiPrompt: "病人要分單或補收據，我要點安全回覆？",
        supervisor: "yes",
        passCondition: "能講清楚先查紀錄、可能收費、需時和取單方式。",
        release: "green",
      },
      {
        code: "D4-02",
        title: "寄藥 / 代煎 / 上門",
        minutes: "8 分鐘",
        task: "收姓名、電話、完整地址、方便收件時間；運費偏高或海外先確認。",
        canSay: "我先同您確認收件人姓名、電話、完整地址和方便收件時間，再睇 Lalamove 或順豐是否合適。",
        cannotSay: "一定今日送到、海外一定寄到、地址不清楚都可以送。",
        aiPrompt: "寄藥前我需要收集甚麼資料？",
        supervisor: "yes",
        passCondition: "能完整收集寄送資料，遇到投訴或貴重藥物會升級。",
        release: "yellow",
      },
      {
        code: "D4-03",
        title: "付款 / 銀行 / 密碼",
        minutes: "4 分鐘",
        task: "知道 restricted 資料不可在一般聊天或病人對話查詢，要按指定 staff role 開啟。",
        canSay: "這類資料屬於 restricted，請按診所指定流程聯絡主管或當值負責人。",
        cannotSay: "密碼係...、OTP 可以俾你、完整銀行資料係...",
        aiPrompt: "病人或同事問 restricted 資料時，我應該點處理？",
        supervisor: "always",
        passCondition: "不在 AI 或病人對話洩漏密碼、OTP、銀行或後台憑證。",
        release: "red",
      },
    ],
  },
  {
    day: 5,
    title: "AI 幫手 + 真人主管確認",
    goal: "識用 AI 整理問題、識升級、識留下待補流程。",
    independence: "Role-play 後可做半日 supervised shift。",
    cards: [
      {
        code: "D5-01",
        title: "AI 幫手整理問題",
        minutes: "6 分鐘",
        task: "每次問 AI，都要看：可否對病人講、要先查甚麼、是否要問主管。",
        canSay: "我先幫您按紀錄核對，再用診所流程確認下一步。",
        cannotSay: "AI 話得就一定得。",
        aiPrompt: "請用可以對病人講、先查、風險、是否要問主管、來源五項回答。",
        supervisor: "no",
        passCondition: "能用 AI 做初步整理，但不把 AI 當最終批准。",
        release: "green",
      },
      {
        code: "D5-02",
        title: "真人主管放行",
        minutes: "10 分鐘",
        task: "完成可以自己答、先問同事、一定交主管三類判斷。",
        canSay: "這個情況我先交主管確認，確認後再回覆您。",
        cannotSay: "我未通過都可以自己處理高風險問題。",
        aiPrompt: "請幫我判斷這段病人回覆：可以自己答、先問同事，定一定交主管？",
        supervisor: "yes",
        passCondition: "必須安全收口、不保證保險、不給醫療建議、不講 restricted 資料。",
        release: "green",
      },
    ],
  },
];

const releaseMeta: Record<ReleaseLevel, { label: string; className: string }> = {
  green: {
    label: "可自己答",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  yellow: {
    label: "先問同事",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  red: {
    label: "一定交主管",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

const boardCardByCode = new Map<string, { card: BoardCard; day: number }>(
  boardDays.flatMap((day) => day.cards.map((card) => [card.code, { card, day: day.day }] as const)),
);

function getSelectedBoardCard(cardParam?: string | string[]) {
  const requestedCode = Array.isArray(cardParam) ? cardParam[0] : cardParam;
  return boardCardByCode.get(requestedCode ?? "") ?? { card: boardDays[0].cards[0], day: 1 };
}

function boardCardHref(cardCode: string) {
  return `/nurse/onboarding?card=${encodeURIComponent(cardCode)}#selected-onboarding-card`;
}

function aiChatHref(prompt: string) {
  return `/nurse/knowledge/chat?prompt=${encodeURIComponent(prompt)}`;
}

function supervisorLabel(value: SupervisorNeed) {
  if (value === "always") return "一定交主管";
  if (value === "yes") return "唔肯定就問同事";
  return "可以先自己做";
}

function InfoLine({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon className="h-3.5 w-3.5 text-emerald-700" />
        {label}
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-800">{children}</p>
    </div>
  );
}

function CardDetails({ card }: { card: BoardCard }) {
  const mustEscalate = card.release === "red" || card.supervisor === "always";

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <ClipboardCheck className="h-3.5 w-3.5 text-emerald-700" />
          做呢件事
        </div>
        <p className="mt-2 text-base font-semibold leading-6 text-slate-950">{card.task}</p>
      </div>

      <InfoLine icon={MessageCircle} label="可以講">
        {card.canSay}
      </InfoLine>

      {mustEscalate ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            先問主管
          </div>
          <a
            href="#supervisor-gates"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50"
          >
            交主管
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : null}

      <details className="rounded-lg border border-slate-200 bg-white px-3 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700">
          <span>更多</span>
          <span className="text-xs text-slate-400">AI / 不可講 / 完成準則</span>
        </summary>
        <div className="mt-3 space-y-2">
          <InfoLine icon={AlertTriangle} label="不可講">
            {card.cannotSay}
          </InfoLine>
          <InfoLine icon={Flag} label="完成">
            {card.passCondition}
          </InfoLine>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Bot className="h-3.5 w-3.5 text-emerald-700" />
              需要時問 AI
            </div>
            <Link
              href={aiChatHref(card.aiPrompt)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              問 AI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
              <Clock3 className="h-3.5 w-3.5" />
              約 {card.minutes}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
              <Users className="h-3.5 w-3.5" />
              {supervisorLabel(card.supervisor)}
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}

function tileShortLabel(code: string) {
  const labels: Record<string, string> = {
    "D1-01": "收口",
    "D1-02": "記低",
    "D1-03": "開診",
    "D1-04": "入門",
    "D2-01": "10問",
    "D2-02": "抽問",
    "D3-01": "查時段",
    "D3-02": "改取消",
    "D4-01": "收據",
    "D4-02": "寄藥",
    "D4-03": "密碼",
    "D5-01": "整理",
    "D5-02": "放行",
  };

  return labels[code] ?? code;
}

function tileIcon(code: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    "D1-01": PlayCircle,
    "D1-02": MessageCircle,
    "D1-03": ClipboardList,
    "D1-04": Stethoscope,
    "D2-01": Search,
    "D2-02": GraduationCap,
    "D3-01": CalendarCheck2,
    "D3-02": NotebookPen,
    "D4-01": FileText,
    "D4-02": PackageCheck,
    "D4-03": WalletCards,
    "D5-01": Bot,
    "D5-02": ShieldCheck,
  };

  return icons[code] ?? CheckCircle2;
}

function dayShortLabel(day: number) {
  if (day === 1) return "開工準備";
  if (day === 2) return "常見10問";
  if (day === 3) return "預約改期";
  if (day === 4) return "文件寄藥";
  return "AI + 主管";
}

function gameTileClass(card: BoardCard) {
  if (card.release === "red" || card.supervisor === "always") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (card.release === "yellow") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function releaseDotClass(card: BoardCard) {
  if (card.release === "red" || card.supervisor === "always") return "bg-rose-500";
  if (card.release === "yellow") return "bg-amber-400";
  return "bg-emerald-500";
}

function dayBadgeClass(day: number) {
  if (day === 1) return "border-emerald-200 bg-emerald-700 text-white";
  if (day === 2) return "border-cyan-200 bg-cyan-600 text-white";
  if (day === 3) return "border-orange-200 bg-orange-600 text-white";
  if (day === 4) return "border-lime-200 bg-emerald-600 text-white";
  return "border-teal-200 bg-teal-700 text-white";
}

function gameLaneClass(day: number) {
  if (day === 1) return "border-emerald-200 bg-emerald-50/70";
  if (day === 2) return "border-cyan-200 bg-cyan-50/70";
  if (day === 3) return "border-orange-200 bg-orange-50/70";
  if (day === 4) return "border-lime-200 bg-lime-50/70";
  return "border-teal-200 bg-teal-50/70";
}

function BoardGameTile({
  card,
  selected,
}: {
  card: BoardCard;
  selected: boolean;
}) {
  const TileIcon = tileIcon(card.code);
  const mustEscalate = card.release === "red" || card.supervisor === "always";

  return (
    <div className="relative z-10">
      <Link
        href={boardCardHref(card.code)}
        scroll={false}
        className={`group/tile relative flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-emerald-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${gameTileClass(card)} ${
          selected ? "border-emerald-600 ring-4 ring-emerald-100" : ""
        }`}
        aria-current={selected ? "step" : undefined}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold ${selected ? "text-emerald-800" : "text-slate-500"}`}>
          {card.code.slice(-2).replace(/^0/, "")}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="text-sm font-semibold leading-5">{tileShortLabel(card.code)}</span>
          <TileIcon className="h-5 w-5 shrink-0" />
        </span>
      </Link>
      {mustEscalate ? (
        <span className="absolute -right-1 -top-1 z-20 rounded-full bg-rose-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
          主管
        </span>
      ) : null}
    </div>
  );
}

function BoardGameLane({ day, selectedCode }: { day: BoardDay; selectedCode: string }) {
  return (
    <section className="rounded-lg border border-emerald-100 bg-white/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-950">今日 4 步</h2>
        <span className="text-xs font-semibold text-slate-400">逐格做</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {day.cards.map((card) => (
          <BoardGameTile key={card.code} card={card} selected={selectedCode === card.code} />
        ))}
      </div>
    </section>
  );
}

function LaterDaysPanel({
  days,
  selectedCode,
  selectedDay,
}: {
  days: BoardDay[];
  selectedCode: string;
  selectedDay: number;
}) {
  return (
    <details
      className="rounded-lg border border-slate-200 bg-white/80 p-3 shadow-sm"
      open={selectedDay > 1}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700">
        <span>Day 2-5</span>
        <span className="text-xs text-slate-400">之後先做</span>
      </summary>
      <div className="mt-3 divide-y divide-slate-100">
        {days.map((day) => (
          <div key={day.day} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-semibold text-slate-400">Day {day.day}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{dayShortLabel(day.day)}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {day.cards.map((card) => (
                <Link
                  key={card.code}
                  href={boardCardHref(card.code)}
                  scroll={false}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold transition-colors hover:border-emerald-300 hover:bg-emerald-50 ${
                    selectedCode === card.code
                      ? "border-emerald-400 text-emerald-900 ring-2 ring-emerald-100"
                      : "border-slate-200 text-slate-700"
                  }`}
                  aria-current={selectedCode === card.code ? "step" : undefined}
                >
                  <span className={`h-2 w-2 rounded-full ${releaseDotClass(card)}`} />
                  {tileShortLabel(card.code)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function ComponentBoardScene({
  selectedCard,
  selectedDay,
}: {
  selectedCard: BoardCard;
  selectedDay: number;
}) {
  const todayDays = boardDays.filter((day) => day.day === 1);
  const laterDays = boardDays.filter((day) => day.day !== 1);

  return (
    <div className="mx-auto max-w-4xl rounded-lg border border-emerald-100 bg-[#fbfaf2] p-4 shadow-sm sm:p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-white/80 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Day {selectedDay}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-emerald-950">
              而家做：{selectedCard.title}
            </h1>
          </div>
          <div className="sm:min-w-60">
            <NurseOnboardingSummary />
          </div>
        </div>

        <section
          id="selected-onboarding-card"
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400">{selectedCard.code}</p>
              <h2 className="mt-1 text-xl font-semibold leading-6 text-slate-950">
                {selectedCard.title}
              </h2>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-xs font-semibold ${releaseMeta[selectedCard.release].className}`}>
              {releaseMeta[selectedCard.release].label.split(" ")[0]}
            </span>
          </div>
          <NurseOnboardingProgress
            cardCode={selectedCard.code}
            day={selectedDay}
            release={selectedCard.release}
            supervisor={selectedCard.supervisor}
          />
          <CardDetails card={selectedCard} />
        </section>

        <div className="space-y-3">
          {todayDays.map((day) => (
            <BoardGameLane key={day.day} day={day} selectedCode={selectedCard.code} />
          ))}
          <LaterDaysPanel days={laterDays} selectedCode={selectedCard.code} selectedDay={selectedDay} />
        </div>

        <Link
          href="/nurse/knowledge"
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          查資料
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function NurseOnboardingPage({
  searchParams,
}: {
  searchParams?: {
    card?: string | string[];
  };
}) {
  const selected = getSelectedBoardCard(searchParams?.card);

  return (
    <div className="space-y-5">
      <ComponentBoardScene
        selectedCard={selected.card}
        selectedDay={selected.day}
      />

      <details
        id="supervisor-gates"
        className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">主管確認</h2>
          <span className="text-xs font-semibold text-slate-400">需要時打開</span>
        </summary>
        <div className="mt-4">
          <Link
            href="/nurse/knowledge/training"
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            去對答練習
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "安全收口句",
            "不保證保險",
            "不自行給醫療建議",
            "不講密碼 / OTP / 後台資料",
            "病人身份核對",
            "分單 / 收據基本流程",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              {item}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
