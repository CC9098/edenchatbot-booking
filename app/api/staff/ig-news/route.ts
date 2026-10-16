import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AuthError, getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { newsStore } from '@/lib/ig-news-store';
import { NewsSyncError, synchronizeNews } from '@/lib/ig-news-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
async function staff() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, '請先登入職員後台。');
  await requireStaffRole(user.id);
  return user.id;
}
function failure(error: unknown) {
  if (error instanceof AuthError || error instanceof NewsSyncError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  return NextResponse.json({ error: '未能讀取或同步 IG 消息，請稍後再試。' }, { status: 500, headers });
}
export async function GET() {
  try { await staff(); return NextResponse.json(await newsStore().read(), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await staff();
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new AuthError(403, '請從職員後台同步。');
    const snapshot = await synchronizeNews(newsStore(), randomUUID(), 'manual', actor);
    return NextResponse.json({ ...snapshot, success: true }, { headers });
  } catch (error) { return failure(error); }
}
