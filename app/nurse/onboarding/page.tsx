import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
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
  UserCheck,
  Users,
  WalletCards,
  XCircle,
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

const overlayBoardSpots = [
  { code: "D1-01", day: 1, left: "22.4%", top: "18.5%", width: "7.4%" },
  { code: "D1-02", day: 1, left: "31.5%", top: "17.2%", width: "7.5%" },
  { code: "D1-03", day: 1, left: "40.5%", top: "17.1%", width: "7.7%" },
  { code: "D1-04", day: 1, left: "49.6%", top: "17.2%", width: "7.6%" },
  { code: "D2-01", day: 2, left: "20.4%", top: "37.3%", width: "8.3%" },
  { code: "D2-02", day: 2, left: "31.3%", top: "36.2%", width: "8.3%" },
  { code: "D3-01", day: 3, left: "24.3%", top: "54.0%", width: "8.4%" },
  { code: "D3-02", day: 3, left: "35.1%", top: "52.5%", width: "8.5%" },
  { code: "D4-01", day: 4, left: "31.3%", top: "69.0%", width: "8.4%" },
  { code: "D4-02", day: 4, left: "42.6%", top: "68.0%", width: "8.2%" },
  { code: "D4-03", day: 4, left: "53.7%", top: "67.6%", width: "8.0%" },
  { code: "D5-01", day: 5, left: "42.5%", top: "84.0%", width: "8.0%" },
  { code: "D5-02", day: 5, left: "52.5%", top: "83.3%", width: "8.0%" },
];

const overlayRailSpots = [
  { code: "D1-02", title: "今日必學", command: "學收口", left: "79.9%", top: "16.8%", width: "15.2%" },
  { code: "D4-03", title: "不可亂答", command: "密碼交主管", left: "79.9%", top: "45.0%", width: "15.2%" },
  { code: "D5-01", title: "問 AI 主任", command: "先問五項", left: "79.9%", top: "73.5%", width: "15.2%" },
];

const overlayDayLabels = [
  { day: 1, label: "開工", left: "58.8%", top: "11.8%", tone: "border-emerald-200 bg-emerald-700 text-white" },
  { day: 2, label: "10問", left: "6.7%", top: "35.0%", tone: "border-cyan-200 bg-cyan-600 text-white" },
  { day: 3, label: "預約", left: "6.7%", top: "52.6%", tone: "border-orange-200 bg-orange-600 text-white" },
  { day: 4, label: "文件", left: "6.7%", top: "68.4%", tone: "border-lime-200 bg-emerald-600 text-white" },
  { day: 5, label: "放行", left: "6.7%", top: "83.0%", tone: "border-teal-200 bg-teal-700 text-white" },
];

const boardCardByCode = new Map<string, BoardCard>(
  boardDays.flatMap((day) => day.cards.map((card) => [card.code, card] as const)),
);

