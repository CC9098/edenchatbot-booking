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
  { title: "肝失疏泄", copy: "長期鬱悶、胸脅不舒、容易嘆氣或煩躁，情緒一郁，身體也跟著繃緊。" },
  { title: "心神不寧", copy: "心悸、驚醒、多夢、難以安睡，常覺心裡不踏實，像一直放不下事情。" },
  { title: "脾失健運", copy: "思慮太多後胃口差、胃脹、疲倦、精神不集中，越累越容易擔心。" },
  { title: "腎陰不足", copy: "夜晚特別焦躁、口乾、潮熱或睡眠淺，身心難以沉降下來。" },
] as const;

const tcmPatterns = [
  {
    title: "肝鬱氣滯",
    signs: "胸悶、胸脅脹、易怒、經前情緒波動、常覺一口氣頂住。",
    principle: "重點在疏肝解鬱、調暢氣機，先讓身體由「繃緊」回到可流動。",
  },
  {
    title: "心脾兩虛",
    signs: "多思多慮、心悸、失眠、健忘、疲倦、胃口差或大便偏爛。",
    principle: "重點在健脾養心、補益氣血，改善因虛弱而引起的心神不安。",
  },
  {
    title: "陰虛火旺／心腎不交",
    signs: "入睡困難、睡眠淺、手足心熱、口乾、夜晚焦躁較明顯。",
    principle: "重點在滋陰清熱、交通心腎，令晚上較容易安定下來。",
  },
  {
    title: "痰熱擾心",
    signs: "心煩、胸悶、痰多或胃脘不舒，思緒混亂，易驚易緊張。",
    principle: "重點在化痰清熱、和胃寧神，處理情緒與脾胃互相牽動。",
  },
] as const;

const tcmAssessmentPoints = [
  "舌象：舌色、舌苔厚薄、是否偏紅或齒痕，反映虛實寒熱與脾胃狀態。",
  "脈象：弦、細、滑、數等變化，可協助判斷氣滯、痰熱、陰虛或氣血不足。",
  "身體訊號：睡眠、胃口、大便、胸悶、心悸、肩頸繃緊、月經及精神狀態。",
  "情志誘因：壓力來源、擔心主題、發作時段，以及是否與工作、家庭或生活節奏有關。",
] as const;

const careSteps = [
  {
    icon: ClipboardList,
    title: "先辨情志與臟腑",
    copy: "焦慮在中醫屬情志病範圍，需看肝、心、脾、腎的失衡，以及氣、血、痰、火、陰陽的變化。",
  },
  {
    icon: Stethoscope,
    title: "望聞問切定證型",
    copy: "同樣是焦慮，有人偏肝鬱，有人偏心脾不足，有人偏陰虛火旺，治法和調理重點不應一式一樣。",
  },
  {
    icon: TrendingUp,
    title: "量表追蹤療效方向",
    copy: "GAD-7 不是取代辨證，而是用來把焦慮程度量化，覆診時配合舌脈、睡眠和身體症狀比較變化。",
  },
] as const;

const scoreBands = [
  { range: "0-4", label: "焦慮程度較低", tone: "bg-white" },
  { range: "5-9", label: "輕度焦慮症狀", tone: "bg-[#eef8ef]" },
  { range: "10-14", label: "中度焦慮症狀", tone: "bg-[#fffbeb]" },
  { range: "15-21", label: "重度焦慮症狀", tone: "bg-[#fff7ed]" },
] as const;

