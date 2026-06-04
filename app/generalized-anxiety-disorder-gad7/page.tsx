import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { Gad7Assessment } from "./Gad7Assessment";
import { jsonLd, publicUrl, SITE_NAME } from "@/lib/structured-data";

const pagePath = "/generalized-anxiety-disorder-gad7";
const doctorAvatar = "/doctor-avatars/clean/cheungmy.webp";
const bookingHref = "/booking?doctor=cheungmy&visitType=first&source=gad7-anxiety-page";
const jordanBookingHref =
  "/booking?doctor=cheungmy&clinic=jordan&visitType=first&source=gad7-anxiety-page";
const tsuenWanBookingHref =
  "/booking?doctor=cheungmy&clinic=tsuenwan&visitType=first&source=gad7-anxiety-page";

const symptomCards = [
  { title: "腦停不下來", copy: "工作、家庭、健康、金錢都反覆擔心，很難停止。" },
  { title: "身體長期繃緊", copy: "肩頸、胸口、胃部或頭部不適，休息後仍未放鬆。" },
  { title: "睡眠受影響", copy: "難入睡、早醒、夢多，醒來仍覺疲倦。" },
  { title: "情緒易爆線", copy: "容易煩躁、被小事觸動，專注力和耐性下降。" },
] as const;

const careSteps = [
  {
    icon: ClipboardList,
    title: "初診先建立基線",
    copy: "以 GAD-7 記錄過去兩星期的焦慮程度，再了解睡眠、消化、心悸、胸悶、月經或其他身體訊號。",
  },
  {
    icon: Stethoscope,
    title: "按體質辨證調理",
    copy: "焦慮背後可以涉及肝氣鬱結、心脾不足、陰虛火旺、氣血不暢等不同狀態，需要按人處理。",
  },
  {
    icon: TrendingUp,
    title: "覆診追蹤分數變化",
    copy: "不是只問「好似好啲未」，而是比較分數、睡眠、身體繃緊和日常功能有沒有實際改善。",
  },
] as const;

const scoreBands = [
  { range: "0-4", label: "焦慮程度較低", tone: "bg-white" },
  { range: "5-9", label: "輕度焦慮症狀", tone: "bg-[#eef8ef]" },
  { range: "10-14", label: "中度焦慮症狀", tone: "bg-[#fffbeb]" },
  { range: "15-21", label: "重度焦慮症狀", tone: "bg-[#fff7ed]" },
] as const;

export const metadata: Metadata = {
  title: "廣泛性焦慮症 GAD-7 自我評估 | 張敏言醫師 | 醫天圓",
  description:
    "經常擔心、緊張、失眠或身體繃緊，可能不只是壓力大。使用 GAD-7 焦慮量表初步評估，預約張敏言醫師以中醫辨證及覆診追蹤跟進。",
  alternates: {
    canonical: publicUrl(pagePath),
  },
  openGraph: {
    title: "廣泛性焦慮症 GAD-7 自我評估 | 張敏言醫師",
    description:
      "先用 GAD-7 建立焦慮基線，再由張敏言醫師按症狀、體質和覆診分數持續跟進。",
    url: publicUrl(pagePath),
    type: "article",
    images: [publicUrl(doctorAvatar)],
  },
};

