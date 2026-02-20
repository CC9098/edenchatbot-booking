import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublishedCourseBySlug,
  listPublishedCourseLessons,
  listPublishedCourseModules,
} from "@/lib/content-service";

interface PageProps {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const course = await getPublishedCourseBySlug(params.slug);
  if (!course) {
    return { title: "課程不存在 | 醫天圓" };
  }

  return {
    title: `${course.title} | 電子課程 | 醫天圓`,
    description: course.descriptionMd || "醫天圓電子課程",
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

export default async function CourseDetailPage({ params }: PageProps) {
  const course = await getPublishedCourseBySlug(params.slug);

  if (!course) {
    notFound();
  }

  const [modules, lessons] = await Promise.all([
    listPublishedCourseModules(course.id),
    listPublishedCourseLessons(course.id),
  ]);

  const lessonsByModuleId = new Map<string, typeof lessons>();
  const standaloneLessons: typeof lessons = [];

  for (const lesson of lessons) {
    if (!lesson.moduleId) {
      standaloneLessons.push(lesson);
      continue;
    }

    const group = lessonsByModuleId.get(lesson.moduleId) ?? [];
    group.push(lesson);
    lessonsByModuleId.set(lesson.moduleId, group);
  }

  return (
    <main className="patient-pane text-slate-800">
      <div className="patient-card mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
        <header className="space-y-3">
          <Link href="/courses" className="text-sm font-medium text-primary hover:underline">
            ← 返回課程列表
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{course.title}</h1>
            {course.level ? (
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                {course.level}
              </span>
            ) : null}
          </div>
          <p className="text-xs font-medium text-slate-500">發布日期：{formatDate(course.publishedAt)}</p>
          {course.descriptionMd ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 sm:text-base">
              {course.descriptionMd}
            </p>
          ) : null}
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">課程章節</h2>

          {modules.length === 0 && standaloneLessons.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              這個課程暫時未有已發布課堂。
            </div>
          ) : null}

          {modules.map((module) => {
            const moduleLessons = lessonsByModuleId.get(module.id) ?? [];
            return (
              <div key={module.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{module.title}</h3>
                {moduleLessons.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">此章節暫無已發布課堂。</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {moduleLessons.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/courses/${course.slug}/lessons/${lesson.slug}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-primary-light"
                      >
                        <span>{lesson.title}</span>
                        <span className="text-xs text-slate-500">
                          {lesson.durationMinutes ? `${lesson.durationMinutes} 分鐘` : "課堂"}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {standaloneLessons.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">其他課堂</h3>
              <div className="mt-3 space-y-2">
                {standaloneLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.slug}/lessons/${lesson.slug}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-primary-light"
                  >
                    <span>{lesson.title}</span>
                    <span className="text-xs text-slate-500">
                      {lesson.durationMinutes ? `${lesson.durationMinutes} 分鐘` : "課堂"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            用 AI 問課程內容
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-light"
          >
            需要時安排覆診
          </Link>
        </div>
      </div>
    </main>
  );
}
