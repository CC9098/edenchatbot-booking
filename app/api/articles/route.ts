import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { buildPublicUrl } from "@/lib/public-url";

function parseLimit(raw: string | null, fallback = 20, max = 100): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 20, 100);
    const q = (searchParams.get("q") || "").trim();

    const supabase = createServiceClient();

    let query = supabase
      .from("articles")
      .select("id, slug, title, excerpt, tags, published_at")
      .eq("is_active", true)
      .not("published_at", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/articles] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      tags: Array.isArray(row.tags) ? row.tags : [],
      publishedAt: row.published_at,
      url: buildPublicUrl(`/articles/${row.slug}`),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/articles] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
