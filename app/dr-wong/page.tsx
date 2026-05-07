import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ChevronDown, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";

const posterSrc = "/images/dr-samuel-wong-promo-poster-2026-board-fixed.png";
const timetablePosterSrc = "/images/dr-samuel-wong-chiropractor-may-2026.png";

const whatsappMessage = encodeURIComponent(
  "你好，我想預約黃浩哲 Dr. Samuel H.C. Wong 脊醫，請問最近可預約時間？"
);
const drWongFirstVisitBookingUrl =
  "/booking?doctor=wong&clinic=jordan&visitType=first&source=dr-wong";
const drWongFollowUpBookingUrl =
  "/booking?doctor=wong&clinic=jordan&visitType=followup&source=dr-wong";

const clinicActions = [
  {
    clinicName: "佐敦",
    phone: "67333801",
    href: `https://wa.me/85267333801?text=${whatsappMessage}`,
  },
];

const pricingRows = [
  {
    label: "首診",
    title: "脊醫首診： 檢查及治療",
    subtitle: "Standard Chiropractic Examination",
    duration: "30 minutes",
    price: "HK$490",
    originalPrice: "HK$980",
    note: "中醫聯乘優惠",
    description: "凡正接受醫天圓中醫診症的病人，可享首次半價優惠。",
    href: drWongFirstVisitBookingUrl,
  },
  {
    label: "覆診",
    title: "脊醫覆診： 跟進治療",
    subtitle: "Standard Follow Up Visit",
    duration: "15 minutes",
    price: "HK$880",
    href: drWongFollowUpBookingUrl,
  },
];

export const metadata: Metadata = {
  title: "黃浩哲脊醫 Dr. Samuel H.C. Wong | 醫天圓",
  description: "黃浩哲脊醫 Dr. Samuel H.C. Wong，香港註冊脊醫，醫天圓脊骨神經科醫生預約頁。",
};

export default function DrWongPage() {
  return (
    <main className="min-h-screen bg-[#f6f1e8] text-[#123f2a]">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.7fr)] lg:items-center lg:px-12">
        <div className="relative order-2 overflow-hidden rounded-[28px] border border-[#e0cfb4] bg-white shadow-[0_28px_80px_-44px_rgba(20,43,28,0.7)] lg:order-1">
          <Image
            src={posterSrc}
            alt="黃浩哲 Dr. Samuel H.C. Wong 脊醫介紹"
            width={998}
            height={1576}
            priority
            className="h-auto w-full"
          />
        </div>

        <div className="order-1 flex flex-col justify-center py-5 lg:order-2">
          <Link
            href="https://edenclinic.hk"
            className="mb-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#1f6b3f] transition hover:text-[#0f4227]"
          >
            醫天圓 Eden TCM Clinic
            <ExternalLink className="h-4 w-4" />
          </Link>

          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#b8995d] bg-white/70 px-4 py-2 text-sm font-semibold text-[#6a4a1e]">
              <ShieldCheck className="h-4 w-4" />
              香港註冊脊醫 CC000351
            </div>

            <div>
              <p className="text-lg font-semibold tracking-[0.12em] text-[#8a6b39]">
                Doctor of Chiropractic
              </p>
              <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight text-[#0d4c2d] sm:text-6xl">
                黃浩哲
              </h1>
              <p className="mt-3 text-2xl font-semibold text-[#5d4c3c]">
                Dr. Samuel H.C. Wong
              </p>
            </div>

            <div className="max-w-xl space-y-3 text-base leading-relaxed text-[#365442] sm:text-lg">
              <p>脊骨神經科醫生，美國脊骨神經科醫學博士。</p>
              <p>適合希望了解脊骨、姿勢、頸肩腰背不適及日常活動功能狀態的病人預約查詢。</p>
              <p>網上預約先簡化為首診及覆診兩項；X 光片及 X 光片講解可到診後按需要再安排。</p>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-[#d7c6a7] bg-white/82 p-5 shadow-[0_18px_50px_-38px_rgba(20,43,28,0.65)]">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">
              <CalendarDays className="h-4 w-4" />
              預約 Dr Wong
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#496153]">
              佐敦應診時間：星期四 11:00-14:00、星期六 14:30-16:30。為方便醫生安排時間，每節需要最少三位病人才會開診。若未滿三人，系統會自動取消預約。若果人數足夠確認預約，會前一天以 WhatsApp 確認。
            </p>

            <div className="mt-5 divide-y divide-[#e0cfb4] border-y border-[#e0cfb4]">
              {pricingRows.map((item) => (
                <div key={item.label} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#1f6b3f]">
                        {item.label}
                      </span>
                      {item.note ? (
                        <span className="rounded-full bg-[#fff4cf] px-3 py-1 text-xs font-semibold text-[#806018]">
                          {item.note}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base font-semibold text-[#123f2a]">{item.title}</p>
                    <p className="text-sm text-[#496153]">{item.subtitle} · {item.duration}</p>
                    {item.description ? (
                      <p className="mt-1 text-xs font-medium leading-relaxed text-[#1f6b3f]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-1">
                    <p className="text-xl font-semibold text-[#0d4c2d]">{item.price}</p>
                    {item.originalPrice ? (
                      <p className="text-sm text-[#8b7860] line-through">{item.originalPrice}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {pricingRows.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-[#0d4c2d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
                >
                  預約{item.label}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ))}
            </div>

            <details className="group mt-5 overflow-hidden rounded-[18px] border border-[#d7c6a7] bg-[#fbf7ef]">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#0d4c2d] transition hover:bg-white [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#1f6b3f]" />
                  展開 Dr Wong 五月時間表
                </span>
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-[#e0cfb4] bg-white p-3">
                <Image
                  src={timetablePosterSrc}
                  alt="黃浩哲 Dr. Samuel H.C. Wong 2026 年五月佐敦應診時間表"
                  width={1254}
                  height={1254}
                  className="h-auto w-full rounded-[14px] border border-[#eadcc3]"
                />
                <Link
                  href="/embed/timetable"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#1f6b3f] transition hover:text-[#0f4227]"
                >
                  查看完整診所時間表
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </details>

            <div className="mt-4 grid gap-3">
              {clinicActions.map((clinic) => (
                <a
                  key={clinic.clinicName}
                  href={clinic.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-24 flex-col justify-between rounded-[18px] border border-[#cbb78f] bg-[#0d4c2d] p-4 text-white transition hover:-translate-y-0.5 hover:bg-[#0a3c24] hover:shadow-[0_18px_34px_-26px_rgba(13,76,45,0.8)]"
                >
                  <span className="flex items-center justify-between gap-2 text-lg font-semibold">
                    {clinic.clinicName}
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <span className="mt-3 text-sm text-white/78">WhatsApp 預約</span>
                </a>
              ))}
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
