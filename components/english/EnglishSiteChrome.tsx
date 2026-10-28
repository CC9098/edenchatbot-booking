'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export function EnglishSiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
    }
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);
  return <><a className="skip" href="#main">Skip to content</a><header className="header">
    <a className="brand" href="/en" aria-label="Eden Clinic home"><img src="/english/assets/logo.png" alt="Eden TCM Clinic 醫天圓" width={800} height={255} /></a>
    <button ref={toggle} type="button" className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen(!open)}>Menu<span /></button>
    <nav id="main-nav" className={open ? 'is-open' : ''} aria-label="Main navigation">
      {([['care', 'Our care'], ['practitioners', 'Practitioners'], ['journal', 'Journal'], ['clinics', 'Clinics']] as const).map(([slug, title]) => <a key={slug} href={`/en/${slug}`} aria-current={path.startsWith(`/en/${slug}`) ? 'page' : undefined}>{title}</a>)}
      <a className="language" href="https://www.edenclinic.hk/" lang="zh-Hant">中文</a>
      <a className="button small" href="/en/booking?lang=en&source=eden-english-site">Book a visit<Arrow /></a>
    </nav>
  </header></>;
}

export function Arrow() {
  return <svg className="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

export function EnglishReadingProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    function update() {
      const article = document.querySelector('.eden-english .article-body');
      if (!article || !bar.current) return;
      const start = article.getBoundingClientRect().top + window.scrollY;
      const range = article.clientHeight - window.innerHeight;
      bar.current.style.width = `${range <= 0 ? (window.scrollY >= start ? 100 : 0) : Math.min(100, Math.max(0, (window.scrollY - start) / range * 100))}%`;
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, []);
  return <div ref={bar} className="reading-progress" aria-hidden="true" />;
}

/** Booking screens already provide their own main landmark. RSC children stay server rendered. */
export function EnglishMain({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return /^\/en\/(booking|manage-booking)\/?$/.test(path)
    ? <div id="main" tabIndex={-1}>{children}</div>
    : <main id="main">{children}</main>;
}
