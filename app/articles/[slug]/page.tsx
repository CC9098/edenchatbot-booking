import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/lib/content-service";
import MarkdownContent from "@/components/content/MarkdownContent";

interface PageProps {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await getPublishedArticleBySlug(params.slug);
  if (!article) {
    return {
      title: "文章不存在 | 醫天圓",
    };
  }

  return {
    title: `${article.title} | 健康文章 | 醫天圓`,
    description: article.excerpt || "醫天圓健康文章",
  };
}

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

export default async function ArticleDetailPage({ params }: PageProps) {
  const article = await getPublishedArticleBySlug(params.slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-primary-pale px-6 py-12 text-slate-800 sm:px-10">
      <article className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-3">
          <Link href="/articles" className="text-sm font-medium text-primary hover:underline">
            ← 返回文章列表
          </Link>
          <p className="text-xs font-medium text-slate-500">{formatDate(article.publishedAt)}</p>
          <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{article.title}</h1>
          {article.excerpt ? <p className="text-sm text-slate-600 sm:text-base">{article.excerpt}</p> : null}
          {article.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <MarkdownContent
          content={article.contentMd}
          className="rounded-xl bg-slate-50 p-4 text-sm sm:text-base"
        />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            問 AI 深入解釋
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary-light"
          >
            需要時直接預約
          </Link>
        </div>
      </article>
    </main>
  );
}
