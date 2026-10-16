// 首頁「最新消息」：由 Eden IG 帖文揀出有 #醫天圓消息 嘅帖，畀 edenclinic.hk 首頁顯示。
// 規則：#醫天圓消息 先入選；#置頂 排第一、唔受日數限制；其餘只取 maxAgeDays 日內；最多 limit 則。
// 標題 = 帖文第一句（去掉 hashtag 同開頭裝飾符號）；第一句以「：」結尾就接埋下一句。

export const NEWS_TAG = '#醫天圓消息';
export const PIN_TAG = '#置頂';

export type IgMedia = {
  id: string;
  caption?: string;
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }> };
};

export type LatestNewsItem = {
  id: string;
  title: string;
  pin: boolean;
  img: string;
  link: string;
  date: string;
};

const TITLE_MAX = 40;
const LEAD_DECOR = /^[\s*＊!！•·\-–—~～\[\]【】「」()（）\p{Extended_Pictographic}️‍]+/u;   // 開頭符號同 emoji

const hasTag = (caption: string, tag: string) =>
  caption.split(/\s+/).some((w) => w.replace(/[，,。.!！]+$/u, '') === tag);

function cleanLine(line: string): string {
  return line
    .replace(/#[^\s#]+/gu, '')
    .replace(LEAD_DECOR, '')
    .replace(/[\s\]】)）]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function captionTitle(caption: string): string {
  const lines = caption.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (!lines.length) return '';
  let title = lines[0];
  if (/[：:]$/u.test(title) && lines[1]) title = `${title}${lines[1]}`;
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

export function mediaImage(m: IgMedia): string {
  if (m.media_type === 'VIDEO') return m.thumbnail_url || '';
  if (m.media_type === 'CAROUSEL_ALBUM') {
    const kids = m.children?.data || [];
    const first = kids.find((k) => k.media_type === 'IMAGE' && k.media_url) || kids[0];
    return m.media_url || first?.media_url || first?.thumbnail_url || '';
  }
  return m.media_url || '';
}

export function selectLatestNews(
  media: IgMedia[],
  { now = new Date(), maxAgeDays = 60, limit = 3 }: { now?: Date; maxAgeDays?: number; limit?: number } = {}
): LatestNewsItem[] {
  const cutoff = now.getTime() - maxAgeDays * 864e5;
  return media
    .filter((m) => m.caption && hasTag(m.caption, NEWS_TAG))
    .map((m) => ({
      id: m.id,
      title: captionTitle(m.caption || ''),
      pin: hasTag(m.caption || '', PIN_TAG),
      img: mediaImage(m),
      link: m.permalink || '',
      date: m.timestamp || '',
      t: Date.parse(m.timestamp || '') || 0,
    }))
    .filter((x) => x.title && x.img && (x.pin || x.t >= cutoff))
    .sort((a, b) => Number(b.pin) - Number(a.pin) || b.t - a.t)
    .slice(0, limit)
    .map(({ t: _t, ...item }) => item);
}
