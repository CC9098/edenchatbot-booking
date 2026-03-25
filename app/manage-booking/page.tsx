import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CalendarPlus2,
  CircleSlash,
  LogIn,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';

import { ManageBookingFlow } from '@/components/booking/ManageBookingFlow';

export const metadata: Metadata = {
  title: '預約管理 | 醫天圓',
  description: '透過 WhatsApp 驗證碼，以清晰卡片方式更改或取消現有預約。',
};

function parseManageAction(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === 'reschedule' || normalized === 'cancel') {
    return normalized;
  }

  return null;
}

const ACTION_LINKS = [
  { href: '/manage-booking', label: '預約管理', action: null },
  { href: '/manage-booking?action=reschedule', label: '更改預約', action: 'reschedule' as const },
  { href: '/manage-booking?action=cancel', label: '取消預約', action: 'cancel' as const },
];

function getHeroCopy(action: 'reschedule' | 'cancel' | null) {
  if (action === 'reschedule') {
    return {
      eyebrow: '自助改期',
      title: '電話驗證後，直接改期',
      description: '用預約時的 WhatsApp 電話驗證身份，揀選要處理的預約，再換到新日期與時段。',
      bullets: [
        '只顯示可自助處理的未來預約',
        '改期流程集中在同一頁完成',
        '少於 1 小時的預約會自動轉人工協助',
      ],
    };
  }

  if (action === 'cancel') {
    return {
      eyebrow: '自助取消',
      title: '確認身份後，一頁取消預約',
      description: '輸入驗證碼後直接查看未來預約，只保留必要資訊，確認一次即可完成取消。',
      bullets: [
        '只顯示未來可處理的預約',
        '取消前會先再確認一次時間',
        '無法自助處理時會直接提供 WhatsApp 協助',
      ],
    };
  }

  return {
    eyebrow: '預約管理中心',
    title: '管理預約，不用再兜圈',
    description: '新預約、更改、取消分開處理，每次只做一件事，病人進入後可以更快完成操作。',
    bullets: [
      '手機版單欄優先，重點先出現',
      '電話驗證後才顯示預約卡片',
      '登入不是必要步驟',
    ],
  };
}

function ActionNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-primary bg-primary text-white shadow-[0_14px_28px_rgba(53,96,32,0.18)]'
          : 'border-primary/15 bg-white/85 text-primary hover:bg-primary-light'
      }`}
    >
      {label}
    </Link>
  );
}

function ActionLinkCard({
  href,
  title,
  description,
  icon,
  eyebrow,
  subtle,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  eyebrow: string;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[24px] border p-5 transition sm:p-6 ${
        subtle
          ? 'border-primary/10 bg-white/92 hover:border-primary/25 hover:bg-white'
          : 'border-primary/15 bg-[linear-gradient(180deg,rgba(241,247,236,0.94),rgba(255,255,255,0.98))] hover:border-primary/30 hover:shadow-[0_20px_40px_rgba(53,96,32,0.08)]'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
        {icon}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        立即前往
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function parseToken(value: string | string[] | undefined): string | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized?.trim() || null;
}

export default function ManageBookingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const action = parseManageAction(searchParams?.action);
  const token = parseToken(searchParams?.token);
  const hero = getHeroCopy(action);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(57,96,34,0.08),_transparent_34%),linear-gradient(180deg,_#f7f4ec_0%,_#eef5eb_46%,_#fbfcf8_100%)] text-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-12 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-8 right-0 h-72 w-72 rounded-full bg-emerald-100/70 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-primary"
            >
              返回首頁
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/15 bg-white/85 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
            >
              <LogIn className="h-4 w-4" />
              會員登入
            </Link>
          </div>

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {ACTION_LINKS.map((item) => (
                <ActionNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={action === item.action}
                />
              ))}
            </div>
          </div>
        </div>

        {action || token ? (
          <div className="mt-6">
            <ManageBookingFlow action={action ?? 'reschedule'} manageAccessToken={token} />
          </div>
        ) : (
          <section className="mt-6 rounded-[32px] border border-primary/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(53,96,32,0.07)] backdrop-blur sm:p-7 lg:p-10">
            <div className="flex flex-col gap-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_340px]">
                <div className="space-y-4 sm:space-y-5">
                  <div className="inline-flex items-center rounded-full border border-primary/10 bg-primary-light px-4 py-1.5 text-sm font-semibold tracking-[0.18em] text-primary">
                    {hero.eyebrow}
                  </div>
                  <div className="space-y-3">
                    <h1 className="max-w-4xl text-[2.2rem] font-semibold leading-[0.95] tracking-[-0.04em] text-primary sm:text-5xl lg:text-6xl">
                      {hero.title}
                    </h1>
                    <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base lg:text-lg">
                      {hero.description}
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(246,251,243,0.96),rgba(255,255,255,0.96))] p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">流程只保留必要步驟</h2>
                      <div className="space-y-2">
                        {hero.bullets.map((item) => (
                          <div
                            key={item}
                            className="rounded-2xl border border-primary/10 bg-white/85 px-4 py-3 text-sm leading-relaxed text-slate-600"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-500">
                        病人不需要先登入會員，先處理當前任務即可。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <ActionLinkCard
                    href="/booking-whatsapp"
                    eyebrow="新預約"
                    title="新預約"
                    description="選擇醫師、診所與時段，直接完成 WhatsApp 預約。"
                    icon={<CalendarPlus2 className="h-5 w-5" />}
                    subtle
                  />
                  <ActionLinkCard
                    href="/manage-booking?action=reschedule"
                    eyebrow="改期"
                    title="更改預約"
                    description="驗證電話後直接揀新日期與時段，不再跳去另一段對話。"
                    icon={<RefreshCcw className="h-5 w-5" />}
                  />
                  <ActionLinkCard
                    href="/manage-booking?action=cancel"
                    eyebrow="取消"
                    title="取消預約"
                    description="先確認身份，再核對時間與地點，最後一按完成取消。"
                    icon={<CircleSlash className="h-5 w-5" />}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(246,251,243,0.95),rgba(255,255,255,0.96))] p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">病人會經過 3 步</h2>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { step: '1', title: '輸入電話', text: '填寫預約時使用的 WhatsApp 電話。' },
                            { step: '2', title: '驗證身份', text: '輸入 6 位數驗證碼，查看預約卡片。' },
                            { step: '3', title: '完成操作', text: '揀選預約後即完成更改或取消。' },
                          ].map((item) => (
                            <div key={item.step} className="rounded-2xl border border-primary/10 bg-white/85 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                                Step {item.step}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-primary/10 bg-white/90 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light text-primary">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">使用原則</h2>
                        <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                          <p>新預約、更改、取消會分頁處理，避免病人同時面對太多選項。</p>
                          <p>距離應診時間少於 1 小時時，系統會直接改為人工協助。</p>
                          <p>管理預約本身不需要先登入，登入只屬額外功能。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
