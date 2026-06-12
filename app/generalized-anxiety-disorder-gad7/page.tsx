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
const doctorAvatar = "/images/doctors/cheungmy-gad-real.jpg";
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
  title: "廣泛性焦慮症：卡在想求助與想逃避之間 | 張敏言醫師 | 醫天圓",
  description:
    "懷疑自己有廣泛性焦慮症，卻遲遲不敢求醫？張敏言醫師從中醫角度說明焦慮、失眠、心悸、胃腸不適與臨床調理方向。",
  alternates: {
    canonical: publicUrl(pagePath),
  },
  openGraph: {
    title: "廣泛性焦慮症：卡在想求助與想逃避之間 | 張敏言醫師",
    description:
      "當焦慮令你想求助又想逃避，中醫或許可以成為比較容易踏出的第一道門。",
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
          "介紹廣泛性焦慮症患者常見的求助阻力、中醫第一步調理、GAD-7 初步評估及張敏言醫師臨床醫案。",
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
                懷疑自己有廣泛性焦慮症？
              </div>
              <h1 className={`${styles.brushTitle} mt-5 text-[2.75rem] sm:text-6xl lg:text-[5.35rem]`}>
                <span className={styles.brushGreen}>想求助，</span>
                <br />
                <span className={styles.brushBrown}>又想逃避？</span>
                <br />
                <span className="block text-[0.82em]">先從身體</span>
                <span className={`${styles.highlightStroke} block w-fit whitespace-nowrap`}>鬆一點開始</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#496153]">
                當腦海停不下來，身體又出現失眠、心悸、胃脹、胸悶或慢性疲倦，求助本身也會變成壓力。張敏言醫師會先從中醫辨證了解身體狀態，再配合 GAD-7 記錄近況，讓第一步不必那麼沉重。
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

            <div className="grid max-w-2xl grid-cols-3 gap-3 sm:gap-4">
              {["問清壓力", "看舌切脈", "覆診跟進"].map((item) => (
                <div key={item} className={`${styles.roundSeal} flex min-h-20 items-center justify-center p-3 text-center sm:min-h-24`}>
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
        <article className="mx-auto max-w-4xl">
          <p className={`${styles.markerTag} text-sm`}>張敏言醫師文章</p>
          <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
            懷疑自己有廣泛性焦慮症，是否也卡在「想求助」與「想逃避」之間？
          </h2>

          <div className="mt-7 space-y-5 text-base leading-relaxed text-[#496153]">
            <p>
              每天清晨，鬧鐘還沒響，你可能就已經在一陣莫名心悸或胃部翻騰中醒來。腦海裡自動開啟了無數個無限循環的劇本：「萬一今天簡報搞砸了怎麼辦？」「身體這陣子一直頭痛，是不是得了什麼絕症？」「剛剛同事的眼神，是不是我說錯了什麼話？」
            </p>
            <p>
              這種毫無理由、無法關閉的過度擔憂，加上長期失眠、肌肉緊繃、慢性疲勞，讓你筋疲力竭。你在心裡偷偷搜尋過無數次，每一個症狀都指向了同一個名詞：廣泛性焦慮症，Generalized Anxiety Disorder，GAD。
            </p>
            <p>
              你懷疑自己生病了，但每當想到「看醫生」，內心深處卻湧起更大的抗拒。
            </p>
          </div>

          <div className="mt-8 rounded-[26px] border border-[#d7c6a7] bg-[#fffaf0] p-6 sm:p-8">
            <h3 className="text-2xl font-semibold text-[#0d4c2d]">
              為甚麼你懂，卻遲遲不想看精神科醫生或心理醫生？
            </h3>
            <p className="mt-4 text-base leading-relaxed text-[#496153]">
              不想就醫，並非因為你不想好起來，而是「焦慮」本身就在你和醫院之間築起了一道高牆。
            </p>

            <div className="mt-6 grid gap-4">
              <div className={`${styles.sketchPanel} rounded-[22px] p-5`}>
                <h4 className="text-lg font-extrabold text-[#0d4c2d]">無止境的災難化思考</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  你的大腦開始恐嚇你：「如果確診了，我是不是就變成精神病患？」「吃西藥會不會上癮？會不會讓我大腦變遲鈍、變成失去情感的喪屍？」
                </p>
              </div>
              <div className={`${styles.sketchPanel} rounded-[22px] p-5`}>
                <h4 className="text-lg font-extrabold text-[#0d4c2d]">高功能者的完美主義與恥辱感</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  習慣掌控一切、在工作上拼命的你，無法接受自己「失控」了。你對自己說「這只是壓力大、是我抗壓性太差」，試圖用意志力硬撐，認為去看心理醫生就是承認自己是一個失敗者。
                </p>
              </div>
              <div className={`${styles.sketchPanel} rounded-[22px] p-5`}>
                <h4 className="text-lg font-extrabold text-[#0d4c2d]">以為只是身體生病</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  心悸、胃痛、自律神經失調的症狀太過真實，你寧可頻繁出入家醫科、心臟科、腸胃科，也不願面對這一切其實源自大腦與心靈的呼救。
                </p>
              </div>
            </div>

            <p className="mt-6 text-base leading-relaxed text-[#496153]">
              於是，你陷入了「極度焦慮 / 想求助 / 面對就醫更焦慮 / 選擇逃避」的惡性循環，任由症狀將你吞噬。
            </p>
          </div>

          <div className="mt-8 space-y-5 text-base leading-relaxed text-[#496153]">
            <h3 className="text-2xl font-semibold text-[#0d4c2d]">中醫，或許能成為你最溫柔的「第一道門」</h3>
            <p>
              如果你真的跨不出那一步去西醫身心科或心理諮商，請不要就此放棄。在醫療的十字路口上，中醫，其實是一個能讓你卸下所有防備的溫柔起點。
            </p>
            <p>
              說一句「我最近睡不好，去中醫調一下身體」，在華人社會中再自然不過。中醫診所明亮、溫馨的氛圍，沒有任何精神疾病的標籤，能讓你比較沒有病恥感地走進去接受照顧。
            </p>
            <p>
              中醫講求「形神一體」，你的失眠、胸悶、胃潰瘍、肌肉緊繃，在中醫眼裡不是分開的疾病，而是身體失衡的綜合表現。
            </p>
            <p>
              在西醫裡，你可能覺得是自己心理軟弱；但在中醫的把脈問診中，情緒問題可以被理解為「氣血不順、臟腑失調」。它溫柔地告訴你：這不是你的錯，不是你想太多，只是身體暫時失衡了，調回來就好。
            </p>
            <p>
              中醫的治療能帶來身體放鬆。當醫師在太衝、神門、內關等穴位扎上針，或者進行溫和的推拿時，原本緊繃到極點的身體有機會慢慢放下防備。配合酸棗仁湯、柴胡疏肝散等中藥調理，能讓害怕西藥副作用的你，重新點燃對醫療的信任。
            </p>
            <p>
              讓中醫成為第一道門，最大的價值在於「打破僵局」。它不強迫你立刻面對最赤裸的心理創傷，而是透過調配中藥、針灸，以及中醫師在把脈時溫和的傾聽與疏導，先幫你的身體減壓。當你的身體不再那麼緊繃、晚上終於能睡個好覺時，你那被焦慮綁架的大腦，自然就會騰出空間來恢復理智。
            </p>
          </div>
        </article>
      </section>

      <section className={`${styles.sectionBand} bg-[#fffaf0]/70 px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,0.7fr)] lg:items-start">
            <div>
              <p className={`${styles.markerTag} text-sm`}>4 至 8 週觀察</p>
              <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
                跨出這一步，讓復原的齒輪開始轉動
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#496153]">
                在接受中醫調理的過程中，通常建議給予 4 至 8 週的觀察期。你可以透過以下三個層面，客觀評估中醫是否切實改善了你的狀況。
              </p>
            </div>

            <div className="grid gap-4">
              <article className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                <h3 className="text-lg font-extrabold text-[#0d4c2d]">睡眠與體力</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  入睡困難、半夜易醒，或是惡夢連連的狀況是否有減輕？早起時是否開始覺得身體有充電感，而不是越睡越累？
                </p>
              </article>
              <article className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                <h3 className="text-lg font-extrabold text-[#0d4c2d]">軀體症狀的緩解</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  原本頻繁出現的心悸、胸悶、莫名的小腹緊繃、胃脹胃痛，或是肩頸酸痛，發作的頻率和劇烈程度是否有下降？
                </p>
              </article>
              <article className={`${styles.sketchPanel} rounded-[24px] p-5`}>
                <h3 className="text-lg font-extrabold text-[#0d4c2d]">情緒的彈性</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#496153]">
                  面對同樣的日常壓力源時，你是否發現自己「比較踩得住煞車」？雖然可能還是會擔憂，但大腦是否開始能從「災難化思考」的死胡同裡轉彎，不再那麼容易陷入恐慌或崩潰？
                </p>
              </article>
            </div>
          </div>

          <div className="mt-8 rounded-[24px] border border-[#fed7aa] bg-[#fff7ed] p-5 text-[#7c2d12]">
            <p className="font-semibold">何時需要進一步評估？</p>
            <p className="mt-2 text-sm leading-relaxed">
              如果以上三個答案都是肯定的，代表中醫調理可能適合你，可以安心跟隨中醫師的步伐繼續穩定治療。如果穩定治療一段時間後，經過 1 到 2 個月的規律服藥與針灸，失眠、恐慌或無法停止的焦慮感依然完全沒有減輕，甚至持續惡化，這不是中醫不好，而是身體在提醒你應尋求西醫身心科、精神科或心理諮商的進一步專業評估。正在服用精神科藥物者，切勿自行停藥或突然減量。
            </p>
          </div>
        </div>
      </section>

      <section className={`${styles.sectionBand} px-5 py-14 sm:px-8 lg:px-12`}>
        <div className="mx-auto max-w-6xl">
          <p className={`${styles.markerTag} text-sm`}>臨床醫案</p>
          <h2 className={`${styles.brushUnderline} mt-5 inline-block text-3xl font-semibold leading-tight text-[#0d4c2d] sm:text-4xl`}>
            廣泛性焦慮症伴腸胃功能紊亂
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#496153]">
            以下醫案已作去識別化處理，只供臨床思路分享，不能自行照方服用。
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.62fr)]">
            <div className={`${styles.sketchPanel} rounded-[26px] p-6`}>
              <h3 className="text-xl font-semibold text-[#0d4c2d]">患者概況與臨床表現</h3>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#496153]">
                <p>
                  男性，廣泛性焦慮症病史多年，長期服用精神科藥物，近半年症狀加重。
                </p>
                <p>
                  睡眠極淺易醒，醒後疲憊更甚於未睡。日間極度困倦，全身沉重，頭腦昏蒙，記憶力與專注力明顯下降。
                </p>
                <p>
                  情緒鬱悶焦慮、易怒而強忍，夜間精神亢奮難以入眠，伴情緒性暴食。胃腸症狀突出，頻繁噯氣，食後腹脹絞痛，飯後極度睏倦，需深睡半至一小時；便秘數日一行，矢氣多。
                </p>
                <p>
                  舌體胖大有齒痕，舌質淡白，苔略厚而水滑。
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <div className={`${styles.sketchPanel} rounded-[26px] p-6`}>
                <h3 className="text-xl font-semibold text-[#0d4c2d]">診斷與辨證</h3>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#496153]">
                  <p>
                    <span className="font-semibold text-[#20382a]">西醫診斷：</span>
                    廣泛性焦慮症，伴腸胃功能紊亂、慢性便秘。
                  </p>
                  <p>
                    <span className="font-semibold text-[#20382a]">中醫診斷：</span>
                    鬱證兼便秘。
                  </p>
                  <p>
                    <span className="font-semibold text-[#20382a]">證型：</span>
                    少陽樞機不利，兼陽明腑實。
                  </p>
                  <p>
                    患者長期焦慮、易怒強忍、情緒性暴食、夜間亢奮難眠，為肝鬱氣滯、少陽樞機不利之象。肝鬱乘脾，脾虛濕盛，故見飯後極度睏倦、全身沉重乏力、舌胖齒痕、苔水滑。濕鬱化熱，痰熱內擾，則睡眠淺易醒、煩躁怕熱、便秘裡急後重。怕熱而手心冷，為陽鬱不達四末之陰陽失調。綜合腹脹便秘與裡急後重，正屬少陽陽明合病。
                  </p>
                </div>
              </div>

              <div className={`${styles.sketchPanel} rounded-[26px] p-6`}>
                <h3 className="text-xl font-semibold text-[#0d4c2d]">治法與方藥</h3>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#496153]">
                  <p>
                    治以和解少陽、鎮驚安神，兼輕下熱結、行氣除滿。
                  </p>
                  <p>
                    予柴胡桂枝龍骨牡蠣湯合小承氣湯加減。方中柴胡、黃芩疏解少陽鬱熱；小承氣湯中大黃、厚朴、枳實通腑泄熱、行氣導滯；桂枝通陽化氣以達四末；龍骨、牡蠣重鎮安神、收斂浮陽；白芍、甘草酸甘化陰、緩急止痛、養血柔肝；石菖蒲化痰開竅、醒脾安神；香附加強疏肝解鬱；天花粉清熱生津，兼防便秘傷陰。全方共奏和解少陽、通腑安神、理氣化痰之功。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-[#d7c6a7] bg-[#fffaf0] p-6 sm:p-8">
            <h3 className="text-xl font-semibold text-[#0d4c2d]">治療結果與醫者按</h3>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-[#496153]">
              <p>
                患者初診後即見睡眠改善、大便通暢、精神轉佳，顯示方證相應。本病根於肝鬱脾虛、痰熱內擾，調治需時，宜堅持 3 至 6 個月以固其本。
              </p>
              <p>
                囑續用西藥，切勿驟停。症狀偶有反覆，乃正虛復邪之常，無礙整體向愈。
              </p>
              <p>
                本例體現《傷寒論》「觀其脈證，知犯何逆，隨證治之」之旨，尤其適合伴有明顯軀體症狀，如胃腸、睡眠、疲勞的焦慮症患者。臨床應用時應根據即時舌脈調整藥物比例，並可配合針灸，如百會、印堂、內關、神門，以加速控症，體現「針藥並用」之綜合治療策略。
              </p>
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
