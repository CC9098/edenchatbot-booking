import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  ClipboardCheck,
  Flag,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
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
        title: "今日只行這條路",
        minutes: "2 分鐘",
        task: "打開棋盤，指出今日下一格，知道完整知識庫只是後備查資料。",
        canSay: "今日我先跟住 onboarding path 做，不確定的我會先問主管或 AI 主任。",
        cannotSay: "我第一日已經要自己讀完整手冊。",
        aiPrompt: "新姑娘第一日應該先行哪幾步？",
        supervisor: "no",
        passCondition: "能指出今日下一格，不被完整知識庫嚇住。",
        release: "green",
      },
      {
        code: "D1-02",
        title: "安全收口句",
        minutes: "5 分鐘",
        task: "遇到醫療、收費、保險、密碼、投訴，先收口，再記低問題和聯絡資料。",
        canSay: "我先幫您確認清楚，再 WhatsApp 回覆您。",
        cannotSay: "一定 claim 到、醫師一定會加位、密碼係...",
        aiPrompt: "病人問的問題我不肯定，可以怎樣安全收口？",
        supervisor: "yes",
        passCondition: "能自然講出安全收口句，並分辨不可即答問題。",
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
        task: "禮貌招呼，核對姓名、電話、預約時間、醫師；身份不清就查紀錄。",
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
        title: "抽 3 問 Pass Gate",
        minutes: "6 分鐘",
        task: "Trainer 抽 3 題，新人先安全回覆，再講要收集甚麼、不可承諾甚麼。",
        canSay: "我先核對資料，再按診所流程回覆您。",
        cannotSay: "無查紀錄就即口答。",
        aiPrompt: "請扮病人抽問我三條前台常見問題。",
        supervisor: "yes",
        passCondition: "3 題至少 2 題 Green，不可有 Red。",
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
        passCondition: "不在 AI 主任或病人對話洩漏密碼、OTP、銀行或後台憑證。",
        release: "red",
      },
    ],
  },
  {
    day: 5,
    title: "AI 主任保底 + 真人主管放行",
    goal: "識用 AI 主任保底、識升級、識留下待補 SOP。",
    independence: "Role-play 後可做半日 supervised shift。",
    cards: [
      {
        code: "D5-01",
        title: "AI 主任回答格式",
        minutes: "6 分鐘",
        task: "每次問 AI 主任，都要看：可對病人講、先查、風險、是否問主管、來源。",
        canSay: "我先幫您按紀錄核對，再用診所流程確認下一步。",
        cannotSay: "AI 話得就一定得。",
        aiPrompt: "請用可以對病人講、先查、風險、是否要問主管、來源五項回答。",
        supervisor: "no",
        passCondition: "能用 AI 主任做初步判斷，但不把 AI 當最終批准。",
        release: "green",
      },
      {
        code: "D5-02",
        title: "真人主管放行",
        minutes: "10 分鐘",
        task: "完成 Green / Yellow / Red 評級；Red 不可獨立，Yellow 要旁聽或抽查。",
        canSay: "這個情況我先交主管確認，確認後再回覆您。",
        cannotSay: "我未通過都可以自己處理高風險問題。",
        aiPrompt: "請幫我用 Green / Yellow / Red 評估這段病人回覆。",
        supervisor: "yes",
        passCondition: "必須安全收口、不保證保險、不給醫療建議、不講 restricted 資料。",
        release: "green",
      },
    ],
  },
];

