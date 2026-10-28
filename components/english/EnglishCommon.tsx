import type { ReactNode } from 'react';
import { Arrow } from './EnglishSiteChrome';
import { ArticleCard } from './EnglishArticleCard';
export { ArticleCard, Artwork } from './EnglishArticleCard';
import { articleHeadingId, englishBookingUrl, englishDoctors, type EnglishArticle } from '@/content/english/site';

export function TextLink({ href, children, button = false, light = false }: { href: string; children: ReactNode; button?: boolean; light?: boolean }) {
  return <a className={button ? (light ? 'button light' : 'button') : 'text-link'} href={href}>{children}<Arrow /></a>;
}
export function Breadcrumb({ title, parent = 'Home', href = '/en' }: { title: string; parent?: string; href?: string }) {
  return <nav className="breadcrumb" aria-label="Breadcrumb"><a href={href}>{parent}</a><span>/</span><span>{title}</span></nav>;
}
export function Intro({ title, description, crumb, action }: { title: ReactNode; description: string; crumb?: ReactNode; action?: ReactNode }) {
  return <section className="page-intro wrap">{crumb}<h1>{title}</h1><p className="lede">{description}</p>{action}</section>;
}
export function DoctorCard({ id }: { id: string }) {
  const doctor = englishDoctors.find(item => item.id === id)!;
  return <a className="doctor-card" href={`/en/practitioners/${doctor.id}`}><div className="portrait"><img src={`/english/assets/${doctor.id}.webp`} alt={`${doctor.name} ${doctor.zh}`} width={512} height={512} loading="lazy" /></div><div className="doctor-caption"><h3>{doctor.name} <span lang="zh-Hant">{doctor.zh}</span></h3><Arrow /><p>{doctor.role}</p></div></a>;
}
export function Prose({ text }: { text: string }) {
  const blocks: { heading?: string; paragraph?: string }[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push({ paragraph: paragraph.join(' ') }); paragraph = []; } };
  for (const line of text.trim().split('\n')) {
    if (line.startsWith('## ')) { flush(); blocks.push({ heading: line.slice(3).trim() }); }
    else if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return <>{blocks.map((block, index) => block.heading ? <h2 key={index} id={articleHeadingId(block.heading)}>{block.heading}</h2> : <p key={index}>{block.paragraph}</p>)}</>;
}
export function FurtherReading({ articles }: { articles: EnglishArticle[] }) {
  return <section className="section wrap"><div className="section-head"><h2>Further reading</h2><TextLink href="/en/journal">All articles</TextLink></div><div className="article-grid">{articles.map(article => <ArticleCard key={article.id} article={article} />)}</div></section>;
}
export function EnglishFooter() {
  return <footer><div className="footer-top"><p className="footer-title">Good care.<br /><em>Close to home.</em></p><div><p>Chinese medicine in Hong Kong.</p><TextLink href={englishBookingUrl()} button light>Find your appointment</TextLink></div></div><div className="footer-links"><a href="/en/about">About Eden</a><a href="/en/fees">Fees &amp; payment</a><a href="/en/first-visit">Your first visit</a><a href="/en/privacy-policy">Privacy policy</a><a href="/en/research">Research library</a><a href="/en/clinics">Contact the clinics</a><a href="https://www.edenclinic.hk/" lang="zh-Hant">繁體中文</a><a href="/en/manage-booking?lang=en">Manage a booking</a></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Eden TCM Clinic · 醫天圓中醫診所</span><span>Central · Jordan · Tsuen Wan</span></div></footer>;
}
