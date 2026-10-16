import { selectLatestNews, type IgMedia, type LatestNewsItem } from './ig-latest-news';

export type NewsSnapshot = {
  items: LatestNewsItem[];
  updatedAt: string | null;
  attemptedAt: string | null;
  error: string | null;
  source: 'manual' | 'daily' | null;
};
export class NewsSyncError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const EMPTY_NEWS: NewsSnapshot = { items: [], updatedAt: null, attemptedAt: null, error: null, source: null };
export const NEWS_SYNC_FAILURE = '同步失敗，請稍後再試；如持續失敗，請通知管理員檢查 IG 連線。';
export interface NewsSyncDependencies {
  claim(runId: string, source: 'manual' | 'daily', actor: string | null): Promise<boolean>;
  finish(runId: string, snapshot: NewsSnapshot): Promise<void>;
  fail(runId: string, message: string): Promise<void>;
  read(): Promise<NewsSnapshot>;
  fetchMedia(): Promise<IgMedia[]>;
  cacheImage(item: LatestNewsItem): Promise<string>;
}

export async function synchronizeNews(deps: NewsSyncDependencies, runId: string, source: 'manual' | 'daily', actor: string | null): Promise<NewsSnapshot> {
  if (!(await deps.claim(runId, source, actor))) throw new NewsSyncError(409, '正在同步或剛完成同步，請稍後再試。');
  try {
    const media = await deps.fetchMedia();
    const items = selectLatestNews(media);
    const cached = await Promise.all(items.map(async item => ({ ...item, img: await deps.cacheImage(item) })));
    const snapshot: NewsSnapshot = { items: cached, updatedAt: new Date().toISOString(), attemptedAt: new Date().toISOString(), error: null, source };
    await deps.finish(runId, snapshot);
    return await deps.read(); // Report success only after durable read-back.
  } catch {
    await deps.fail(runId, NEWS_SYNC_FAILURE);
    throw new NewsSyncError(502, NEWS_SYNC_FAILURE);
  }
}

export function publicNews(snapshot: NewsSnapshot, now = new Date()) {
  const cutoff = now.getTime() - 60 * 864e5;
  return {
    items: snapshot.error ? [] : snapshot.items.filter(item => item.pin || Date.parse(item.date) >= cutoff),
    updatedAt: snapshot.updatedAt,
  };
}

export async function fetchIgMedia(token: string, fetcher: typeof fetch = fetch): Promise<IgMedia[]> {
  if (!token) throw new Error('IG token missing');
  const all: IgMedia[] = [];
  let after: string | undefined;
  const signal = AbortSignal.timeout(40000);
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://graph.facebook.com/v25.0/17841451974830980/media');
    url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal });
    if (!response.ok) throw new Error(`IG HTTP ${response.status}`);
    const body = await response.json() as { data?: IgMedia[]; paging?: { next?: string; cursors?: { after?: string } } };
    if (!Array.isArray(body.data)) throw new Error('Invalid IG response');
    all.push(...body.data);
    if (!body.paging?.next) return all;
    // Never follow API-returned URLs containing tokens; reconstruct using only its cursor.
    const cursor = body.paging.cursors?.after;
    if (!cursor || cursor === after) throw new Error('Invalid IG cursor');
    after = cursor;
  }
  throw new Error('IG pagination incomplete'); // Do not publish a truncated snapshot that could omit a pinned post.
}

export async function downloadNewsImage(url: string, fetcher: typeof fetch = fetch): Promise<{ bytes: Buffer; type: string }> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !['cdninstagram.com', 'fbcdn.net'].some(host => u.hostname === host || u.hostname.endsWith(`.${host}`))) throw new Error('Invalid IG image host');
  const res = await fetcher(u, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  const type = (res.headers.get('content-type') || '').split(';')[0];
  if (!res.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type) || !res.body) throw new Error('Invalid IG image');
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 10 * 1024 * 1024) throw new Error('IG image too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  if (!length) throw new Error('Empty IG image');
  return { bytes: Buffer.concat(chunks), type };
}