const releaseMeta: Record<ReleaseLevel, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  green: {
    label: "Green 可處理",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  yellow: {
    label: "Yellow 要抽查",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: CircleAlert,
  },
  red: {
    label: "Red 不可獨立",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
};

function aiChatHref(prompt: string) {
  return `/nurse/knowledge/chat?prompt=${encodeURIComponent(prompt)}`;
}

function supervisorLabel(value: SupervisorNeed) {
  if (value === "always") return "主管：必須";
  if (value === "yes") return "主管：視情況";
  return "主管：暫不用";
}

function supervisorClass(value: SupervisorNeed) {
  if (value === "always") return "border-rose-200 bg-rose-50 text-rose-800";
  if (value === "yes") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function InfoLine({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  children: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
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
    <div className="mt-3 grid gap-2">
      <InfoLine icon={ClipboardCheck} label="要做咩">
        {card.task}
      </InfoLine>
      <InfoLine icon={MessageCircle} label="可以講">
        {card.canSay}
      </InfoLine>
      <InfoLine icon={AlertTriangle} label="不可以講">
        {card.cannotSay}
      </InfoLine>
      <div
        className={`rounded-md border p-3 ${
          mustEscalate
            ? "border-rose-200 bg-rose-50"
            : "border-cyan-200 bg-cyan-50"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-xs font-semibold ${
            mustEscalate ? "text-rose-800" : "text-cyan-800"
          }`}
        >
          {mustEscalate ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <Bot className="h-3.5 w-3.5" />
          )}
          {mustEscalate ? "先交主管" : "問 AI 主任"}
        </div>
        <p className={`mt-1 text-sm leading-6 ${mustEscalate ? "text-rose-950" : "text-cyan-950"}`}>
          {mustEscalate
            ? "這格屬高風險，不可由新人或 AI 主任作最後決定。先交真人主管，再用 AI 主任整理要問甚麼。"
            : card.aiPrompt}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {mustEscalate ? (
            <a
              href="#supervisor-gates"
              className="inline-flex items-center gap-2 rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800"
            >
              交主管確認
              <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
          <Link
            href={aiChatHref(card.aiPrompt)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
              mustEscalate
                ? "border border-rose-200 bg-white text-rose-800 hover:bg-rose-50"
                : "bg-emerald-700 text-white hover:bg-emerald-800"
            }`}
          >
            {mustEscalate ? "用 AI 整理問題" : "問 AI 主任"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <InfoLine icon={Users} label="是否要主管">
        {supervisorLabel(card.supervisor)}
      </InfoLine>
      <InfoLine icon={Flag} label="過關條件">
        {card.passCondition}
      </InfoLine>
    </div>
  );
}

function BoardTile({ card, day, isToday }: { card: BoardCard; day: number; isToday: boolean }) {
  const meta = releaseMeta[card.release];
  const ReleaseIcon = meta.icon;

  return (
    <details
      className={`group rounded-lg border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isToday ? "border-emerald-200 bg-white" : "border-slate-200 bg-white/70"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {card.code}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>
              <ReleaseIcon className="h-3.5 w-3.5" />
              {meta.label}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-950">{card.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {card.minutes}
            </span>
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${supervisorClass(card.supervisor)}`}>
              {supervisorLabel(card.supervisor)}
            </span>
          </div>
          <NurseOnboardingProgress
            cardCode={card.code}
            day={day}
            release={card.release}
            supervisor={card.supervisor}
          />
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
      </summary>

      <CardDetails card={card} />
    </details>
  );
}

function RailCard({
  title,
  icon: Icon,
  card,
  tone,
}: {
  title: string;
  icon: typeof ClipboardCheck;
  card: BoardCard;
  tone: string;
}) {
  return (
    <details className={`group rounded-lg border p-4 shadow-sm ${tone}`}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Icon className="h-4 w-4 text-emerald-700" />
            {title}
          </div>
          <p className="mt-2 text-sm leading-5 text-slate-700">{card.title}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <CardDetails card={card} />
    </details>
  );
}

function boardRowClass(day: number) {
  if (day === 1) return "border-emerald-300 bg-emerald-50/90";
  if (day === 2) return "border-cyan-200 bg-cyan-50/70";
  if (day === 3) return "border-orange-200 bg-orange-50/70";
  if (day === 4) return "border-lime-200 bg-lime-50/70";
  return "border-teal-200 bg-teal-50/70";
}

export default function NurseOnboardingPage() {
  const totalCards = boardDays.reduce((count, day) => count + day.cards.length, 0);
  const todayMustLearn = boardDays[0].cards[1];
  const doNotGuess = boardDays[3].cards[2];
  const askAiSupervisor = boardDays[4].cards[0];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">新姑娘上手路線</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                今日新姑娘路線
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Day 1 先行，其他只是預覽。打開每格才看 SOP 細節，不需要一開工就面對整本手冊。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">
                <div className="text-xs font-semibold text-emerald-700">今日</div>
                <div className="mt-1 font-semibold text-slate-950">Day 1</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-xs font-semibold text-slate-500">總格數</div>
                <div className="mt-1 font-semibold text-slate-950">{totalCards} 格</div>
              </div>
              <NurseOnboardingSummary />
              <Link
                href="/nurse/knowledge"
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 sm:col-span-3"
              >
                <BookOpenCheck className="h-4 w-4" />
                知識庫
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {boardDays.map((day) => {
              const isToday = day.day === 1;
              return (
                <div
                  key={day.day}
                  className={`grid gap-3 rounded-lg border p-3 ${
                    isToday ? "shadow-sm" : ""
                  } ${boardRowClass(day.day)} lg:grid-cols-[180px_minmax(0,1fr)]`}
                >
                  <div className="flex items-start gap-3 lg:block">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                        isToday ? "bg-emerald-700 text-white" : "bg-white text-slate-600"
                      }`}
                    >
                      Day {day.day}
                    </div>
                    <div className="min-w-0 lg:mt-3">
                      {day.day === 1 ? (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800">
                          <Flag className="h-3.5 w-3.5" />
                          Start here
                        </div>
                      ) : null}
                      {day.day === 5 ? (
                        <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-2 py-1 text-xs font-semibold text-teal-800">
                          <UserCheck className="h-3.5 w-3.5" />
                          Finish
                        </div>
                      ) : null}
                      <div
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                          isToday ? "bg-emerald-700 text-white" : "bg-white text-slate-500"
                        }`}
                      >
                        Day {day.day}
                      </div>
                      <h2 className="mt-2 text-sm font-semibold leading-5 text-slate-950">
                        {day.title}
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{day.goal}</p>
                      <p className="mt-2 rounded-md border border-white/80 bg-white/80 px-2 py-1.5 text-xs leading-5 text-slate-600">
                        {day.independence}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {day.cards.map((card) => (
                      <BoardTile key={card.code} card={card} day={day.day} isToday={isToday} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="space-y-3">
          <RailCard
            title="今日必學"
            icon={ClipboardCheck}
            card={todayMustLearn}
            tone="border-emerald-200 bg-emerald-50"
          />
          <RailCard
            title="不可亂答"
            icon={ShieldAlert}
            card={doNotGuess}
            tone="border-rose-200 bg-rose-50"
          />
          <RailCard
            title="問 AI 主任"
            icon={Bot}
            card={askAiSupervisor}
            tone="border-cyan-200 bg-cyan-50"
          />
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              放行信號
            </div>
            <div className="mt-3 grid gap-2">
              {Object.entries(releaseMeta).map(([key, item]) => {
                const Icon = item.icon;
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${item.className}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <p className="mt-0.5 text-xs leading-5">
                        {key === "green"
                          ? "普通情況可處理。"
                          : key === "yellow"
                            ? "可旁聽或主管抽查。"
                            : "不可獨立，必須升級。"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>

      <section
        id="supervisor-gates"
        className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">真人主管放行</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">必須 Green 的關卡</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              完成所有格不等於立即獨立；以下幾項未 Green，就繼續旁聽或由主管抽查。
            </p>
          </div>
          <Link
            href="/nurse/knowledge/training"
            className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            去 Role-play Test
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
              className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
