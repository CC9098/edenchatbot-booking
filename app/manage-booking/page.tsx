import type { Metadata } from "next";
import Link from "next/link";

import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "管理預約 | 醫天圓",
  description: "透過 WhatsApp 驗證碼快速管理現有預約。",
};

function parseInitialManageAction(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === "reschedule" || normalized === "cancel") {
    return normalized;
  }

  return undefined;
}

export default function ManageBookingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const initialManageAction = parseInitialManageAction(searchParams?.action);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,80,22,0.08),_transparent_38%),linear-gradient(180deg,_#f6f4ed_0%,_#eef4ea_48%,_#f8fbf7_100%)] text-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-20 top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-10 pt-8 sm:px-10 sm:pt-10">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition hover:text-primary"
          >
            返回首頁
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/manage-booking?action=reschedule"
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                initialManageAction === "reschedule"
                  ? "border-primary bg-primary text-white"
                  : "border-primary/15 bg-white/80 text-primary hover:bg-primary-light"
              }`}
            >
              更改預約
            </Link>
            <Link
              href="/manage-booking?action=cancel"
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                initialManageAction === "cancel"
                  ? "border-primary bg-primary text-white"
                  : "border-primary/15 bg-white/80 text-primary hover:bg-primary-light"
              }`}
            >
              取消預約
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-full border border-primary/15 bg-white/80 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-light"
            >
              會員登入
            </Link>
          </div>
        </div>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <section className="order-2 max-w-2xl space-y-6 lg:order-1">
            <div className="inline-flex items-center rounded-full border border-primary/10 bg-white/70 px-4 py-1.5 text-sm font-medium tracking-wide text-primary shadow-sm backdrop-blur">
              預約管理中心
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-primary sm:text-6xl">
                直接在對話中完成
                <span className="block text-slate-900">更改或取消預約</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                病人只需要在右側對話輸入預約時使用的 WhatsApp 電話號碼，系統會發送 6 位數驗證碼，再一步步帶你完成更改或取消。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Step 1</p>
                <p className="mt-2 text-sm font-medium text-slate-800">在對話中輸入 WhatsApp 電話</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Step 2</p>
                <p className="mt-2 text-sm font-medium text-slate-800">收取 6 位數驗證碼</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Step 3</p>
                <p className="mt-2 text-sm font-medium text-slate-800">揀預約後即時更改或取消</p>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-white/70 px-5 py-4 text-sm leading-relaxed text-slate-600 shadow-sm backdrop-blur">
              如距離應診時間少於 1 小時，對話會直接引導你 WhatsApp 聯絡姑娘。
            </div>
          </section>

          <section className="order-1 flex min-h-[560px] items-stretch justify-center lg:order-2">
            <ChatWidget
              autoOpen
              initialIntent="manage-booking"
              initialManageAction={initialManageAction}
              layout="page"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