function pageStructuredData() {
  const url = publicUrl(pagePath);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        "@id": `${url}#webpage`,
        url,
        name: "廣泛性焦慮症 GAD-7 自我評估",
        description:
          "介紹廣泛性焦慮症常見症狀、GAD-7 初步評估及張敏言醫師的中醫跟進方式。",
        about: {
          "@type": "MedicalCondition",
          name: "廣泛性焦慮症",
          alternateName: "Generalized Anxiety Disorder",
          associatedAnatomy: "情緒、睡眠、消化及身心壓力反應",
        },
        reviewedBy: {
          "@id": `${url}#physician`,
        },
        publisher: {
          "@id": publicUrl("/#organization"),
          name: SITE_NAME,
        },
      },
      {
        "@type": "Physician",
        "@id": `${url}#physician`,
        name: "張敏言醫師",
        alternateName: "Dr. Cheung",
        image: publicUrl(doctorAvatar),
        medicalSpecialty: ["Traditional Chinese Medicine", "Acupuncture"],
        worksFor: {
          "@id": publicUrl("/#organization"),
          name: SITE_NAME,
        },
        potentialAction: {
          "@type": "ReserveAction",
          target: publicUrl(bookingHref),
          name: "預約張敏言醫師",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "GAD-7 可以診斷焦慮症嗎？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "GAD-7 是初步篩查及追蹤工具，不能代替正式診斷。分數需配合臨床評估、症狀、持續時間和生活影響一同判斷。",
            },
          },
          {
            "@type": "Question",
            name: "為甚麼覆診要重做量表？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "焦慮調理需要看趨勢。覆診重做量表可比較分數、睡眠、身體繃緊和日常功能是否改善。",
            },
          },
        ],
      },
    ],
  };
}

