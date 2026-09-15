import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Plus } from "lucide-react";
import { jsonLd, publicUrl, SITE_NAME } from "@/lib/structured-data";
import { ReadingGuide } from "./ReadingGuide";
import styles from "./page.module.css";

const pagePath = "/dr-lee-chin-lam";
const portrait = "/doctor-avatars/clean/lee.webp";
const bookingHref = "/booking?doctor=lee&source=dr-lee-profile";
const articleHref = "https://www.edenclinic.hk/2024/03/autonomic-nervous-system-disorder/";
const blogHref = "https://www.edenclinic.hk/blog/dr-lee-chin-lam/";
const teamHref = "https://www.edenclinic.hk/關於我們/醫師簡歷及應診時間/";
const description = "認識醫天圓註冊中醫師李芊霖，從自律神經、睡眠、壓力與飲食相關文章開始，了解中醫觀點、醫師學歷及網上預約安排。";

export const metadata: Metadata = {
  title: "李芊霖中醫師｜自律神經、睡眠與飲食專題",
  description,
  alternates: { canonical: publicUrl(pagePath) },
  openGraph: {
    type: "website",
    title: "李芊霖中醫師｜睡眠、壓力與身體不適",
    description,
    url: publicUrl(pagePath),
    siteName: SITE_NAME,
    locale: "zh_HK",
    images: [{ url: publicUrl(portrait), width: 512, height: 512, alt: "李芊霖註冊中醫師" }],
  },
  twitter: {
    card: "summary",
    title: "李芊霖中醫師｜自律神經、睡眠與飲食專題",
    description,
    images: [publicUrl(portrait)],
  },
};

