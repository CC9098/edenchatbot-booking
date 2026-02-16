import { NextRequest, NextResponse } from "next/server";
import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import {
  mapArticleRow,
  parseNullableIsoDate,
  parseOptionalString,
  parseRequiredString,
  resolveUniqueArticleSlug,
  sanitizeTags,
  type ArticleRow,
} from "@/lib/content-admin-utils";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null, fallback = 50, max = 200): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function isPublishedArticle(row: ArticleRow): boolean {
  if (!row.is_active || !row.published_at) return false;
  const publishedAt = new Date(row.published_at);
  if (Number.isNaN(publishedAt.getTime())) return false;
  return publishedAt.getTime() <= Date.now();
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const status = (searchParams.get("status") || "all").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 50, 200);

    const supabase = createServiceClient();
    let query = supabase
      .from("articles")
      .select(
        "id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at, created_by, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/doctor/content/articles] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const rows = (data ?? []) as ArticleRow[];
    const filtered = rows.filter((row) => {
      if (status === "published") return isPublishedArticle(row);
      if (status === "draft") return !isPublishedArticle(row);
      return true;
    });

    return NextResponse.json({
      items: filtered.map(mapArticleRow),
      total: filtered.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/doctor/content/articles] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    if (staffRole.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }

    const body = await request.json();

    const title = parseRequiredString(body.title, "title", 1, 180);
    const excerpt = parseOptionalString(body.excerpt, 360);
    const contentMd = parseRequiredString(body.contentMd ?? "", "contentMd", 1, 50000);
    const coverImageUrl = parseOptionalString(body.coverImageUrl, 2000);
    const tags = sanitizeTags(body.tags);
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
    const publishNow = body.publishNow === true;

    const supabase = createServiceClient();
    const slug = await resolveUniqueArticleSlug({
      supabase,
      slug: typeof body.slug === "string" ? body.slug : null,
      title,
    });

    let publishedAt: string | null = null;
    if (publishNow) {
      publishedAt = new Date().toISOString();
    } else if (body.publishedAt !== undefined) {
      publishedAt = parseNullableIsoDate(body.publishedAt, "publishedAt");
    }

    const { data, error } = await supabase
      .from("articles")
      .insert({
        slug,
        title,
        excerpt,
        content_md: contentMd,
        cover_image_url: coverImageUrl,
        tags,
        is_active: isActive,
        published_at: publishedAt,
        created_by: user.id,
      })
      .select(
        "id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at, created_by, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("[POST /api/doctor/content/articles] insert error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ item: mapArticleRow(data as ArticleRow) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/doctor/content/articles] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
