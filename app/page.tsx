import ChatWidget from '@/components/ChatWidget';
import Image from 'next/image';
import Link from 'next/link';
import { createServerClient } from "@/lib/supabase-server";
import { isNativeAppUserAgent } from "@/lib/platform";
import { DOCTORS } from "@/shared/clinic-data";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

const HOME_HERO_DOCTORS = DOCTORS.filter((doctor) => doctor.avatarSrc);

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
      <section className="relative isolate min-h-[760px] overflow-hidden bg-white">
        <div className="absolute -inset-6">
          <Image
            src="/images/edenclinic-homepage-bg.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover object-top opacity-90 blur-lg"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-primary-pale/90 lg:bg-gradient-to-r lg:from-white/95 lg:via-white/70 lg:to-white/35" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_42%,rgba(255,255,255,0.26),transparent_34%)]" />

        <div className="relative z-10 mx-auto flex min-h-[760px] max-w-6xl flex-col px-6 pb-16 pt-8 sm:px-10 sm:pb-20">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="https://edenclinic.hk"
              className="text-sm font-medium text-slate-600 transition hover:text-primary"
            >
              edenclinic.hk
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg border border-primary/20 bg-white/90 px-3 py-1.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary-light"
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

          <div className="grid flex-1 items-center gap-7 py-12 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-12 lg:py-16 xl:grid-cols-[450px_minmax(0,1fr)]">
            <div className="max-w-xl space-y-6">
              <p className="text-sm font-semibold text-primary">
                醫天圓病人服務平台
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-primary sm:text-6xl">
                <span className="block">醫天圓</span>
                <span className="block">醫師團隊</span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                由了解自己開始，安排合適的調理與門診服務。體質諮詢、網上預約、預約管理與診後跟進，都可在此完成。
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/chat"
                  className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover"
                >
                  開始體質諮詢
                </Link>
                <Link
                  href="/booking"
                  className="inline-flex min-h-11 items-center rounded-xl border border-primary/20 bg-white/90 px-5 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary-light"
                >
                  預約醫師
                </Link>
              </div>
              <p className="text-sm text-slate-600">
                已有帳號？
                {' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  登入後繼續使用
                </Link>
              </p>
            </div>

            <div className="relative -mx-6 overflow-hidden px-6 pt-2 sm:-mx-10 sm:px-10 lg:mx-0 lg:overflow-visible lg:px-0">
              <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-white/70 to-transparent lg:-inset-x-10 lg:h-64" />
              <div className="relative flex items-end justify-start gap-0 overflow-x-auto pb-4 pt-6 [scrollbar-width:none] sm:justify-center lg:overflow-visible lg:pb-0">
                {HOME_HERO_DOCTORS.map((doctor, index) => (
                  <Link
                    key={doctor.id}
                    href={doctor.bookingUrl || "/booking"}
                    className={[
                      "group relative -ml-3 block h-44 w-28 shrink-0 overflow-hidden rounded-t-[24px] border border-white/80 bg-white/78 shadow-[0_22px_55px_rgba(15,23,42,0.16)] backdrop-blur transition hover:z-20 hover:-translate-y-2 first:ml-0",
                      "sm:h-52 sm:w-32 lg:-ml-5 lg:h-[300px] lg:w-[106px]",
                      index % 2 === 0 ? "lg:translate-y-5" : "lg:-translate-y-1",
                      index === 3 ? "lg:h-[328px] lg:w-[118px] lg:z-10" : "",
                    ].join(" ")}
                    aria-label={`預約${doctor.nameZh}`}
                  >
                    <Image
                      src={doctor.avatarSrc!}
                      alt={doctor.nameZh}
                      fill
                      sizes="(min-width: 1024px) 148px, 32vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                      style={{ objectPosition: doctor.avatarObjectPosition || "center" }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/85 via-primary/38 to-transparent px-2 pb-3 pt-16">
                      <p className="text-center text-[11px] font-semibold leading-tight text-white drop-shadow sm:text-xs">
                        {doctor.nameZh}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-primary-pale/95 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-24 pt-8 sm:px-10 sm:pb-32">
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
              已預約者可透過 WhatsApp 驗證碼快速管理現有預約；會員登入則可繼續使用更多個人化功能。
            </p>
            <Link href="/manage-booking" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              管理預約
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