export default function DrLeePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${publicUrl(pagePath)}#profile`,
    url: publicUrl(pagePath),
    name: "李芊霖中醫師｜自律神經、睡眠與飲食專題",
    description,
    inLanguage: "zh-Hant-HK",
    mainEntity: {
      "@type": "Person",
      "@id": `${publicUrl(pagePath)}#doctor`,
      name: "李芊霖",
      jobTitle: "註冊中醫師",
      image: publicUrl(portrait),
      url: publicUrl(pagePath),
      sameAs: [blogHref],
      worksFor: { "@id": publicUrl("/#organization"), name: SITE_NAME },
      alumniOf: [
        { "@type": "CollegeOrUniversity", name: "香港浸會大學" },
        { "@type": "CollegeOrUniversity", name: "香港中文大學" },
      ],
    },
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <a href="#main-content" className={styles.skipLink}>跳至主要內容</a>
      <header className={styles.header}>
        <a className={styles.brand} href="https://www.edenclinic.hk/">
          <Image src="/logo-eden.png" alt="醫天圓中醫診所" width={38} height={38} />
          <span>醫天圓<span className={styles.brandEnglish}>EDEN TCM CLINIC</span></span>
        </a>
        <nav aria-label="頁面導覽" className={styles.navigation}>
          <a href="#reading">閱讀專題</a>
          <a href="#doctor">醫師簡介</a>
          <Link href={bookingHref} className={styles.navBooking} prefetch={false}>查看應診時段 <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </header>

      <section className={styles.hero} id="main-content" aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>李芊霖 · 註冊中醫師</p>
          <h1 id="hero-title">睡眠、壓力<br />與<span>身體不適</span></h1>
          <p className={styles.heroSubtitle}>從日常線索，逐步了解。</p>
          <p className={styles.heroDescription}>睡不安穩、容易疲倦，或總覺得身體繃緊？<br className={styles.desktopBreak} />從中醫與飲食角度，認識身體的不同表現。</p>
          <div className={styles.actions}>
            <Link href={bookingHref} className={styles.primaryButton} prefetch={false}>預約李芊霖醫師 <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#autonomic" className={styles.textButton}>先了解自律神經 <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <p className={styles.heroFootnote}>自律神經 · 睡眠 · 日常飲食</p>
        </div>
        <div className={styles.portraitCard}>
          <div className={styles.portraitFrame}>
            <Image src={portrait} alt="李芊霖中醫師肖像" width={512} height={512} priority sizes="(max-width: 700px) 88vw, 410px" />
          </div>
          <div className={styles.portraitCaption}>
            <div><p>DR. LEE</p><h2>李芊霖<span>中醫師</span></h2></div>
            <a href="#doctor" aria-label="認識李芊霖中醫師"><ArrowDown size={22} aria-hidden="true" /></a>
          </div>
        </div>
      </section>

      <section id="autonomic" className={styles.feature} aria-labelledby="autonomic-title">
        <div className={styles.sectionLabel}><span>01 / 專題閱讀</span><span>自律神經</span></div>
        <div className={styles.featureGrid}>
          <div>
            <h2 id="autonomic-title">身體的訊號，<br />可以從哪裏看起？</h2>
            <p>睡不好、心悸、出汗或腸胃不適，可以有不同成因。是否與自律神經有關，需要結合病史及適當檢查評估。</p>
            <a href={articleHref} className={styles.featureLink}>閱讀李醫師的自律神經專題 <ArrowUpRight size={20} aria-hidden="true" /></a>
          </div>
          <div className={styles.featureTopics}>
            <div><span>01</span><section><h3>症狀與成因</h3><p>認識自律神經的作用，了解常見症狀與相關問題。</p></section></div>
            <div><span>02</span><section><h3>睡眠與生活</h3><p>把作息、壓力與飲食，放回日常生活的脈絡中理解。</p></section></div>
            <div><span>03</span><section><h3>中醫辨證角度</h3><p>閱讀中醫對不同身體表現的理解，作為與醫師討論的起點。</p></section></div>
          </div>
        </div>
        <p className={styles.medicalNote}>如有突發或持續嚴重胸痛、呼吸困難或暈厥，應立即求醫。</p>
      </section>

      <section id="reading" className={styles.section} aria-labelledby="reading-title">
        <div className={styles.sectionLabel}><span>02 / 李醫師文章選讀</span><a href={blogHref}>所有文章 <ArrowUpRight size={15} aria-hidden="true" /></a></div>
        <h2 id="reading-title">由你關心的問題，<br />繼續讀下去。</h2>
        <ReadingGuide />
      </section>

      <section id="doctor" className={`${styles.section} ${styles.doctorSection}`} aria-labelledby="doctor-title">
        <div className={styles.doctorIntro}>
          <p className={styles.eyebrow}>03 / 醫師簡介</p>
          <h2 id="doctor-title">李芊霖<span>註冊中醫師</span></h2>
          <p>李醫師的文章涵蓋自律神經、睡眠、飲食及婦科等健康題目，從中醫角度介紹疾病知識與日常生活的關係。</p>
          <a href={teamHref} className={styles.textButton}>查看診所醫師資料 <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <div className={styles.qualifications}>
          <p>學歷</p>
          <div><span>香港浸會大學</span><strong>中醫學碩士</strong></div>
          <div><span>香港中文大學</span><strong>中醫學學士</strong></div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <div className={styles.faqGrid}>
          <div><p className={styles.eyebrow}>看診前了解</p><h2 id="faq-title">常見問題</h2></div>
          <div className={styles.faqList}>
            <details><summary>有這些症狀，就是自律神經失調嗎？<Plus size={18} aria-hidden="true" /></summary><p>不能單憑症狀確定。失眠、心悸、疲倦等表現可能有不同原因，醫師需了解病史、用藥及相關檢查，再判斷是否需要進一步評估。</p></details>
            <details><summary>第一次看診可以帶甚麼資料？<Plus size={18} aria-hidden="true" /></summary><p>可帶備近期檢查報告及正在服用的藥物、保健品清單。也可簡單記下不適出現的時間、持續多久，以及睡眠和飲食上的變化。</p></details>
            <details><summary>怎樣查看李醫師的應診地點與時間？<Plus size={18} aria-hidden="true" /></summary><p>按「查看應診時段」進入預約頁，系統會預先選擇李芊霖醫師。應診地點、可選日期及時間以預約頁的最新安排為準。</p></details>
          </div>
        </div>
      </section>

      <section className={styles.bookingSection} aria-labelledby="booking-title">
        <p className={styles.eyebrow}>李芊霖 · 註冊中醫師</p>
        <h2 id="booking-title">讓個人情況，<br />在診症中進一步了解。</h2>
        <p>查看應診地點與時段，選擇合適的預約安排。</p>
        <Link href={bookingHref} className={styles.primaryButton} prefetch={false}>查看應診時段 <CalendarDays size={18} aria-hidden="true" /></Link>
      </section>
      <footer className={styles.footer}>
        <a href="https://www.edenclinic.hk/">醫天圓中醫診所</a>
        <p>本頁及所連結文章供健康教育參考，不能取代個別診斷或治療建議。</p>
        <a href={blogHref}>李醫師文章專欄 <ArrowUpRight size={14} aria-hidden="true" /></a>
      </footer>
    </main>
  );
}
