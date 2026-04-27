import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ExternalLink, MapPin, MessageCircle, ShieldCheck } from "lucide-react";

const posterSrc = "/images/dr-samuel-wong-chiropractor.png";

const whatsappMessage = encodeURIComponent(
  "你好，我想預約黃浩哲 Dr. Samuel H.C. Wong 脊醫，請問最近可預約時間？"
);

const clinicActions = [
  {
    clinicName: "中環",
    phone: "67333234",
    href: `https://wa.me/85267333234?text=${whatsappMessage}`,
  },
  {
    clinicName: "佐敦",
    phone: "67333801",
    href: `https://wa.me/85267333801?text=${whatsappMessage}`,
  },
  {
    clinicName: "荃灣",
    phone: "51899065",
    href: `https://wa.me/85251899065?text=${whatsappMessage}`,
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
            width={1290}
            height={1536}
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
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-[#d7c6a7] bg-white/82 p-5 shadow-[0_18px_50px_-38px_rgba(20,43,28,0.65)]">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">
              <CalendarDays className="h-4 w-4" />
              預約 Dr Wong
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#496153]">
              請選擇方便分店，姑娘會跟進 Dr Wong 最近可預約時間。現階段此頁以 WhatsApp 預約為主，避免病人進入尚未開放的網上時段。
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
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

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[#536459]">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2">
              <MapPin className="h-4 w-4 text-[#1f6b3f]" />
              中環 | 佐敦 | 荃灣
            </span>
            <Link
              href="/embed/timetable"
              className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 font-semibold text-[#1f6b3f] transition hover:bg-white"
            >
              查看診所時間表
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
