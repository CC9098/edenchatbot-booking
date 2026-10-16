'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { NewsSnapshot } from '@/lib/ig-news-sync';

function formatTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '尚未同步';
}
export function IgNewsSyncClient() {
  const [snapshot, setSnapshot] = useState<NewsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/staff/ig-news', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '未能讀取同步狀態。');
      setSnapshot(body);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function sync() {
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch('/api/staff/ig-news', { method: 'POST', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '同步失敗，請稍後再試。');
      setSnapshot(body);
      setMessage(body.items.length ? `同步成功，已更新 ${body.items.length} 則消息。` : '同步成功，暫無符合條件的消息。');
    } catch (e) { setError(e instanceof Error ? e.message : '同步失敗，請稍後再試。'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-primary">IG 消息</h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">IG 帖文第一行寫標題，內文加 #醫天圓消息；重要通知再加 #置頂。</p>
      <p className="text-sm leading-7 text-slate-600">每日香港時間早上 8–9 時自動同步。首頁最多顯示 3 則；置頂優先，其餘保留 60 日。</p>
      <button type="button" disabled={busy || loading} onClick={sync} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? '同步中…' : '同步 IG 消息'}
      </button>
      <p className="mt-4 text-sm text-slate-600">上次成功同步：{loading ? '載入中…' : formatTime(snapshot?.updatedAt || null)}（香港時間）</p>
      <div role="status" aria-live="polite" className="mt-3 text-sm text-green-800">{message}</div>
      {(error || snapshot?.error) && <p role="alert" className="mt-3 text-sm text-red-700">{error || snapshot?.error}</p>}
    </section>
    {snapshot && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-primary">最近同步的消息</h2>
      {!snapshot.items.length ? <p className="mt-3 text-sm text-slate-600">暫無消息。請確認 IG 帖文已加 #醫天圓消息，並在 60 日內發佈，或加 #置頂。</p> : <ul className="mt-4 space-y-4">{snapshot.items.map(item => <li key={item.id} className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.img} alt="" className="h-24 w-20 rounded-lg object-contain" />
        <div><a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary underline">{item.title}</a>{item.pin && <span className="ml-2 text-xs text-slate-500">置頂</span>}<p className="mt-2 text-sm text-slate-500">{formatTime(item.date)}</p></div>
      </li>)}</ul>}
    </section>}
  </div>;
}
