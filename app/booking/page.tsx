import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "預約入口 | 醫天圓",
  description: "選擇使用 AI 助手預約，或直接前往網上預約平台。",
};

export default function BookingPage() {
  const userAgent = headers().get("user-agent") ?? "";
  if (/\bCapacitor\b/i.test(userAgent)) {
    redirect("https://edentcm.as.me/schedule.php");
  }

  return (
    <main className="patient-pane text-slate-800">
      <div className="patient-card mx-auto max-w-xl space-y-6 p-6 sm:p-8">
        <div className="space-y-3">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
            醫天圓統一入口
          </p>
          <h1 className="text-2xl font-semibold text-primary sm:text-3xl">預約與 AI 諮詢</h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            你可以先用 AI 助手了解體質與覆診建議，再由對話流程完成預約；
            或直接前往網上預約平台查看最新時段。
          </p>
        </div>

        <div className="grid gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            進入 AI 諮詢（可導向預約）
          </Link>
          <a
            href="https://edentcm.as.me/schedule.php"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
          >
            直接前往預約平台
          </a>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 sm:text-sm">
          重要提示：時段及休假會不定期更新，最終以網上預約平台顯示為準。
        </div>
      </div>
    </main>
  );
}
