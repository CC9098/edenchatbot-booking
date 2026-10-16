import { NextResponse } from 'next/server';

import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import { selectLatestNews, type IgMedia } from '@/lib/ig-latest-news';

// 首頁「最新消息」：讀 Eden IG 帖文（唯讀），只回傳揀好嘅三則。
// Token 只喺伺服器（EDEN_META_READ_TOKEN），唔會出現喺首頁。讀唔到就回傳空陣列，首頁會自動收埋。
// IG 圖片網址有時效（約數日），所以每小時重新攞一次。

export const revalidate = 3600;

const GRAPH = 'https://graph.facebook.com/v25.0';
const IG_ACCOUNT_ID = '17841451974830980';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}';
const ALLOWED_ORIGINS = new Set(['https://www.edenclinic.hk', 'https://edenclinic.hk']);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export async function GET(request: Request) {
  const headers = corsHeaders(request.headers.get('origin'));
  const token = process.env.EDEN_META_READ_TOKEN;
  if (!token) {
    console.error('[api/public/latest-news] EDEN_META_READ_TOKEN is not set');
    return NextResponse.json({ items: [] }, { headers });
  }
  try {
    const url = `${GRAPH}/${IG_ACCOUNT_ID}/media?fields=${encodeURIComponent(FIELDS)}&limit=30&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) throw new Error(`Graph API HTTP ${res.status}`);
    const body = (await res.json()) as { data?: IgMedia[] };
    const items = selectLatestNews(body.data || []);
    return NextResponse.json({ items, updatedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    console.error(`[api/public/latest-news] Error: ${getSafeErrorMessage(error)}`);
    return NextResponse.json({ items: [] }, { headers });
  }
}
