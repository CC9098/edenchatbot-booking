import { createServiceClient } from "@/lib/supabase";

export interface ArticleCardItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string;
}

export interface CourseCardItem {
  id: string;
  slug: string;
  title: string;
  descriptionMd: string | null;
  coverImageUrl: string | null;
  level: string | null;
  publishedAt: string;
}

export interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMd: string;
  coverImageUrl: string | null;
  tags: string[];
  publishedAt: string;
}

export interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  descriptionMd: string | null;
  coverImageUrl: string | null;
  level: string | null;
  publishedAt: string;
}

export interface CourseModuleItem {
  id: string;
  courseId: string;
  title: string;
  sortOrder: number;
}

export interface CourseLessonItem {
  id: string;
  courseId: string;
  moduleId: string | null;
  slug: string;
  title: string;
  contentMd: string;
  videoUrl: string | null;
  durationMinutes: number | null;
  sortOrder: number;
  publishedAt: string;
}

function toIsoString(value: string | null): string {
  return value ?? "";
}

export async function listPublishedArticles(limit = 12): Promise<ArticleCardItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, title, excerpt, cover_image_url, tags, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[content-service] listPublishedArticles error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      coverImageUrl: row.cover_image_url,
      tags: Array.isArray(row.tags) ? row.tags : [],
      publishedAt: toIsoString(row.published_at),
    }));
  } catch (error) {
    console.error("[content-service] listPublishedArticles unexpected error:", error);
    return [];
  }
}

export async function listPublishedCourses(limit = 12): Promise<CourseCardItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("courses")
      .select("id, slug, title, description_md, cover_image_url, level, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[content-service] listPublishedCourses error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      descriptionMd: row.description_md,
      coverImageUrl: row.cover_image_url,
      level: row.level,
      publishedAt: toIsoString(row.published_at),
    }));
  } catch (error) {
    console.error("[content-service] listPublishedCourses unexpected error:", error);
    return [];
  }
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, title, excerpt, content_md, cover_image_url, tags, published_at")
      .eq("slug", slug)
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[content-service] getPublishedArticleBySlug error:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      contentMd: data.content_md,
      coverImageUrl: data.cover_image_url,
      tags: Array.isArray(data.tags) ? data.tags : [],
      publishedAt: toIsoString(data.published_at),
    };
  } catch (error) {
    console.error("[content-service] getPublishedArticleBySlug unexpected error:", error);
    return null;
  }
}

export async function getPublishedCourseBySlug(slug: string): Promise<CourseDetail | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("courses")
      .select("id, slug, title, description_md, cover_image_url, level, published_at")
      .eq("slug", slug)
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[content-service] getPublishedCourseBySlug error:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      slug: data.slug,
      title: data.title,
      descriptionMd: data.description_md,
      coverImageUrl: data.cover_image_url,
      level: data.level,
      publishedAt: toIsoString(data.published_at),
    };
  } catch (error) {
    console.error("[content-service] getPublishedCourseBySlug unexpected error:", error);
    return null;
  }
}

export async function listPublishedCourseModules(courseId: string): Promise<CourseModuleItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("course_modules")
      .select("id, course_id, title, sort_order")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[content-service] listPublishedCourseModules error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      sortOrder: row.sort_order,
    }));
  } catch (error) {
    console.error("[content-service] listPublishedCourseModules unexpected error:", error);
    return [];
  }
}

export async function listPublishedCourseLessons(courseId: string): Promise<CourseLessonItem[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("course_lessons")
      .select(
        "id, course_id, module_id, slug, title, content_md, video_url, duration_minutes, sort_order, published_at"
      )
      .eq("course_id", courseId)
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[content-service] listPublishedCourseLessons error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      moduleId: row.module_id,
      slug: row.slug,
      title: row.title,
      contentMd: row.content_md,
      videoUrl: row.video_url,
      durationMinutes: row.duration_minutes,
      sortOrder: row.sort_order,
      publishedAt: toIsoString(row.published_at),
    }));
  } catch (error) {
    console.error("[content-service] listPublishedCourseLessons unexpected error:", error);
    return [];
  }
}

export async function getPublishedLessonByCourseAndSlug(
  courseId: string,
  lessonSlug: string
): Promise<CourseLessonItem | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("course_lessons")
      .select(
        "id, course_id, module_id, slug, title, content_md, video_url, duration_minutes, sort_order, published_at"
      )
      .eq("course_id", courseId)
      .eq("slug", lessonSlug)
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[content-service] getPublishedLessonByCourseAndSlug error:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      courseId: data.course_id,
      moduleId: data.module_id,
      slug: data.slug,
      title: data.title,
      contentMd: data.content_md,
      videoUrl: data.video_url,
      durationMinutes: data.duration_minutes,
      sortOrder: data.sort_order,
      publishedAt: toIsoString(data.published_at),
    };
  } catch (error) {
    console.error("[content-service] getPublishedLessonByCourseAndSlug unexpected error:", error);
    return null;
  }
}
