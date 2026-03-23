import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarPlus2, CircleSlash, MessageCircle, RefreshCcw, ShieldCheck } from 'lucide-react';

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

function ActionLinkCard({
  href,
  title,
  description,
  icon,
  subtle,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-[28px] border p-6 transition ${
        subtle
          ? 'border-primary/10 bg-white/90 hover:border-primary/25 hover:bg-white'
          : 'border-primary/15 bg-[linear-gradient(180deg,rgba(241,247,236,0.9),rgba(255,255,255,0.96))] hover:border-primary/30 hover:shadow-[0_20px_40px_rgba(53,96,32,0.08)]'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        立即前往
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default function ManageBookingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const action = parseManageAction(searchParams?.action);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(57,96,34,0.08),_transparent_34%),linear-gradient(180deg,_#f7f4ec_0%,_#eef5eb_46%,_#fbfcf8_100%)] text-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-12 top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-8 right-0 h-72 w-72 rounded-full bg-emerald-100/70 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-8 sm:px-10 sm:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-primary"
          >
            返回首頁
          </Link>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/manage-booking"
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                action === null
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/15 bg-white/85 text-primary hover:bg-primary-light'
              }`}
            >
              預約管理
            </Link>
            <Link
              href="/manage-booking?action=reschedule"
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                action === 'reschedule'
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/15 bg-white/85 text-primary hover:bg-primary-light'
              }`}
            >
              更改預約
            </Link>
            <Link
              href="/manage-booking?action=cancel"
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                action === 'cancel'
                  ? 'border-primary bg-primary text-white'
                  : 'border-primary/15 bg-white/85 text-primary hover:bg-primary-light'
              }`}
            >
              取消預約
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full border border-primary/15 bg-white/85 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
            >
              會員登入
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-[36px] border border-primary/10 bg-white/88 p-7 shadow-[0_24px_70px_rgba(53,96,32,0.07)] backdrop-blur sm:p-10">
          <div className="flex flex-col gap-8">
            <div className="max-w-4xl space-y-5">
              <div className="inline-flex items-center rounded-full border border-primary/10 bg-primary-light px-4 py-1.5 text-sm font-semibold tracking-[0.18em] text-primary">
                預約管理中心
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold leading-tight text-primary sm:text-6xl">
                  {action === 'reschedule'
                    ? '清晰地更改現有預約'
                    : action === 'cancel'
                      ? '清晰地取消現有預約'
                      : '一次跳轉，清楚管理預約'}
                </h1>
                <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
                  WhatsApp 只作入口，進入後就是正式的預約管理頁。輸入電話、收驗證碼、查看預約卡片，再完成更改或取消，不會再跳進另一段對話。
                </p>
              </div>
            </div>

            {action ? (
              <ManageBookingFlow action={action} />
            ) : (
              <div className="space-y-8">
                <div className="grid gap-4 lg:grid-cols-3">
                  <ActionLinkCard
                    href="/booking-whatsapp"
                    title="新預約"
                    description="進入正式預約頁，選擇醫師、診所與時段，完成 WhatsApp 預約。"
                    icon={<CalendarPlus2 className="h-5 w-5" />}
                  />
                  <ActionLinkCard
                    href="/manage-booking?action=reschedule"
                    title="更改預約"
                    description="用 WhatsApp 驗證碼核對身份，看到預約卡片後即可更改日期和時段。"
                    icon={<RefreshCcw className="h-5 w-5" />}
                  />
                  <ActionLinkCard
                    href="/manage-booking?action=cancel"
                    title="取消預約"
                    description="先確認身份，再清楚查看要取消的預約卡片，最後一按完成取消。"
                    icon={<CircleSlash className="h-5 w-5" />}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[28px] border border-primary/10 bg-[linear-gradient(180deg,rgba(246,251,243,0.95),rgba(255,255,255,0.96))] p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-xl font-semibold text-slate-900">病人之後會見到的流程</h2>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            {
                              step: '1',
                              title: '輸入電話',
                              text: '填寫預約時使用的 WhatsApp 電話。',
                            },
                            {
                              step: '2',
                              title: '驗證身份',
                              text: '輸入 6 位數驗證碼，查看未來預約卡片。',
                            },
                            {
                              step: '3',
                              title: '完成操作',
                              text: '清楚選中要更改或取消的預約，再確認提交。',
                            },
                          ].map((item) => (
                            <div key={item.step} className="rounded-2xl border border-primary/10 bg-white/80 p-4">
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

                  <div className="rounded-[28px] border border-primary/10 bg-white/90 p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-xl font-semibold text-slate-900">使用原則</h2>
                        <div className="space-y-3 text-sm leading-relaxed text-slate-600">
                          <p>新預約、更改、取消會分開處理，每頁只做一件事，不再混合在同一段對話內。</p>
                          <p>如距離應診時間少於 1 小時，系統不會再開放自助更改或取消，會直接引導病人聯絡姑娘。</p>
                          <p>如果病人本身已有會員帳號，仍可登入繼續使用更多個人化功能；但管理預約本身不需要先登入。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
