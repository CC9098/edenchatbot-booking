import ChatWidget from '@/components/ChatWidget';
import Link from 'next/link';
import { createServerClient } from "@/lib/supabase-server";
import { isNativeAppUserAgent } from "@/lib/platform";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const userAgent = headers().get("user-agent") ?? "";
  if (isNativeAppUserAgent(userAgent)) {
    redirect("/chat");
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/chat");
  }

  return (
    <main className="relative min-h-screen bg-primary-pale text-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-20">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="https://edenclinic.hk"
            className="text-sm font-medium text-slate-500 transition hover:text-primary"
          >
            edenclinic.hk
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-light"
            >
              登入
            </Link>
            <Link
              href="/doctor"
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white/80 hover:text-primary"
            >
              醫師入口
            </Link>
          </div>
        </div>

        <section className="rounded-[32px] border border-primary/10 bg-white/90 p-8 shadow-sm sm:p-12">
          <div className="max-w-4xl space-y-6">
            <p className="text-sm font-medium tracking-wide text-primary">
              醫天圓病人服務平台
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-primary sm:text-6xl">
              體質諮詢與預約服務
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              由了解自己開始，安排合適的調理與門診服務。體質諮詢、網上預約、預約管理與診後跟進，都可在此完成。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover"
              >
                開始體質諮詢
              </Link>
              <Link
                href="/booking"
                className="inline-flex min-h-11 items-center rounded-xl border border-primary/20 bg-white px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary-light"
              >
                預約服務
              </Link>
            </div>
            <p className="text-sm text-slate-500">
              已有帳號？
              {' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                登入後繼續使用
              </Link>
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-primary/10 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">體質諮詢</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              先整理目前狀態，了解調理方向，再決定下一步安排。
            </p>
            <Link href="/chat" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              開始體質諮詢
            </Link>
          </article>

          <article className="rounded-2xl border border-primary/10 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">預約服務</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              直接選擇醫師、診所與時段，完成預約安排。
            </p>
            <Link href="/booking" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              前往預約
            </Link>
          </article>

          <article className="rounded-2xl border border-primary/10 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">預約管理</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              已預約者可登入後繼續使用；如需改期或取消，請使用確認電郵內的連結。
            </p>
            <Link href="/login" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              登入帳號
            </Link>
          </article>
        </section>

        <section className="space-y-4 rounded-[28px] border border-primary/10 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">三大體質傾向</p>
            <h2 className="text-2xl font-semibold text-primary">由體質了解開始</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl bg-primary-pale p-5">
              <h3 className="text-lg font-semibold text-slate-900">虛耗型</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                重點在回補與休養，先讓身體慢慢回氣。
              </p>
            </article>

            <article className="rounded-2xl bg-primary-pale p-5">
              <h3 className="text-lg font-semibold text-slate-900">交錯型</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                重點在平衡與調節，梳理壓力、作息與身體反應。
              </p>
            </article>

            <article className="rounded-2xl bg-primary-pale p-5">
              <h3 className="text-lg font-semibold text-slate-900">屯積型</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                重點在疏導與代謝，讓日常調理更有方向。
              </p>
            </article>
          </div>
        </section>
      </div>
      <ChatWidget />
    </main>
  );
}
