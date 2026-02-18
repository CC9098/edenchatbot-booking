import { createServiceClient } from "@/lib/supabase";
import { buildPublicUrl } from "@/lib/public-url";

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

interface ContentReferenceItem {
  kind: "文章" | "課程" | "課堂";
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  score: number;
}

function toIsoString(value: string | null): string {
  return value ?? "";
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSlugInput(value: string): string {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function summarizeText(value: string, maxLength = 120): string {
  const normalized = compactWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength - 1) + "…";
}

function extractSearchTerms(userMessage: string): string[] {
  const normalized = userMessage.toLowerCase();
  const rawParts = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  const deduped = Array.from(new Set(rawParts));
  if (deduped.length === 0) {
    const fallback = compactWhitespace(normalized);
    return fallback.length >= 2 ? [fallback.slice(0, 24)] : [];
  }

  return deduped.slice(0, 6);
}

function scoreByTerms(text: string, terms: string[], wholeQuery: string): number {
  if (!text) return 0;
  const normalizedText = text.toLowerCase();
  let score = 0;

  if (wholeQuery.length >= 2 && normalizedText.includes(wholeQuery)) {
    score += 6;
  }

  for (const term of terms) {
    if (!term) continue;
    if (normalizedText.includes(term)) {
      score += term.length >= 4 ? 3 : 2;
    }
  }

  return score;
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
    const normalizedSlug = normalizeSlugInput(slug);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, title, excerpt, content_md, cover_image_url, tags, published_at")
      .eq("slug", normalizedSlug)
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
    const normalizedSlug = normalizeSlugInput(slug);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("courses")
      .select("id, slug, title, description_md, cover_image_url, level, published_at")
      .eq("slug", normalizedSlug)
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
    const normalizedLessonSlug = normalizeSlugInput(lessonSlug);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("course_lessons")
      .select(
        "id, course_id, module_id, slug, title, content_md, video_url, duration_minutes, sort_order, published_at"
      )
      .eq("course_id", courseId)
      .eq("slug", normalizedLessonSlug)
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

export async function buildContentReferenceContext(
  userMessage: string,
  limit = 4
): Promise<string> {
  try {
    const normalizedQuery = compactWhitespace(userMessage.toLowerCase());
    if (normalizedQuery.length < 2) return "";

    const terms = extractSearchTerms(userMessage);
    if (terms.length === 0) return "";

    const nowIso = new Date().toISOString();
    const supabase = createServiceClient();

    const [articleResult, courseResult, lessonResult] = await Promise.all([
      supabase
        .from("articles")
        .select("slug, title, excerpt, content_md, published_at")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .lte("published_at", nowIso)
        .order("published_at", { ascending: false })
        .limit(30),
      supabase
        .from("courses")
        .select("id, slug, title, description_md, published_at")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .lte("published_at", nowIso)
        .order("published_at", { ascending: false })
        .limit(20),
      supabase
        .from("course_lessons")
        .select("course_id, slug, title, content_md, published_at")
        .eq("is_active", true)
        .not("published_at", "is", null)
        .lte("published_at", nowIso)
        .order("published_at", { ascending: false })
        .limit(40),
    ]);

    if (articleResult.error) {
      console.error("[content-service] buildContentReferenceContext articles error:", articleResult.error.message);
    }
    if (courseResult.error) {
      console.error("[content-service] buildContentReferenceContext courses error:", courseResult.error.message);
    }
    if (lessonResult.error) {
      console.error("[content-service] buildContentReferenceContext lessons error:", lessonResult.error.message);
    }

    const courseRows = courseResult.data ?? [];
    const courseById = new Map(courseRows.map((c) => [c.id, c]));
    const candidates: ContentReferenceItem[] = [];

    for (const article of articleResult.data ?? []) {
      const searchable = `${article.title}\n${article.excerpt ?? ""}\n${article.content_md ?? ""}`;
      const score = scoreByTerms(searchable, terms, normalizedQuery);
      if (score === 0) continue;

      candidates.push({
        kind: "文章",
        title: article.title,
        url: buildPublicUrl(`/articles/${article.slug}`),
        summary: summarizeText(article.excerpt || article.content_md || article.title),
        publishedAt: toIsoString(article.published_at),
        score: score + 1,
      });
    }

    for (const course of courseRows) {
      const searchable = `${course.title}\n${course.description_md ?? ""}`;
      const score = scoreByTerms(searchable, terms, normalizedQuery);
      if (score === 0) continue;

      candidates.push({
        kind: "課程",
        title: course.title,
        url: buildPublicUrl(`/courses/${course.slug}`),
        summary: summarizeText(course.description_md || course.title),
        publishedAt: toIsoString(course.published_at),
        score,
      });
    }

    for (const lesson of lessonResult.data ?? []) {
      const course = courseById.get(lesson.course_id);
      if (!course) continue;

      const searchable = `${lesson.title}\n${lesson.content_md ?? ""}\n${course.title}\n${course.description_md ?? ""}`;
      const score = scoreByTerms(searchable, terms, normalizedQuery);
      if (score === 0) continue;

      candidates.push({
        kind: "課堂",
        title: `${course.title}｜${lesson.title}`,
        url: buildPublicUrl(`/courses/${course.slug}/lessons/${lesson.slug}`),
        summary: summarizeText(lesson.content_md || lesson.title),
        publishedAt: toIsoString(lesson.published_at),
        score: score + 2,
      });
    }

    if (candidates.length === 0) return "";

    const ranked = candidates
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.publishedAt.localeCompare(a.publishedAt);
      })
      .slice(0, limit);

    const lines = ranked.map((item, index) => {
      return `${index + 1}. [${item.kind}] ${item.title}\n連結：${item.url}\n重點：${item.summary}`;
    });

    return `\n\n【站內內容參考（文章 / 課程）】\n請優先使用以下內容回答；如適合可自然附上相關連結，避免使用機械式標籤（例如「引用：」）。\n${lines.join(
      "\n\n"
    )}`;
  } catch (error) {
    console.error("[content-service] buildContentReferenceContext unexpected error:", error);
    return "";
  }
}
