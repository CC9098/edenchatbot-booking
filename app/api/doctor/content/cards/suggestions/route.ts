import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { mapKnowledgeCardRow, type KnowledgeCardArticleLinkRow, type KnowledgeCardRow } from "@/lib/knowledge-cards-utils";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null, fallback = 12, max = 40): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function statusWeight(status: string): number {
  if (status === "inbox") return 100;
  if (status === "drafting") return 85;
  if (status === "ready") return 70;
  if (status === "published") return 20;
  return 0;
}

function freshnessWeight(updatedAt: string): number {
  const updatedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(updatedMs)) return 0;
  const ageHours = Math.max(0, (Date.now() - updatedMs) / (1000 * 60 * 60));
  if (ageHours <= 24) return 30;
  if (ageHours <= 72) return 20;
  if (ageHours <= 168) return 12;
  return 6;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 12, 40);

    const supabase = createServiceClient();
    const { data: cardRows, error: cardError } = await supabase
      .from("knowledge_cards")
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .eq("is_active", true)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(400);

    if (cardError) {
      console.error("[GET /api/doctor/content/cards/suggestions] card query error:", cardError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const cards = (cardRows || []) as KnowledgeCardRow[];
    if (cards.length === 0) {
      return NextResponse.json({ items: [], total: 0, tagHotspots: [] });
    }

    const cardIds = cards.map((item) => item.id);
    const { data: linkRows, error: linkError } = await supabase
      .from("knowledge_card_article_links")
      .select("id, card_id, article_id, relation_type, created_by, created_at")
      .in("card_id", cardIds)
      .eq("relation_type", "published");

    if (linkError) {
      console.error("[GET /api/doctor/content/cards/suggestions] link query error:", linkError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const publishedLinkSet = new Set(((linkRows || []) as KnowledgeCardArticleLinkRow[]).map((link) => link.card_id));

    const scored = cards
      .filter((card) => !publishedLinkSet.has(card.id))
      .map((card) => ({
        ...mapKnowledgeCardRow(card),
        score: statusWeight(card.status) + freshnessWeight(card.updated_at),
      }))
      .sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    const tagCounter = new Map<string, number>();
    for (const item of scored) {
      for (const tag of item.tags) {
        tagCounter.set(tag, (tagCounter.get(tag) || 0) + 1);
      }
    }

    const tagHotspots = Array.from(tagCounter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-Hant"))
      .slice(0, 10);

    return NextResponse.json({
      items: scored,
      total: scored.length,
      tagHotspots,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/doctor/content/cards/suggestions] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
