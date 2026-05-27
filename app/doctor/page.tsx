import Link from "next/link";
import {
  ArrowRight,
  Mic2,
  NotebookPen,
  Stethoscope,
  UsersRound,
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

const DOCTOR_ACTIONS: RoleHomeAction[] = [
  {
    title: "今日病人",
    subtitle: "睇名單、開病人紀錄、跟進覆診。",
    href: "/doctor/patients",
    icon: UsersRound,
    className: "border-cyan-200 bg-cyan-50 hover:border-cyan-300 hover:bg-cyan-100/70",
    iconClassName: "border-cyan-200 bg-white text-cyan-800",
  },
  {
    title: "語音記錄",
    subtitle: "看診後用廣東話記症狀和跟進。",
    href: "/doctor/record",
    icon: Mic2,
    className: "border-emerald-200 bg-emerald-50 hover:border-emerald-300 hover:bg-emerald-100/70",
    iconClassName: "border-emerald-200 bg-white text-emerald-800",
  },
  {
    title: "醫師手札",
    subtitle: "整理醫師筆記、案例和日常參考。",
    href: "/doctor/notebook",
    icon: NotebookPen,
    className: "border-amber-200 bg-amber-50 hover:border-amber-300 hover:bg-amber-100/70",
    iconClassName: "border-amber-200 bg-white text-amber-800",
  },
];

const DOCTOR_SYSTEM = [
  "先看今日病人，再開紀錄。",
  "看診後即時補語音或文字紀錄。",
  "覆診、醫囑和高風險內容要留痕。",
];

function RoleActionCard({ action }: { action: RoleHomeAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={`group flex min-h-32 items-start gap-4 rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100 ${action.className}`}
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

export default function DoctorHomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-cyan-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cyan-800">醫師工作入口</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
              醫師主頁
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              今日病人、紀錄、手札。
            </p>
          </div>
          <Link
            href="/doctor/patients"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-100"
          >
            開始看今日病人
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="today-patients" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DOCTOR_ACTIONS.map((action) => (
          <RoleActionCard key={action.href} action={action} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">今日制度</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {DOCTOR_SYSTEM.map((item, index) => (
              <div
                key={item}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="text-xs font-semibold text-cyan-800">Step {index + 1}</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Stethoscope className="h-4 w-4" />
            醫師主軸
          </div>
          <p className="mt-3 text-xl font-semibold leading-8 text-emerald-950">
            看診、紀錄、跟進。
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-900/80">
            先處理病人，再處理內容和設定。
          </p>
        </div>
      </section>
    </div>
  );
}