export const metadata: Metadata = {
  title: "廣泛性焦慮症中醫調理與 GAD-7 評估 | 張敏言醫師 | 醫天圓",
  description:
    "從中醫情志病、肝鬱、心脾兩虛、陰虛火旺等角度了解廣泛性焦慮症。使用 GAD-7 焦慮量表建立基線，預約張敏言醫師以中醫辨證及覆診追蹤跟進。",
  alternates: {
    canonical: publicUrl(pagePath),
  },
  openGraph: {
    title: "廣泛性焦慮症中醫調理與 GAD-7 評估 | 張敏言醫師",
    description:
      "以中醫情志病角度辨證，再用 GAD-7 建立焦慮基線，由張敏言醫師按症狀、體質和覆診分數持續跟進。",
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
              text: "GAD-7 是初步篩查及追蹤工具，不能代替正式診斷。中醫跟進時，分數需配合情志誘因、舌脈、睡眠、消化、心悸、胸悶及生活影響一同判斷。",
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
                中醫情志病辨證 + GAD-7 量表追蹤
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
                從中醫角度，長期擔心、失眠、心慌、胃脹、胸悶和肩頸繃緊，常與情志失調、肝失疏泄、心神不寧或脾腎不足有關。張敏言醫師會先辨證，再用 GAD-7 量表建立基線和追蹤變化。
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
              {["情志分析", "望聞問切", "量表追蹤"].map((item) => (
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
          <div className="max-w-3xl">
            <div className={`${styles.markerTag} text-sm`}>
              中醫如何看焦慮
            </div>
            <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
              焦慮不一定只是「想太多」，它可能是氣機、臟腑與心神失衡
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#496153]">
              中醫將情緒與身體視為一體。七情過度或持續太久，可影響臟腑氣血運行，出現鬱證、驚悸、不寐、胸悶、胃脹、疲倦等表現。很多香港人仍能上班和照顧家庭，但身體其實長期處於繃緊狀態。
            </p>
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
                同樣是焦慮，中醫不會只用一個方法處理
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                廣泛性焦慮症在現代診斷上有一套名稱，但中醫臨床更重視「證」。張敏言醫師會按每位病人的情志誘因、舌脈、睡眠、消化和身體反應，判斷背後屬實、屬虛、屬熱、屬痰，或多個證型互相交錯。
              </p>
              <div className={`${styles.sketchPanel} mt-6 rounded-[22px] p-5`}>
                <p className="text-sm font-semibold text-[#6f5423]">醫天圓的重點</p>
                <p className="mt-2 text-sm leading-relaxed text-[#5d513d]">
                  GAD-7 幫助量度焦慮程度；中醫辨證則幫助理解為何會焦慮、身體哪一部分失衡，以及調理方向是否需要改變。
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {tcmPatterns.map((pattern) => (
                <article key={pattern.title} className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                  <h3 className="text-lg font-extrabold text-[#0d4c2d]">{pattern.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                    <span className="font-semibold text-[#20382a]">常見表現：</span>
                    {pattern.signs}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                    <span className="font-semibold text-[#20382a]">調理思路：</span>
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
                特色是「辨證」加「量度」，一路看調理方向有沒有走對
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                情緒調理最怕只說「好似好咗啲」，但不知道是睡眠改善、心悸減少、胸悶放鬆，還是擔心程度下降。張敏言醫師會用中醫辨證定方向，再用 GAD-7 和身體症狀追蹤變化。
              </p>
              <div className="mt-6 grid gap-3">
                {tcmAssessmentPoints.map((point) => (
                  <p key={point} className={`${styles.sketchPanel} flex gap-3 rounded-[18px] p-4 text-sm leading-relaxed text-[#496153]`}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1f6b3f]" />
                    {point}
                  </p>
                ))}
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
                帶同 GAD-7 分數，預約張敏言醫師作中醫辨證
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/78">
                初診時可把量表分數、主要困擾、睡眠、胃口、胸悶、心悸、月經或其他身體訊號一併告訴醫師。預約成功後，診所會以 WhatsApp 確認。
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
                GAD-7 是初步篩查及追蹤工具，不能代替正式診斷。中醫跟進時，分數要配合舌脈、證型、症狀、持續時間和生活影響一同判斷。
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
              本頁內容只作健康教育及預約前參考。中醫辨證及 GAD-7 不能代替醫師、心理學家或精神科醫生的正式評估。如你正接受心理治療或西醫治療，請按原有醫療建議繼續跟進。
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
