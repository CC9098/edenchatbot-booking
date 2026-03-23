import type { Metadata } from "next";
import Link from "next/link";

import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "管理預約 | 醫天圓",
  description: "透過 WhatsApp 驗證碼快速管理現有預約。",
};

export default function ManageBookingPage() {
  return (
    <main className="relative min-h-screen bg-primary-pale text-slate-800">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pb-28 pt-16 sm:px-10 sm:pb-32 sm:pt-20">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition hover:text-primary"
          >
            返回首頁
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-light"
          >
            會員登入
          </Link>
        </div>

        <section className="rounded-[32px] border border-primary/10 bg-white/90 p-8 shadow-sm sm:p-12">
          <div className="max-w-3xl space-y-5">
            <p className="text-sm font-medium tracking-wide text-primary">
              預約管理中心
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-primary sm:text-5xl">
              用 WhatsApp 驗證碼管理預約
            </h1>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
              不用先建立帳戶。輸入預約時使用的 WhatsApp 電話號碼，收到 6 位數驗證碼後，即可更改或取消未來預約。
            </p>
            <div className="grid gap-3 rounded-2xl bg-primary-pale p-5 text-sm text-slate-700 sm:grid-cols-3">
              <div>1. 輸入 WhatsApp 電話</div>
              <div>2. 收取 6 位數驗證碼</div>
              <div>3. 選擇要更改或取消的預約</div>
            </div>
            <p className="text-sm text-slate-500">
              如距離應診時間少於 1 小時，系統會直接引導你 WhatsApp 聯絡姑娘。
            </p>
          </div>
        </section>
      </div>
      <ChatWidget autoOpen initialIntent="manage-booking" />
    </main>
  );
}
