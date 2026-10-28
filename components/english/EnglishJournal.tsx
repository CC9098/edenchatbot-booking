'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArticleCard, type JournalArticle } from './EnglishArticleCard';

type Topic = { category: string; slug: string };
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim();

export function EnglishJournal({ articles, topics }: { articles: JournalArticle[]; topics: Topic[] }) {
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All topics');
  const [page, setPage] = useState(1);
  const [ready, setReady] = useState(false);
  const count = useRef<HTMLParagraphElement>(null);
  const input = useRef<HTMLInputElement>(null);
  function restoreFromUrl() {
    const query = new URLSearchParams(window.location.search);
    setSearch(query.get('q') || '');
    setTopic(topics.some(item => item.category === query.get('topic')) ? query.get('topic')! : 'All topics');
    setPage(Math.max(1, Number.parseInt(query.get('page') || '1', 10) || 1));
    setReady(true);
  }
  useEffect(() => {
    restoreFromUrl();
    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  // Topic definitions are stable imported content.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const index = useMemo(() => articles.map(article => ({ article, search: normalize(`${article.title} ${article.description} ${article.category} ${article.body}`) })), [articles]);
  const matches = useMemo(() => {
    const terms = normalize(search).split(/\s+/).filter(Boolean);
    return index.filter(item => (topic === 'All topics' || item.article.category === topic) && terms.every(term => item.search.includes(term))).map(item => item.article);
  }, [index, search, topic]);
  const totalPages = Math.max(1, Math.ceil(matches.length / 12));
  const actualPage = Math.min(page, totalPages);
  const visibleIds = new Set(matches.slice((actualPage - 1) * 12, actualPage * 12).map(article => article.id));
  useEffect(() => {
    if (!ready) return;
    const query = new URLSearchParams();
    if (search.trim()) query.set('q', search);
    if (topic !== 'All topics') query.set('topic', topic);
    if (actualPage > 1) query.set('page', String(actualPage));
    window.history.replaceState(null, '', `${window.location.pathname}${query.size ? `?${query}` : ''}`);
  }, [search, topic, actualPage, ready]);
  function turnPage(delta: number) {
    setPage(actualPage + delta);
    count.current?.scrollIntoView({ block: 'center' });
    count.current?.focus({ preventScroll: true });
  }
  return <section className="wrap journal-index">
    <div className="journal-tools"><label className="search"><span>Search the journal</span><input ref={input} id="article-search" type="search" placeholder="Try cough, sleep or period pain…" autoComplete="off" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
      <nav className="filters" aria-label="Article topics">{[{ category: 'All topics', slug: '' }, ...topics].map(item => <a key={item.category} href={item.slug ? `/en/journal/topics/${item.slug}` : '/en/journal'} data-filter={item.category} aria-current={topic === item.category ? 'true' : undefined} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); setTopic(item.category); setPage(1); }}>{item.category}</a>)}</nav>
      <p ref={count} id="result-count" role="status" aria-live="polite" tabIndex={-1}>{matches.length} article{matches.length === 1 ? '' : 's'}{matches.length ? ` · Showing ${(actualPage - 1) * 12 + 1}–${Math.min(actualPage * 12, matches.length)}` : ''}</p>
    </div>
    <div className="article-grid" id="article-results">{articles.map(article => <ArticleCard key={article.id} article={article} hidden={ready && !visibleIds.has(article.id)} />)}</div>
    <nav id="journal-pagination" className="journal-pagination" aria-label="Article pages" hidden={!ready || totalPages === 1}><button className="button light" type="button" disabled={actualPage === 1} onClick={() => turnPage(-1)}>Previous</button><span id="page-status">Page {actualPage} of {totalPages}</span><button className="button" type="button" disabled={actualPage === totalPages} onClick={() => turnPage(1)}>Next</button></nav>
    <div id="no-results" hidden={matches.length > 0}><h2>No articles found</h2><p>Try another word or choose a different topic.</p><button className="button" onClick={() => { setSearch(''); setTopic('All topics'); setPage(1); input.current?.focus(); }}>Clear search &amp; filters</button></div>
  </section>;
}
