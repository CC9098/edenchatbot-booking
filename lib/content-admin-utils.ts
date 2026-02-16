import type { SupabaseClient } from "@supabase/supabase-js";

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  cover_image_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapArticleRow(row: ArticleRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentMd: row.content_md,
    coverImageUrl: row.cover_image_url,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isActive: row.is_active,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function resolveUniqueArticleSlug(params: {
  supabase: SupabaseClient;
  slug?: string | null;
  title: string;
  excludeId?: string;
}): Promise<string> {
  const { supabase, slug, title, excludeId } = params;

  const baseSlug = normalizeSlug(slug || title) || `article-${Date.now().toString(36)}`;
  let candidate = baseSlug;

  for (let index = 1; index <= 50; index += 1) {
    const { data, error } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to verify slug uniqueness");
    }

    if (!data || data.id === excludeId) {
      return candidate;
    }

    candidate = `${baseSlug}-${index + 1}`;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}

export function sanitizeTags(value: unknown): string[] {
  let rawValues: string[] = [];

  if (Array.isArray(value)) {
    rawValues = value.filter((item): item is string => typeof item === "string");
  } else if (typeof value === "string") {
    rawValues = value.split(/[,\n]/g);
  }

  const deduped = new Set<string>();

  for (const rawTag of rawValues) {
    const cleaned = rawTag.trim().replace(/^#+/, "").replace(/\s+/g, " ");
    if (!cleaned) continue;
    deduped.add(cleaned.slice(0, 40));
    if (deduped.size >= 12) break;
  }

  return Array.from(deduped);
}

export function parseNullableIsoDate(value: unknown, fieldName: string): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be an ISO datetime string or null`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid datetime string`);
  }

  return parsed.toISOString();
}

export function parseOptionalString(value: unknown, maxLength = 8000): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Expected string value");
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function parseRequiredString(
  value: unknown,
  fieldName: string,
  minLength = 1,
  maxLength = 200
): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed.slice(0, maxLength);
}