function getBoardCard(code: string) {
  const card = boardCardByCode.get(code);
  if (!card) throw new Error(`Missing onboarding card ${code}`);
  return card;
}

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
  const meta = releaseMeta[card.release];
  const ReleaseIcon = meta.icon;

  return (
    <div className="mt-3 grid gap-2">
      <InfoLine icon={Clock3} label="估計時間">
        {card.minutes}
      </InfoLine>
      <div className={`rounded-md border p-3 ${meta.className}`}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ReleaseIcon className="h-3.5 w-3.5" />
          放行狀態
        </div>
        <p className="mt-1 text-sm leading-6">{meta.label}</p>
      </div>
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

function tileShortLabel(code: string) {
  const labels: Record<string, string> = {
    "D1-01": "路線",
    "D1-02": "收口",
    "D1-03": "開診",
    "D1-04": "入門",
    "D2-01": "10問",
    "D2-02": "抽問",
    "D3-01": "查時段",
    "D3-02": "改取消",
    "D4-01": "收據",
    "D4-02": "寄藥",
    "D4-03": "密碼",
    "D5-01": "AI格式",
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

function overlayButtonClass(card: BoardCard) {
  if (card.release === "red" || card.supervisor === "always") {
    return "border-rose-200 bg-white/95 text-rose-800 hover:bg-rose-50";
  }
  if (card.release === "yellow") {
    return "border-amber-200 bg-white/95 text-amber-900 hover:bg-amber-50";
  }
  return "border-emerald-200 bg-white/95 text-emerald-900 hover:bg-emerald-50";
}

function releaseDotClass(card: BoardCard) {
  if (card.release === "red" || card.supervisor === "always") return "bg-rose-500";
  if (card.release === "yellow") return "bg-amber-400";
  return "bg-emerald-500";
}

function OverlayTile({
  code,
  day,
  left,
  top,
  width,
}: {
  code: string;
  day: number;
  left: string;
  top: string;
  width: string;
}) {
  const card = getBoardCard(code);
  const TileIcon = tileIcon(code);
  const popupAlign = Number.parseFloat(left) > 58 ? "right-0" : "left-0";

  return (
    <details
      className="absolute z-20"
      style={{ left, top, width }}
    >
      <summary className={`flex aspect-square cursor-pointer list-none flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-xl ${overlayButtonClass(card)}`}>
        <TileIcon className="h-5 w-5" />
        <span className="mt-1 text-[11px] font-semibold leading-4">{tileShortLabel(code)}</span>
        <span className={`mt-1.5 h-1.5 w-8 rounded-full ${releaseDotClass(card)}`} />
      </summary>
      <div className={`absolute ${popupAlign} top-full z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xl`}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-slate-950">{card.title}</div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${releaseMeta[card.release].className}`}>
            {releaseMeta[card.release].label.split(" ")[0]}
          </span>
        </div>
        <NurseOnboardingProgress
          cardCode={code}
          day={day}
          release={card.release}
          supervisor={card.supervisor}
        />
        <CardDetails card={card} />
      </div>
    </details>
  );
}

function OverlayRailTile({
  code,
  title,
  command,
  left,
  top,
  width,
}: {
  code: string;
  title: string;
  command: string;
  left: string;
  top: string;
  width: string;
}) {
  const card = getBoardCard(code);

  return (
    <details className="absolute z-20" style={{ left, top, width }}>
      <summary className={`flex min-h-24 cursor-pointer list-none flex-col justify-center rounded-2xl border px-3 py-3 shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-xl ${overlayButtonClass(card)}`}>
        <span className="text-xs font-semibold opacity-80">{title}</span>
        <span className="mt-1 text-base font-semibold leading-5">{command}</span>
        <span className={`mt-3 h-1.5 w-10 rounded-full ${releaseDotClass(card)}`} />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xl">
        <div className="text-sm font-semibold text-slate-950">{card.title}</div>
        <NurseOnboardingProgress
          cardCode={code}
          day={Number(code.slice(1, 2))}
          release={card.release}
          supervisor={card.supervisor}
        />
        <CardDetails card={card} />
      </div>
    </details>
  );
}

function IllustratedOverlayBoard() {
  return (
    <div className="relative rounded-[28px] border border-emerald-100 bg-[#fbfaf2] shadow-sm">
      <img
        src="/nurse-onboarding-board.png"
        alt="新姑娘上手棋盤插畫背景"
        className="block w-full select-none rounded-[28px]"
      />
      <div className="absolute left-[14%] top-[5.2%] z-10 rounded-2xl bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm">
        <p className="text-sm font-semibold text-emerald-700">新姑娘上手棋盤</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal text-emerald-900">
          今日新姑娘路線
        </h1>
      </div>
      <div className="absolute left-[4.8%] top-[19.2%] z-10 flex h-[10%] w-[9.6%] items-center justify-center rounded-full border border-emerald-200 bg-white/85 text-sm font-bold text-emerald-800 shadow-lg backdrop-blur-sm">
        START
      </div>
      <div className="absolute left-[66.8%] top-[82.4%] z-10 flex h-[11.5%] w-[7.2%] items-center justify-center rounded-full border border-teal-200 bg-emerald-700/90 text-sm font-bold text-white shadow-lg backdrop-blur-sm">
        FINISH
      </div>
      {overlayDayLabels.map((item) => (
        <div
          key={item.day}
          className={`absolute z-10 flex h-[7.2%] w-[8.2%] items-center justify-center rounded-full border text-center text-xs font-bold leading-4 shadow-lg ring-4 ring-white/75 ${item.tone}`}
          style={{ left: item.left, top: item.top }}
        >
          <span>
            Day {item.day}
            <br />
            {item.label}
          </span>
        </div>
      ))}
      {overlayBoardSpots.map((spot) => (
        <OverlayTile key={spot.code} {...spot} />
      ))}
      {overlayRailSpots.map((spot) => (
        <OverlayRailTile key={spot.code} {...spot} />
      ))}
      <div className="absolute bottom-[3.2%] left-[18%] z-20 flex items-center gap-3 rounded-full border border-emerald-100 bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Green
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Yellow
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          Red
        </span>
      </div>
      <Link
        href="/nurse/knowledge"
        className="absolute bottom-[3.2%] left-[38.8%] z-20 rounded-full border border-emerald-200 bg-white/85 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm backdrop-blur-sm hover:bg-emerald-50"
      >
        完整知識庫
      </Link>
    </div>
  );
}

function BoardTile({ card, day, isToday }: { card: BoardCard; day: number; isToday: boolean }) {
  const mustEscalate = card.release === "red" || card.supervisor === "always";
  const TileIcon = tileIcon(card.code);

  return (
    <details
      className={`group rounded-xl border p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isToday ? "border-emerald-200 bg-white/95" : "border-slate-200 bg-white/75"
      }`}
    >
      <summary className="relative flex min-h-28 cursor-pointer list-none flex-col items-center justify-center gap-2 text-center">
        <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
          {card.code}
        </span>
        <ChevronDown className="absolute right-1.5 top-1.5 h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        <div className="flex min-w-0 flex-col items-center gap-2">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
              mustEscalate
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : card.release === "yellow"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            <TileIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-5 text-slate-950">
              {tileShortLabel(card.code)}
            </h3>
            <NurseOnboardingProgress
              cardCode={card.code}
              day={day}
              release={card.release}
              supervisor={card.supervisor}
            />
          </div>
        </div>
      </summary>

      <CardDetails card={card} />
    </details>
  );
}

function RailCard({
  title,
  icon: Icon,
  card,
  command,
  tone,
}: {
  title: string;
  icon: typeof ClipboardCheck;
  card: BoardCard;
  command: string;
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
          <p className="mt-2 text-lg font-semibold leading-6 text-slate-950">{command}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <CardDetails card={card} />
    </details>
  );
}

function boardRowClass(day: number) {
  if (day === 1) return "border-emerald-300 bg-emerald-50/90 shadow-[inset_0_-3px_0_rgba(74,123,82,0.15)]";
  if (day === 2) return "border-cyan-200 bg-cyan-50/75 shadow-[inset_0_-3px_0_rgba(8,145,178,0.12)]";
  if (day === 3) return "border-orange-200 bg-orange-50/75 shadow-[inset_0_-3px_0_rgba(234,88,12,0.12)]";
  if (day === 4) return "border-lime-200 bg-lime-50/75 shadow-[inset_0_-3px_0_rgba(77,124,15,0.12)]";
  return "border-teal-200 bg-teal-50/75 shadow-[inset_0_-3px_0_rgba(13,148,136,0.12)]";
}

export default function NurseOnboardingPage() {
  const totalCards = boardDays.reduce((count, day) => count + day.cards.length, 0);
  const todayMustLearn = boardDays[0].cards[1];
  const doNotGuess = boardDays[3].cards[2];
  const askAiSupervisor = boardDays[4].cards[0];

  return (
    <div className="space-y-5">
      <section className="hidden xl:block">
        <IllustratedOverlayBoard />
      </section>

      <section className="grid gap-4 xl:hidden">
        <div className="overflow-hidden rounded-[26px] border border-emerald-100 bg-[#fbfaf2] p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">新姑娘上手路線</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                今日新姑娘路線
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                今日只行 Day 1 四格。細節點開先睇。
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

          <div className="mt-5 rounded-[24px] border border-emerald-100 bg-white/55 p-3 shadow-inner">
            <div className="space-y-3">
            {boardDays.map((day) => {
              const isToday = day.day === 1;
              return (
                <div
                  key={day.day}
                  className={`grid gap-3 rounded-[24px] border p-3 ${
                    isToday ? "shadow-sm" : ""
                  } ${boardRowClass(day.day)} lg:grid-cols-[180px_minmax(0,1fr)]`}
                >
                  <div className="flex items-start gap-3 lg:block">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ring-4 ring-white/80 ${
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
                      <h2 className="text-base font-semibold leading-5 text-slate-950">
                        {dayShortLabel(day.day)}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {isToday ? "今日必行" : "之後再開"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {day.cards.map((card) => (
                      <BoardTile key={card.code} card={card} day={day.day} isToday={isToday} />
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <RailCard
            title="今日必學"
            icon={ClipboardCheck}
            card={todayMustLearn}
            command="學收口"
            tone="border-emerald-200 bg-emerald-50"
          />
          <RailCard
            title="不可亂答"
            icon={ShieldAlert}
            card={doNotGuess}
            command="密碼交主管"
            tone="border-rose-200 bg-rose-50"
          />
          <RailCard
            title="問 AI 主任"
            icon={Bot}
            card={askAiSupervisor}
            command="先問五項"
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
