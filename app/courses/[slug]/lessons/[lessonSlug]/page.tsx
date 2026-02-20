import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownContent from "@/components/content/MarkdownContent";
import {
  getPublishedCourseBySlug,
  getPublishedLessonByCourseAndSlug,
} from "@/lib/content-service";

interface PageProps {
  params: {
    slug: string;
    lessonSlug: string;
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const course = await getPublishedCourseBySlug(params.slug);
  if (!course) {
    return { title: "課堂不存在 | 醫天圓" };
  }

  const lesson = await getPublishedLessonByCourseAndSlug(course.id, params.lessonSlug);
  if (!lesson) {
    return { title: `${course.title} | 課堂不存在` };
  }

  return {
    title: `${lesson.title} | ${course.title} | 醫天圓`,
    description: `${course.title} 課程內容`,
  };
}

export default async function CourseLessonPage({ params }: PageProps) {
  const course = await getPublishedCourseBySlug(params.slug);
  if (!course) {
    notFound();
  }

  const lesson = await getPublishedLessonByCourseAndSlug(course.id, params.lessonSlug);
  if (!lesson) {
    notFound();
  }

  return (
    <main className="patient-pane text-slate-800">
      <article className="patient-card mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/courses" className="font-medium text-primary hover:underline">
              ← 返回課程列表
            </Link>
            <Link href={`/courses/${course.slug}`} className="font-medium text-primary hover:underline">
              ← 返回 {course.title}
            </Link>
          </div>
          <h1 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl">{lesson.title}</h1>
          <p className="text-xs text-slate-500">
            {lesson.durationMinutes ? `課堂長度：約 ${lesson.durationMinutes} 分鐘` : "課堂內容"}
          </p>
          {lesson.videoUrl ? (
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              打開教學影片
            </a>
          ) : null}
        </div>

        <MarkdownContent
          content={lesson.contentMd}
          className="rounded-xl bg-slate-50 p-4 text-sm sm:text-base"
        />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
          >
            問 AI 深入解釋
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center rounded-full border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-light"
          >
            安排諮詢 / 預約
          </Link>
        </div>
      </article>
    </main>
  );
}
