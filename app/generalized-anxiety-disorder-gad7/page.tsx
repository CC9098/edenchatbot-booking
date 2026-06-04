import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { Gad7Assessment } from "./Gad7Assessment";
import styles from "./page.module.css";
import { jsonLd, publicUrl, SITE_NAME } from "@/lib/structured-data";

const pagePath = "/generalized-anxiety-disorder-gad7";
const doctorAvatar = "/doctor-avatars/clean/cheungmy.webp";
const bookingHref = "/booking?doctor=cheungmy&visitType=first&source=gad7-anxiety-page";
const jordanBookingHref =
  "/booking?doctor=cheungmy&clinic=jordan&visitType=first&source=gad7-anxiety-page";
const tsuenWanBookingHref =
  "/booking?doctor=cheungmy&clinic=tsuenwan&visitType=first&source=gad7-anxiety-page";

const symptomCards = [
  { title: "經常嘆氣、胸悶不舒", copy: "壓力未必很大，但身體長期繃緊，肩頸、胸脅也難以放鬆。" },
  { title: "思緒停不下來", copy: "容易驚醒、多夢、心悸，明明疲倦，心神仍然難以安定。" },
  { title: "壓力下胃口轉差", copy: "一緊張便胃脹、易倦、難以集中，越疲倦越容易反覆擔心。" },
  { title: "夜間煩躁、睡眠淺", copy: "口乾、潮熱或睡眠不穩，白天勉強應付，晚上反而更難放鬆。" },
] as const;

const tcmPatterns = [
  {
    title: "肝鬱氣滯",
    signs: "胸悶、胸脅脹、易怒、經前情緒起伏，常覺一口氣鬱在胸中。",
    principle: "重點在疏肝理氣、調暢氣機，讓身體由繃緊逐步回復順暢。",
  },
  {
    title: "心脾兩虛",
    signs: "心悸、易倦、胃口差、健忘、睡眠不穩，思慮後更覺疲乏。",
    principle: "重點在健脾養心、調補氣血，令心神較容易安定。",
  },
  {
    title: "陰虛火旺／心腎不交",
    signs: "入睡困難、睡眠淺、口乾、手足心熱，夜間煩躁較明顯。",
    principle: "重點在滋陰清熱、交通心腎，幫助晚上逐步安定。",
  },
  {
    title: "痰熱擾心",
    signs: "心煩、胸悶、胃脘不舒、痰多，思緒混亂，容易受驚。",
    principle: "重點在清熱化痰、和胃寧神，讓胸悶和心煩逐步減輕。",
  },
] as const;

const tcmAssessmentPoints = [
  "看舌色、舌苔、齒痕，了解脾胃、寒熱和虛實狀態。",
  "切脈時留意弦、細、滑、數等變化，看看是氣滯、痰熱、陰虛還是氣血不足。",
  "問清睡眠、胃口、大便、胸悶、心悸、肩頸繃緊、月經和精神狀態。",
  "了解最近壓力、擔心的事、發作時間，以及工作和家庭節奏有沒有把身體推得太緊。",
] as const;

const careSteps = [
  {
    icon: ClipboardList,
    title: "先了解主要不適",
    copy: "有些人以心悸為主，有些人以胃脹、胸悶或睡眠不穩為主。先了解症狀的先後和輕重，才可判斷調理重點。",
  },
  {
    icon: Stethoscope,
    title: "再用望聞問切辨證",
    copy: "同樣是焦慮，背後可以是肝鬱、心脾不足、陰虛火旺或痰熱。證型不同，調理方向也不同。",
  },
  {
    icon: TrendingUp,
    title: "覆診看見實際變化",
    copy: "覆診時會比較睡眠、胸悶、心悸、胃口和精神狀態的變化，讓調理方向更清晰。",
  },
] as const;

const scoreBands = [
  { range: "0-4", label: "焦慮程度較低", tone: "bg-white" },
  { range: "5-9", label: "輕度焦慮症狀", tone: "bg-[#eef8ef]" },
  { range: "10-14", label: "中度焦慮症狀", tone: "bg-[#fffbeb]" },
  { range: "15-21", label: "重度焦慮症狀", tone: "bg-[#fff7ed]" },
] as const;

type PosterVariant = "posterImageOne" | "posterImageTwo" | "posterImageThree" | "posterImageFour";

