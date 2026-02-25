import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { isNativeAppUserAgent } from "@/lib/platform";
import { NARRATIVE } from "@/lib/narrative-copy";

export const metadata: Metadata = {
  title: "預約服務 | 醫天圓",
  description: "Web 與 App 版本分流的預約服務入口。",
};

export default function BookingPage() {
  const isNativeApp = isNativeAppUserAgent(headers().get("user-agent"));

  // Native app keeps the in-app flow; web keeps the regular web booking entrance.
  if (isNativeApp) {
    return (
      <main className="patient-pane text-slate-800">
        <BookingTabFlow />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-primary-pale px-6 py-12 text-slate-800 sm:px-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-primary sm:text-3xl">預約服務</h1>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-500">
            「{NARRATIVE.bookingQuote}」
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base">
            {NARRATIVE.webBookingDescription}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            問問 AI 體質顧問
          </Link>
          <a
            href="https://edentcm.as.me/schedule.php"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-primary/20 bg-white px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary-light"
          >
            直接前往預約平台
          </a>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 sm:text-sm">
          重要提示：時段及休假會不定期更新，最終以網上預約平台顯示為準。
        </div>
      </div>
    </main>
  );
}
