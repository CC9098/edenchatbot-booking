import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { newsStore } from '@/lib/ig-news-store';
import { NewsSyncError, synchronizeNews } from '@/lib/ig-news-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const snapshot = await synchronizeNews(newsStore(), randomUUID(), 'daily', null);
    return NextResponse.json({ success: true, count: snapshot.items.length, updatedAt: snapshot.updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof NewsSyncError ? error.message : 'IG sync failed' }, { status: error instanceof NewsSyncError ? error.status : 500 });
  }
}
