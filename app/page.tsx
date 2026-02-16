import ChatWidget from '@/components/ChatWidget';
import Link from 'next/link';
import { listPublishedArticles, listPublishedCourses } from '@/lib/content-service';

export const dynamic = 'force-dynamic';

function formatDate(date: string): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default async function Home() {
  const [articles, courses] = await Promise.all([listPublishedArticles(4), listPublishedCourses(4)]);

  return (
    <main className="relative min-h-screen bg-primary-pale text-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-20">
        <section className="rounded-3xl border border-primary/15 bg-white/85 p-6 shadow-sm sm:p-8">
          <div className="max-w-4xl space-y-6">
            <p className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              醫天圓中醫診所 · 一站式內容 + AI + 預約
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-primary sm:text-5xl">
              電子課程、健康文章、AI 諮詢與預約 已在同一平台
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
              你可以先閱讀文章、再睇課程、即時用 AI 追問，最後直接完成預約。右下角浮動按鈕可隨時打開醫天圓小助手。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/articles"
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
              >
                閱讀健康文章
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
              >
                進入電子課程
              </Link>
              <Link
                href="/booking"
                className="inline-flex items-center rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
              >
                立即預約 / AI 諮詢
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary-light bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-primary">已發佈文章</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{articles.length}</p>
            <p className="mt-1 text-sm text-slate-600">由 Supabase 內容庫讀取</p>
          </div>
          <div className="rounded-2xl border border-primary-light bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-primary">已發佈課程</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{courses.length}</p>
            <p className="mt-1 text-sm text-slate-600">內容、課堂與 AI 導流整合</p>
          </div>
          <div className="rounded-2xl border border-primary-light bg-white/90 p-4 shadow-sm">
            <p className="text-xs font-semibold tracking-wide text-primary">互動入口</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">文章 → AI → 預約</p>
            <p className="mt-1 text-sm text-slate-600">同一網址完成整個流程</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-primary">最新健康文章</h2>
            <Link href="/articles" className="text-sm font-medium text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
          {articles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              暫時未有已發佈文章，請到醫師後台「文章管理」新增內容。
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.slug}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-medium text-slate-500">{formatDate(article.publishedAt)}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{article.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{article.excerpt || '點擊閱讀全文'}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-primary">最新電子課程</h2>
            <Link href="/courses" className="text-sm font-medium text-primary hover:underline">
              查看全部 →
            </Link>
          </div>
          {courses.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              暫時未有已發佈課程，請先在內容庫新增課程資料。
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-medium text-slate-500">{formatDate(course.publishedAt)}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{course.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {course.descriptionMd || '點擊查看課程內容'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
      <ChatWidget />
    </main>
  );
}
