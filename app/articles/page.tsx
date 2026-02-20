import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedArticles } from "@/lib/content-service";

export const metadata: Metadata = {
  title: "健康文章 | 醫天圓",
  description: "閱讀醫天圓中醫文章與調養內容。",
};

export const dynamic = "force-dynamic";

function formatDate(date: string): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function ArticlesPage() {
  const articles = await listPublishedArticles(24);

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-4">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
            Eden Educational Content
          </p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">健康文章</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            文章內容會持續整合到同一平台，方便用戶由閱讀直接進入 AI 諮詢與預約流程。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              查看電子課程
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              進入 AI 諮詢
            </Link>
          </div>
        </header>

        {articles.length === 0 ? (
          <section className="patient-card px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-800">暫時未有已發布文章</h2>
            <p className="mt-2 text-sm text-slate-600">
              請先在資料庫新增 `articles` 內容並設定 `published_at`。
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="patient-card p-5 transition hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <p className="text-xs font-medium text-slate-500">{formatDate(article.publishedAt)}</p>
                  <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900">
                    {article.title}
                  </h2>
                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {article.excerpt || "點擊閱讀全文"}
                  </p>
                  {article.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