function PosterTile({
  green,
  brown,
  footer,
  variant,
  compact = false,
}: {
  green: string;
  brown: string;
  footer: string;
  variant: PosterVariant;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.posterTile} ${styles[variant]} p-5 ${
        compact ? "min-h-[180px]" : "min-h-[220px]"
      }`}
    >
      <div className={styles.posterBurst} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`${styles.posterText} pt-8 ${compact ? "text-3xl" : "text-4xl"}`}>
        <span className="block">{green}</span>
        <span className={`${styles.posterBrown} mt-1 block`}>{brown}</span>
      </div>
      <p className={`${styles.posterFooter} mt-7 text-sm`}>{footer}</p>
    </div>
  );
}

export const metadata: Metadata = {
  title: "廣泛性焦慮症中醫調理與 GAD-7 評估 | 張敏言醫師 | 醫天圓",
  description:
    "從中醫情志病、肝鬱、心脾兩虛、陰虛火旺等角度了解廣泛性焦慮症。完成 GAD-7 後，可預約張敏言醫師以中醫辨證跟進睡眠、心悸、胸悶和壓力狀態。",
  alternates: {
    canonical: publicUrl(pagePath),
  },
  openGraph: {
    title: "廣泛性焦慮症中醫調理與 GAD-7 評估 | 張敏言醫師",
    description:
      "完成 GAD-7 後，帶同睡眠、胃口、心悸、胸悶和壓力情況，由張敏言醫師按中醫辨證跟進。",
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
          "介紹廣泛性焦慮症的中醫情志病觀點、常見證型、GAD-7 初步評估及張敏言醫師的中醫跟進方式。",
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
              text: "GAD-7 可幫助整理近兩星期的焦慮情況，但不能單靠分數判斷病情。中醫跟進時，需一併看情志誘因、舌脈、睡眠、消化、心悸、胸悶及生活影響。",
            },
          },
          {
            "@type": "Question",
            name: "中醫如何理解廣泛性焦慮症？",
            acceptedAnswer: {
              "@type": "Answer",
              text: "中醫多從情志病、鬱證、驚悸、不寐等範圍理解焦慮，按肝失疏泄、心神不寧、心脾兩虛、陰虛火旺或痰熱擾心等證型辨證處理。",
            },
          },
        ],
      },
    ],
  };
}

export default function GeneralizedAnxietyDisorderGad7Page() {
  return (
    <main className={`${styles.pageShell} min-h-screen text-[#20382a]`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(pageStructuredData()) }}
      />

      <section className={`${styles.sectionBand} relative isolate px-4 py-4 sm:px-6 lg:px-8`}>
        <div className={`${styles.paperHero} relative mx-auto grid min-h-[88vh] max-w-7xl gap-8 rounded-[34px] px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(400px,0.62fr)] lg:items-center lg:px-14`}>
          <div className="relative z-10 space-y-7 pb-10 pt-4 lg:pb-14">
            <Link
              href="https://edenclinic.hk"
              className="inline-flex text-sm font-semibold text-[#1f6b3f] transition hover:text-[#0f4227]"
            >
              醫天圓 Eden TCM Clinic
            </Link>

            <div className="max-w-3xl">
              <div className={`${styles.brushKicker} text-sm`}>
                長期擔心、睡眠欠安、心神不寧？
              </div>
              <h1 className={`${styles.brushTitle} mt-5 text-[2.75rem] sm:text-6xl lg:text-[5.35rem]`}>
                <span className={styles.brushGreen}>情緒低落、</span>
                <br />
                <span className={styles.brushBrown}>長期緊張？</span>
                <br />
                <span className="block text-[0.82em]">可能是</span>
                <span className={`${styles.highlightStroke} block w-fit whitespace-nowrap`}>肝氣鬱結</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#496153]">
                長期焦慮不一定只是「想太多」，身體亦可能已經處於繃緊狀態。若你近來經常擔心、失眠、心悸、胃脹、胸悶或肩頸繃緊，張敏言醫師會先從中醫辨證了解體質，再配合 GAD-7 記錄當刻狀態，方便覆診比較。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] sm:justify-start">
              <Link
                href="#gad7"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#0d4c2d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
              >
                立即做 GAD-7
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={bookingHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-[#b8cbb8] bg-white/75 px-6 py-3 text-sm font-semibold text-[#0d4c2d] transition hover:bg-white"
              >
                預約張敏言醫師
                <CalendarDays className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid max-w-3xl grid-cols-3 gap-3">
              {["問清壓力", "看舌切脈", "覆診跟進"].map((item) => (
                <div key={item} className={`${styles.roundSeal} flex min-h-24 items-center justify-center p-3 text-center sm:min-h-32`}>
                  <p className="text-xs font-bold leading-snug text-[#0d4c2d] sm:text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 pb-10 lg:pb-0">
            <div className={`${styles.doctorPortrait} overflow-hidden rounded-[28px]`}>
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
                    調身，也調心
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">張敏言醫師</h2>
                  <p className="mt-2 text-sm text-white/82">註冊中醫師｜針灸 Acupuncture</p>
                </div>
              </div>
              <div className="grid gap-3 p-5">
                <div className={`${styles.sketchPanel} rounded-[18px] p-4`}>
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
                    className="inline-flex min-h-11 items-center justify-center rounded-[12px] bg-[#0d4c2d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0a3c24]"
                  >
                    預約佐敦
                  </Link>
                  <Link
                    href={tsuenWanBookingHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-[12px] border border-[#b8cbb8] bg-white/70 px-4 py-2 text-sm font-semibold text-[#0d4c2d] transition hover:bg-white"
                  >
                    預約荃灣
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.sectionBand} px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.74fr)_260px] lg:items-end">
            <div className="max-w-3xl">
              <div className={`${styles.markerTag} text-sm`}>
                中醫如何看焦慮
              </div>
              <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
                焦慮不一定只是「想太多」，身體也會反映壓力
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                很多人仍然照常上班、照顧家人，表面看似應付得到，但身體已開始透過胸悶、胃脹、心悸、失眠、易怒或疲倦反映壓力。中醫看情緒，會連同肝、心、脾、腎和氣血一起判斷。
              </p>
            </div>
            <div className="hidden lg:block">
              <PosterTile
                green="肝氣鬱結？"
                brown="身體都會繃緊"
                footer="疏肝理氣 · 調和身心"
                variant="posterImageOne"
                compact
              />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {symptomCards.map((item) => (
              <article key={item.title} className={`${styles.speechBubble} p-5 pb-6`}>
                <h3 className="text-lg font-extrabold text-[#0d4c2d]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.sectionBand} bg-[#fffaf0]/70 px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.7fr)] lg:items-start">
            <div>
              <div className={`${styles.markerTag} text-sm`}>
                辨證分型
              </div>
              <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
                同樣是焦慮，每個人的根源未必一樣
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                有人壓力一大便胸悶，有人長期思慮後變得疲倦，有人夜間特別心煩。張敏言醫師會按舌脈、睡眠、消化、情緒誘因和身體反應，分辨應先疏肝、養心、健脾，還是清熱化痰。
              </p>
              <div className={`${styles.sketchPanel} mt-6 rounded-[22px] p-4`}>
                <PosterTile
                  green="胸悶不舒？"
                  brown="睡眠不穩？"
                  footer="望舌切脈 · 辨清根源"
                  variant="posterImageTwo"
                  compact
                />
                <div className="p-1 pt-4">
                  <p className="text-sm font-semibold text-[#6f5423]">張醫師會仔細了解</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5d513d]">
                    近期睡眠、飲食、心悸、胸悶、胃口及大便情況，均有助判斷焦慮背後的體質偏差。再配合舌脈，才能辨清身體哪一部分需要先調理。
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {tcmPatterns.map((pattern) => (
                <article key={pattern.title} className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                  <h3 className="text-lg font-extrabold text-[#0d4c2d]">{pattern.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                    <span className="font-semibold text-[#20382a]">你可能會有：</span>
                    {pattern.signs}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                    <span className="font-semibold text-[#20382a]">調理方向：</span>
                    {pattern.principle}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Gad7Assessment />

      <section className={`${styles.sectionBand} bg-[#fffaf0]/70 px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.7fr)] lg:items-start">
            <div>
              <p className={`${styles.markerTag} text-sm`}>醫天圓跟進方式</p>
              <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
                每次覆診，都要看身體是否逐步回穩
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                情緒調理不應只停留在模糊感覺。覆診時會一起比較睡眠是否穩定、心悸是否減少、胸悶是否放鬆、胃口和精神是否改善，以及擔心程度有沒有下降。
              </p>
              <div className="mt-6 grid gap-3">
                {tcmAssessmentPoints.map((point) => (
                  <p key={point} className={`${styles.sketchPanel} flex gap-3 rounded-[18px] p-4 text-sm leading-relaxed text-[#496153]`}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b3f]" />
                    {point}
                  </p>
                ))}
              </div>
              <div className="mt-6 max-w-[280px]">
                <PosterTile
                  green="睡眠不穩？"
                  brown="心神要安"
                  footer="養心安神 · 睡眠跟進"
                  variant="posterImageThree"
                  compact
                />
              </div>
            </div>

            <div className="grid gap-4">
              {careSteps.map((step) => (
                <article key={step.title} className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                  <div className="flex gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#0d4c2d]/30 bg-[#fffaf0] text-[#1f6b3f]">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-extrabold text-[#0d4c2d]">{step.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[#496153]">{step.copy}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.sectionBand} px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl rounded-[26px] border border-[#d7c6a7] bg-[#0d4c2d] p-6 text-white shadow-[0_28px_80px_-54px_rgba(15,63,42,0.9)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.42fr)] lg:items-center">
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-white/72">預約評估</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
                帶同你的分數和身體感受，預約張敏言醫師
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/78">
                初診時可把量表分數、近期主要困擾、睡眠、胃口、胸悶、心悸、月經或其他身體訊號一併告訴醫師。預約成功後，診所會以 WhatsApp 確認。
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
                GAD-7 可先記錄近況。到診時，仍需一併了解睡眠、胃口、心悸、胸悶、壓力來源和舌脈變化。
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
              本頁內容只作預約前了解之用，不能代替醫師、心理學家或精神科醫生的正式評估。如你正接受心理治療或西醫治療，請按原有醫療建議繼續跟進。
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
