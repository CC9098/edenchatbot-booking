import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedCourseBySlug,
  listPublishedCourseLessons,
  listPublishedCourseModules,
} from "@/lib/content-service";
import { buildPublicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    slug: string;
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const course = await getPublishedCourseBySlug(context.params.slug);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [modules, lessons] = await Promise.all([
      listPublishedCourseModules(course.id),
      listPublishedCourseLessons(course.id),
    ]);

    return NextResponse.json({
      id: course.id,
      slug: course.slug,
      title: course.title,
      descriptionMd: course.descriptionMd,
      level: course.level,
      publishedAt: course.publishedAt,
      url: buildPublicUrl(`/courses/${course.slug}`),
      modules,
      lessons: lessons.map((lesson) => ({
        ...lesson,
        url: buildPublicUrl(`/courses/${course.slug}/lessons/${lesson.slug}`),
      })),
    });
  } catch (error) {
    console.error("[GET /api/courses/[slug]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
