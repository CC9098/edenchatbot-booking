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
      .from("courses")
      .select("id, slug, title, description_md, level, published_at")
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
      console.error("[GET /api/courses] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      descriptionMd: row.description_md,
      level: row.level,
      publishedAt: row.published_at,
      url: buildPublicUrl(`/courses/${row.slug}`),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/courses] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
