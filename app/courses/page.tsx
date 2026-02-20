import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedCourses } from "@/lib/content-service";

export const metadata: Metadata = {
  title: "電子課程 | 醫天圓",
  description: "醫天圓電子課程與分段學習內容。",
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

export default async function CoursesPage() {
  const courses = await listPublishedCourses(24);

  return (
    <main className="patient-pane text-slate-800">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-4">
          <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
            Eden Learning Hub
          </p>
          <h1 className="text-3xl font-semibold text-primary sm:text-4xl">電子課程</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            由閱讀到學習再到 AI 問答與預約，逐步整合成同一個健康服務流程。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/articles"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              查看健康文章
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              進入 AI 諮詢
            </Link>
          </div>
        </header>

        {courses.length === 0 ? (
          <section className="patient-card px-6 py-10 text-center">
            <h2 className="text-lg font-semibold text-slate-800">暫時未有已發布課程</h2>
            <p className="mt-2 text-sm text-slate-600">
              請先在資料庫新增 `courses` 並設定 `published_at`。
            </p>
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="patient-card p-5 transition hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-500">{formatDate(course.publishedAt)}</p>
                    {course.level ? (
                      <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">
                        {course.level}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-lg font-semibold leading-snug text-slate-900">{course.title}</h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {course.descriptionMd || "點擊查看課程章節與內容"}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
