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
  { title: "成日嘆氣、胸口翳住", copy: "事情未必很大，但個人長期繃緊，肩頸、胸脅也像鬆不開。" },
  { title: "瞓落床都停唔到諗", copy: "容易驚醒、多夢、心慌，明明很累，個心仍然定不下來。" },
  { title: "一緊張就胃口差", copy: "壓力一來便胃脹、易倦、集中不到，越累越容易胡思亂想。" },
  { title: "夜晚特別煩躁", copy: "口乾、潮熱、睡眠淺，白天忍得到，晚上反而更難放鬆。" },
] as const;

const tcmPatterns = [
  {
    title: "肝鬱氣滯",
    signs: "胸口翳、胸脅脹、易怒、經前情緒起伏，常覺得有一口氣頂住。",
    principle: "先幫氣機鬆開，讓身體由「繃住」慢慢回到順暢。",
  },
  {
    title: "心脾兩虛",
    signs: "心慌、易倦、胃口差、健忘、睡不穩，愈想愈沒有精神。",
    principle: "調好脾胃與氣血，心神才較容易安定下來。",
  },
  {
    title: "陰虛火旺／心腎不交",
    signs: "入睡難、睡眠淺、口乾、手足心熱，夜晚特別煩躁。",
    principle: "把虛熱降下來，讓晚上不再一直繃著。",
  },
  {
    title: "痰熱擾心",
    signs: "心煩、胸悶、胃脘不舒、痰多，腦袋像塞住，容易受驚。",
    principle: "從脾胃與痰熱入手，讓胸口和思緒都清一點。",
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
    title: "先聽清楚你點樣唔舒服",
    copy: "有些人是心慌，有些人是胃脹，有些人是胸口翳住。先把你的感受講清楚，才知道從哪裡調。",
  },
  {
    icon: Stethoscope,
    title: "再用望聞問切辨證",
    copy: "同樣是焦慮，背後可以是肝鬱、心脾不足、陰虛火旺或痰熱。證型不同，調理方向也不同。",
  },
  {
    icon: TrendingUp,
    title: "覆診看見實際變化",
    copy: "覆診時會再問：睡好一點未、胸口有沒有鬆、心慌有沒有少、精神有沒有回來。身體會慢慢告訴我們方向有沒有走對。",
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
    "從中醫情志病、肝鬱、心脾兩虛、陰虛火旺等角度了解廣泛性焦慮症。完成 GAD-7 後，可預約張敏言醫師以中醫辨證跟進睡眠、心慌、胸悶和壓力狀態。",
  alternates: {
    canonical: publicUrl(pagePath),
  },
  openGraph: {
    title: "廣泛性焦慮症中醫調理與 GAD-7 評估 | 張敏言醫師",
    description:
      "完成 GAD-7 後，帶同睡眠、胃口、心慌、胸悶和壓力情況，由張敏言醫師按中醫辨證跟進。",
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
                成日擔心、瞓唔好、個心定唔落？
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
                有時不是你「諗太多」，而是身體已經長期繃緊。若你近來經常擔心、失眠、心慌、胃脹、胸悶或肩頸緊，張敏言醫師會先從中醫辨證看你的體質，再用 GAD-7 記低當刻狀態，方便之後覆診比較。
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
                焦慮不一定只是「想太多」，身體其實會先出聲
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                很多人仍然照常上班、照顧家人，表面好像撐得到，但身體已經開始用胸悶、胃脹、心慌、失眠、易怒或疲倦提醒你。中醫看情緒，會連同肝、心、脾、腎和氣血一起看。
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
                有人是一有壓力就胸口頂住，有人是長期多思多慮後變得很倦，有人是夜晚特別心煩。張敏言醫師會按你的舌脈、睡眠、消化、情緒誘因和身體反應，分辨應先疏肝、養心、健脾，還是清熱化痰。
              </p>
              <div className={`${styles.sketchPanel} mt-6 rounded-[22px] p-4`}>
                <PosterTile
                  green="胸口頂住？"
                  brown="瞓極唔實？"
                  footer="望舌切脈 · 先找根源"
                  variant="posterImageTwo"
                  compact
                />
                <div className="p-1 pt-4">
                  <p className="text-sm font-semibold text-[#6f5423]">張醫師會問清楚</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5d513d]">
                    你最近點瞓、點食、個心慌唔慌、胸口有冇頂住、胃口同大便點樣，全部都值得講。再配合舌脈，先知身體究竟卡在哪裡。
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
                每次覆診，都要看你有沒有真的鬆一點
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                情緒調理不應只停留在「好似好咗啲」。我們會一起看：睡眠是否穩定一點、心悸有沒有少、胸口有沒有鬆、胃口和精神有沒有回來，擔心的程度有沒有下降。
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
                  green="瞓得唔實？"
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
                初診時可以把量表分數、最近最困擾你的事、睡眠、胃口、胸悶、心悸、月經或其他身體訊號一併告訴醫師。預約成功後，診所會以 WhatsApp 確認。
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
                GAD-7 只是幫你先記低近況。到診時，仍要把睡眠、胃口、心慌、胸悶、壓力來源和舌脈一併看清楚。
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