export default function GeneralizedAnxietyDisorderGad7Page() {
  return (
    <main className="min-h-screen bg-[#f4f6f1] text-[#20382a]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(pageStructuredData()) }}
      />

      <section className="relative isolate overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(244,246,241,0.98)_0%,rgba(244,246,241,0.92)_48%,rgba(255,255,255,0.18)_100%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-[46%] bg-[#e7f1e8] lg:block" />
        <div className="relative mx-auto grid min-h-[92vh] max-w-7xl gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.7fr)] lg:items-center lg:px-12">
          <div className="space-y-7 pb-10 pt-4 lg:pb-16">
            <Link
              href="https://edenclinic.hk"
              className="inline-flex text-sm font-semibold text-[#1f6b3f] transition hover:text-[#0f4227]"
            >
              醫天圓 Eden TCM Clinic
            </Link>

            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c8b37c] bg-white/80 px-4 py-2 text-sm font-semibold text-[#6f5423]">
                <ShieldCheck className="h-4 w-4" />
                GAD-7 量表評估 + 中醫辨證跟進
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#0d4c2d] sm:text-5xl lg:text-6xl">
                你以為只是壓力大？
                <span className="block">可能是廣泛性焦慮症訊號</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#496153]">
                經常擔心、難以放鬆、失眠、心慌、胃脹或肩頸繃緊，都值得先量度。張敏言醫師會以 GAD-7 建立基線，再按體質和覆診變化跟進。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] sm:justify-start">
              <Link
                href="#gad7"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] bg-[#0d4c2d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
              >
                立即做 GAD-7
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={bookingHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-[#b8cbb8] bg-white px-6 py-3 text-sm font-semibold text-[#0d4c2d] transition hover:bg-[#f4faf4]"
              >
                預約張敏言醫師
                <CalendarDays className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
              {["先量度焦慮程度", "每次覆診追蹤", "按體質調理身心"].map((item) => (
                <div key={item} className="rounded-[18px] border border-[#d8e2d8] bg-white/82 p-4">
                  <CheckCircle2 className="h-5 w-5 text-[#1f6b3f]" />
                  <p className="mt-3 text-sm font-semibold text-[#20382a]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-10 lg:pb-0">
            <div className="overflow-hidden rounded-[28px] border border-[#d7c6a7] bg-white shadow-[0_34px_90px_-54px_rgba(15,63,42,0.9)]">
              <div className="relative aspect-[4/5] bg-[#e7f1e8]">
                <Image
                  src={doctorAvatar}
                  alt="張敏言醫師"
                  fill
                  priority
                  sizes="(min-width: 1024px) 420px, 88vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0d4c2d]/90 via-[#0d4c2d]/40 to-transparent p-5 text-white">
                  <p className="text-sm font-semibold tracking-[0.12em] text-white/78">
                    情緒與身心調理
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">張敏言醫師</h2>
                  <p className="mt-2 text-sm text-white/82">註冊中醫師｜針灸 Acupuncture</p>
                </div>
              </div>
              <div className="grid gap-3 p-5">
                <div className="rounded-[18px] bg-[#f4f6f1] p-4">
                  <p className="text-sm font-semibold text-[#0d4c2d]">應診時間</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                    佐敦：星期四 11:00-14:00
                    <br />
                    荃灣：星期三 10:30-14:00、15:30-17:00
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={jordanBookingHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#0d4c2d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
                  >
                    預約佐敦
                  </Link>
                  <Link
                    href={tsuenWanBookingHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[#b8cbb8] bg-white px-4 py-2 text-sm font-semibold text-[#0d4c2d] transition hover:bg-[#f4faf4]"
                  >
                    預約荃灣
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">
              <Brain className="h-4 w-4" />
              廣泛性焦慮症
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl">
              焦慮不一定會大喊大叫，它常常藏在身體裡
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#496153]">
              很多香港人仍能上班、照顧家庭、完成責任，但內在長期拉緊。當擔心變得頻密、難以控制，並開始影響睡眠、工作、關係或身體狀態，就值得認真評估。
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {symptomCards.map((item) => (
              <article key={item.title} className="rounded-[22px] border border-[#d8e2d8] bg-white p-5 shadow-sm">
                <HeartPulse className="h-5 w-5 text-[#1f6b3f]" />
                <h3 className="mt-4 text-lg font-semibold text-[#0d4c2d]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Gad7Assessment />

      <section className="bg-white px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.7fr)] lg:items-start">
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-[#8a6b39]">醫天圓跟進方式</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl">
                特色不是只問感覺，而是一路量度有沒有進步
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                情緒調理最怕「好似好咗啲」但沒有方向。GAD-7 讓初診、覆診和調理目標更清晰，病人也更容易看見自己是否真的放鬆、睡得好、少了心慌和身體繃緊。
              </p>
            </div>

            <div className="grid gap-4">
              {careSteps.map((step) => (
                <article key={step.title} className="rounded-[24px] border border-[#d8e2d8] bg-[#fbfdf9] p-5">
                  <div className="flex gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#e7f1e8] text-[#1f6b3f]">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#0d4c2d]">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#496153]">{step.copy}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-[#d7c6a7] bg-[#0d4c2d] p-6 text-white shadow-[0_28px_80px_-54px_rgba(15,63,42,0.9)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.42fr)] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-white/72">預約評估</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                帶同 GAD-7 分數預約張敏言醫師
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/78">
                初診時可把量表分數、主要困擾和持續時間一併告訴醫師。預約成功後，診所會以 WhatsApp 確認。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={bookingHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] bg-white px-6 py-3 text-sm font-semibold text-[#0d4c2d] transition hover:bg-[#f4f6f1]"
                >
                  網上預約
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#gad7"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border border-white/28 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  先做量表
                </Link>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/18 bg-white/10 p-5">
              <div className="grid gap-3">
                {scoreBands.map((band) => (
                  <div key={band.range} className={`rounded-[16px] px-4 py-3 text-[#20382a] ${band.tone}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{band.label}</span>
                      <span className="text-sm font-semibold">{band.range} 分</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/70">
                GAD-7 是初步篩查及追蹤工具，不能代替正式診斷。分數要配合症狀、持續時間和生活影響一同判斷。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-4 text-sm leading-relaxed text-[#496153] lg:grid-cols-[minmax(0,0.7fr)_minmax(300px,0.35fr)]">
          <div className="rounded-[20px] border border-[#d8e2d8] bg-[#fbfdf9] p-5">
            <p className="font-semibold text-[#0d4c2d]">重要提醒</p>
            <p className="mt-2">
              本頁內容只作健康教育及預約前參考。GAD-7 不能代替醫師、心理學家或精神科醫生的正式評估。如你正接受心理治療或西醫治療，請按原有醫療建議繼續跟進。
            </p>
          </div>
          <div className="rounded-[20px] border border-[#fed7aa] bg-[#fff7ed] p-5 text-[#7c2d12]">
            <p className="flex items-center gap-2 font-semibold">
              <MessageCircle className="h-4 w-4" />
              即時危機支援
            </p>
            <p className="mt-2">
              如有自殘、自殺念頭，請即時到急症室、致電 999，或聯絡香港 18111 精神健康支援熱線。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
