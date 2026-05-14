import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  MessageCircle,
  ClipboardCheck,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";

type RoleHomeAction = {
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  className: string;
  iconClassName: string;
};

const NURSE_ACTIONS: RoleHomeAction[] = [
  {
    title: "今日預約",
    subtitle: "睇今日到診、待處理、改期和取消。",
    href: "/nurse/operations",
    icon: ClipboardList,
    className: "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100/70",
    iconClassName: "border-cyan-200 bg-white text-cyan-800",
  },
  {
    title: "幫病人預約",
    subtitle: "代病人落單，先核對電話和醫師。",
    href: "/nurse/booking",
    icon: UserRoundPlus,
    className: "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100/70",
    iconClassName: "border-emerald-200 bg-white text-emerald-800",
  },
  {
    title: "新姑娘上手",
    subtitle: "第一日照住做，唔肯定先收口。",
    href: "/nurse/onboarding",
    icon: GraduationCap,
    className: "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
    iconClassName: "border-amber-200 bg-white text-amber-800",
  },
  {
    title: "姑娘小測驗",
    subtitle: "6 題測安全收口、預約和主管升級。",
    href: "/nurse/quiz",
    icon: ClipboardCheck,
    className: "border-rose-200 bg-rose-50 hover:border-rose-300 hover:bg-rose-100/70",
    iconClassName: "border-rose-200 bg-white text-rose-800",
  },
  {
    title: "查 SOP / 問 AI",
    subtitle: "查分單、寄藥、醫療券和常見查詢。",
    href: "/nurse/knowledge",
    icon: BookOpenCheck,
    className: "border-teal-200 bg-teal-50 hover:border-teal-300 hover:bg-teal-100/70",
    iconClassName: "border-teal-200 bg-white text-teal-800",
  },
  {
    title: "時間表 / 放假",
    subtitle: "檢查醫師出診、休息和可約時段。",
    href: "/nurse/timetable",
    icon: CalendarDays,
    className: "border-lime-200 bg-lime-50 hover:border-lime-300 hover:bg-lime-100/70",
    iconClassName: "border-lime-200 bg-white text-lime-800",
  },
  {
    title: "客服 Widget",
    subtitle: "處理網站客服入口和回覆設定。",
    href: "/nurse/widget-chatbot",
    icon: MessageCircle,
    className: "border-sky-200 bg-sky-50 hover:border-sky-300 hover:bg-sky-100/70",
    iconClassName: "border-sky-200 bg-white text-sky-800",
  },
];

const NURSE_SYSTEM = [
  "先核對姓名、電話、醫師和時間。",
  "不肯定就記低資料，不即場估。",
  "改期、退款、保險、密碼一律按主管流程。",
];

function RoleActionCard({ action }: { action: RoleHomeAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={`group flex min-h-32 items-start gap-4 rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${action.className}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border shadow-sm ${action.iconClassName}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold tracking-normal text-slate-950">
          {action.title}
        </span>
        <span className="mt-2 block text-sm leading-6 text-slate-600">
          {action.subtitle}
        </span>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          進入
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

export default function NurseHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-emerald-800">姑娘工作入口</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              姑娘主頁
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              今日先處理預約、接待、查詢。唔肯定就停低問人。
            </p>
          </div>
          <Link
            href="/nurse/operations"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            開始處理今日預約
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {NURSE_ACTIONS.map((action) => (
          <RoleActionCard key={action.href} action={action} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">今日制度</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {NURSE_SYSTEM.map((item, index) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="text-xs font-semibold text-emerald-800">Step {index + 1}</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-teal-100 bg-teal-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
            <ClipboardList className="h-4 w-4" />
            姑娘主軸
          </div>
          <p className="mt-3 text-xl font-semibold leading-8 text-teal-950">
            接待、預約、查詢、升級。
          </p>
          <p className="mt-2 text-sm leading-6 text-teal-900/80">
            先做前台流程，再查 SOP 或問 AI。
          </p>
        </div>
      </section>
    </div>
  );
}
