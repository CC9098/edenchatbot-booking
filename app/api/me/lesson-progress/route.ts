import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { buildPublicUrl } from "@/lib/public-url";

const updateProgressSchema = z
  .object({
    lessonId: z.string().uuid().optional(),
    courseSlug: z.string().min(1).optional(),
    lessonSlug: z.string().min(1).optional(),
    progressPct: z.number().int().min(0).max(100),
    completed: z.boolean().optional(),
  })
  .refine(
    (data) => !!data.lessonId || (!!data.courseSlug && !!data.lessonSlug),
    { message: "Provide lessonId or courseSlug + lessonSlug" }
  );

function parseLimit(raw: string | null, fallback = 50, max = 200): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 100, 200);
    const courseSlugFilter = (searchParams.get("courseSlug") || "").trim();

    const supabase = createServiceClient();
    const { data: progressRows, error: progressError } = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, progress_pct, completed_at, last_viewed_at, updated_at")
      .eq("user_id", user.id)
      .order("last_viewed_at", { ascending: false })
      .limit(limit);

    if (progressError) {
      console.error("[GET /api/me/lesson-progress] progress query error:", progressError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!progressRows || progressRows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const lessonIds = progressRows.map((row) => row.lesson_id);

    const { data: lessons, error: lessonsError } = await supabase
      .from("course_lessons")
      .select("id, course_id, slug, title")
      .in("id", lessonIds);

    if (lessonsError) {
      console.error("[GET /api/me/lesson-progress] lessons query error:", lessonsError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const courseIds = Array.from(new Set((lessons || []).map((lesson) => lesson.course_id)));
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, slug, title")
      .in("id", courseIds);

    if (coursesError) {
      console.error("[GET /api/me/lesson-progress] courses query error:", coursesError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const lessonMap = new Map((lessons || []).map((lesson) => [lesson.id, lesson]));
    const courseMap = new Map((courses || []).map((course) => [course.id, course]));

    const items = progressRows
      .map((row) => {
        const lesson = lessonMap.get(row.lesson_id);
        if (!lesson) return null;

        const course = courseMap.get(lesson.course_id);
        if (!course) return null;

        if (courseSlugFilter && course.slug !== courseSlugFilter) {
          return null;
        }

        return {
          lessonId: row.lesson_id,
          courseId: lesson.course_id,
          courseSlug: course.slug,
          courseTitle: course.title,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          progressPct: row.progress_pct,
          completedAt: row.completed_at,
          lastViewedAt: row.last_viewed_at,
          updatedAt: row.updated_at,
          lessonUrl: buildPublicUrl(`/courses/${course.slug}/lessons/${lesson.slug}`),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/me/lesson-progress] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProgressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const supabase = createServiceClient();

    let lessonId = payload.lessonId;

    if (!lessonId) {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("slug", payload.courseSlug!)
        .maybeSingle();

      if (courseError) {
        console.error("[POST /api/me/lesson-progress] course resolve error:", courseError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      if (!course) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }

      const { data: lesson, error: lessonError } = await supabase
        .from("course_lessons")
        .select("id")
        .eq("course_id", course.id)
        .eq("slug", payload.lessonSlug!)
        .maybeSingle();

      if (lessonError) {
        console.error("[POST /api/me/lesson-progress] lesson resolve error:", lessonError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      if (!lesson) {
        return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      }

      lessonId = lesson.id;
    }

    const isCompleted = payload.completed === true || payload.progressPct >= 100;

    const { data: upserted, error: upsertError } = await supabase
      .from("user_lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          progress_pct: payload.progressPct,
          completed_at: isCompleted ? new Date().toISOString() : null,
          last_viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      )
      .select("user_id, lesson_id, progress_pct, completed_at, last_viewed_at, updated_at")
      .single();

    if (upsertError) {
      console.error("[POST /api/me/lesson-progress] upsert error:", upsertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      userId: upserted.user_id,
      lessonId: upserted.lesson_id,
      progressPct: upserted.progress_pct,
      completedAt: upserted.completed_at,
      lastViewedAt: upserted.last_viewed_at,
      updatedAt: upserted.updated_at,
    });
  } catch (error) {
    console.error("[POST /api/me/lesson-progress] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
