import { NextResponse } from 'next/server';
import { newsStore } from '@/lib/ig-news-store';
import { publicNews } from '@/lib/ig-news-sync';

export const dynamic = 'force-dynamic';
const ALLOWED_ORIGINS = new Set(['https://www.edenclinic.hk', 'https://edenclinic.hk']);
export async function GET(request: Request) {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  try { return NextResponse.json(publicNews(await newsStore().read()), { headers }); }
  catch { return NextResponse.json({ items: [], updatedAt: null }, { headers }); }
}
