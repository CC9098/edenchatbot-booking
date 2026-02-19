import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { parseOptionalString, parseRequiredString } from "@/lib/content-admin-utils";
import { createServiceClient } from "@/lib/supabase";
import {
  mapKnowledgeCardRow,
  parseKnowledgeCardSource,
  parseKnowledgeCardStatus,
  sanitizeCardTags,
  type KnowledgeCardArticleLinkRow,
  type KnowledgeCardRow,
} from "@/lib/knowledge-cards-utils";

export const dynamic = "force-dynamic";

interface LinkedArticleItem {
  id: string;
  title: string;
  slug: string;
  relationType: "seed" | "draft" | "published";
  isActive: boolean;
  publishedAt: string | null;
}

function parseLimit(raw: string | null, fallback = 80, max = 200): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseBool(raw: string | null): boolean {
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
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
    const source = (searchParams.get("source") || "all").trim().toLowerCase();
    const onlyUnlinked = parseBool(searchParams.get("onlyUnlinked"));
    const limit = parseLimit(searchParams.get("limit"), 80, 200);

    const supabase = createServiceClient();
    let query = supabase
      .from("knowledge_cards")
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.or(`title.ilike.%${q}%,body_md.ilike.%${q}%`);
    }
    if (status !== "all") {
      query = query.eq("status", status);
    }
    if (source !== "all") {
      query = query.eq("source", source);
    }

    const { data: cardRows, error: cardError } = await query;
    if (cardError) {
      console.error("[GET /api/doctor/content/cards] card query error:", cardError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const cards = (cardRows || []) as KnowledgeCardRow[];
    if (cards.length === 0) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const cardIds = cards.map((item) => item.id);
    const { data: linkRows, error: linkError } = await supabase
      .from("knowledge_card_article_links")
      .select("id, card_id, article_id, relation_type, created_by, created_at")
      .in("card_id", cardIds);

    if (linkError) {
      console.error("[GET /api/doctor/content/cards] link query error:", linkError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const links = (linkRows || []) as KnowledgeCardArticleLinkRow[];
    const articleIds = Array.from(new Set(links.map((item) => item.article_id)));

    const articlesById = new Map<string, { id: string; title: string; slug: string; is_active: boolean; published_at: string | null }>();
    if (articleIds.length > 0) {
      const { data: articleRows, error: articleError } = await supabase
        .from("articles")
        .select("id, title, slug, is_active, published_at")
        .in("id", articleIds);

      if (articleError) {
        console.error("[GET /api/doctor/content/cards] article query error:", articleError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      for (const row of articleRows || []) {
        articlesById.set(row.id as string, {
          id: row.id as string,
          title: row.title as string,
          slug: row.slug as string,
          is_active: Boolean(row.is_active),
          published_at: (row.published_at as string | null) ?? null,
        });
      }
    }

    const linksByCardId = new Map<string, LinkedArticleItem[]>();
    for (const link of links) {
      const article = articlesById.get(link.article_id);
      if (!article) continue;
      const bucket = linksByCardId.get(link.card_id) || [];
      bucket.push({
        id: article.id,
        title: article.title,
        slug: article.slug,
        relationType: link.relation_type,
        isActive: article.is_active,
        publishedAt: article.published_at,
      });
      linksByCardId.set(link.card_id, bucket);
    }

    const items = cards
      .map((row) => {
        const linkedArticles = linksByCardId.get(row.id) || [];
        const hasPublished = linkedArticles.some((item) => item.relationType === "published");
        return {
          ...mapKnowledgeCardRow(row),
          linkedArticles,
          linkedCount: linkedArticles.length,
          hasPublishedArticle: hasPublished,
        };
      })
      .filter((item) => (onlyUnlinked ? !item.hasPublishedArticle : true));

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/doctor/content/cards] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const body = await request.json();

    const title = parseRequiredString(body.title, "title", 1, 180);
    const bodyMd = parseOptionalString(body.bodyMd, 20000) || "";
    const status = parseKnowledgeCardStatus(body.status, "inbox");
    const source = parseKnowledgeCardSource(body.source, "manual");
    const tags = sanitizeCardTags(body.tags);
    const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.floor(body.sortOrder)
        : 0;

    const sourceArticleId =
      typeof body.sourceArticleId === "string" && body.sourceArticleId.trim().length > 0
        ? body.sourceArticleId.trim()
        : null;
    const sourceHash =
      typeof body.sourceHash === "string" && body.sourceHash.trim().length > 0
        ? body.sourceHash.trim().slice(0, 80)
        : null;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("knowledge_cards")
      .insert({
        title,
        body_md: bodyMd,
        status,
        source,
        tags,
        source_article_id: sourceArticleId,
        source_hash: sourceHash,
        sort_order: sortOrder,
        is_active: isActive,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .single();

    if (error || !data) {
      console.error("[POST /api/doctor/content/cards] insert error:", error?.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json(
      {
        item: {
          ...mapKnowledgeCardRow(data as KnowledgeCardRow),
          linkedArticles: [],
          linkedCount: 0,
          hasPublishedArticle: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/doctor/content/cards] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
