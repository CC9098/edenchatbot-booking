import ChatWidget from '@/components/ChatWidget';
import Link from 'next/link';
import { listPublishedArticles, listPublishedCourses } from '@/lib/content-service';
import { createServerClient } from "@/lib/supabase-server";
import { isNativeAppUserAgent } from "@/lib/platform";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  CalendarCheck2,
  GraduationCap,
  Sparkles,
} from "lucide-react";

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
  const userAgent = headers().get("user-agent") ?? "";
  if (isNativeAppUserAgent(userAgent)) {
    redirect("/chat");
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/chat");
  }

  const [articles, courses] = await Promise.all([listPublishedArticles(4), listPublishedCourses(4)]);

  return (
    <main className="relative min-h-screen bg-primary-pale text-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-24 pt-16 sm:px-10 sm:pb-32 sm:pt-20">
        <div className="flex justify-end">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary-light"
          >
            會員 / 醫師登入
          </Link>
        </div>

        <section className="grid gap-6 rounded-3xl border border-primary/15 bg-white/90 p-6 shadow-sm sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="max-w-4xl space-y-6">
            <p className="inline-flex items-center rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
              醫天圓中醫診所 · 病人入口
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-primary sm:text-5xl">
              身體有疑問，先問 AI；準備好，就直接預約
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
              首頁只保留兩條主要路線：如果你想快啲約診，直接揀時段；如果你仲未肯定，先用 AI 梳理情況，再轉去預約。文章同課程會放喺後面慢慢睇，唔會阻住你開始。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/booking"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover"
              >
                <CalendarCheck2 className="h-4 w-4" />
                立即預約
              </Link>
              <Link
                href="/chat"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-white px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary-light"
              >
                <Sparkles className="h-4 w-4" />
                先問 AI 體質諮詢
              </Link>
            </div>
            <div className="rounded-2xl border border-primary/10 bg-primary-pale p-4 text-sm text-slate-600">
              <p className="font-medium text-primary">想先了解再決定？</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link href="/articles" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                  <BookOpenText className="h-4 w-4" />
                  健康文章
                </Link>
                <Link href="/courses" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
                  <GraduationCap className="h-4 w-4" />
                  電子課程
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-primary/15 bg-primary-pale p-5">
              <p className="text-xs font-semibold tracking-wide text-primary">最快開始方式</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">兩步入主流程</h2>
              <ol className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="rounded-xl bg-white/80 px-4 py-3">
                  <span className="font-semibold text-slate-900">1. 揀路線</span>
                  <p className="mt-1">想快啲約診就去預約，未肯定就先問 AI。</p>
                </li>
                <li className="rounded-xl bg-white/80 px-4 py-3">
                  <span className="font-semibold text-slate-900">2. 完成下一步</span>
                  <p className="mt-1">AI 會導去預約，預約頁就直接揀醫師、診所同時段。</p>
                </li>
              </ol>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-primary-light bg-white/95 p-4 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-primary">已發佈文章</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{articles.length}</p>
                <p className="mt-1 text-sm text-slate-600">作為延伸閱讀，不再搶主入口</p>
              </div>
              <div className="rounded-2xl border border-primary-light bg-white/95 p-4 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-primary">已發佈課程</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{courses.length}</p>
                <p className="mt-1 text-sm text-slate-600">想先了解內容，可以稍後再睇</p>
              </div>
              <div className="rounded-2xl border border-primary-light bg-white/95 p-4 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-primary">主流程</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">AI / 預約</p>
                <p className="mt-1 text-sm text-slate-600">先幫你開始，而唔係先叫你揀內容分類</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">延伸內容</p>
              <h2 className="text-2xl font-semibold text-primary">想先了解，再慢慢決定</h2>
            </div>
            <Link href="/articles" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              查看全部文章
              <ArrowRight className="h-4 w-4" />
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">進一步學習</p>
              <h2 className="text-2xl font-semibold text-primary">電子課程會留喺第二步</h2>
            </div>
            <Link href="/courses" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              查看全部課程
              <ArrowRight className="h-4 w-4" />
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
