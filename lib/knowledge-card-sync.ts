import type { SupabaseClient } from "@supabase/supabase-js";

import {
  compactMarkdown,
  hashCardSource,
  sanitizeCardTags,
  type KnowledgeCardRow,
} from "@/lib/knowledge-cards-utils";

interface ArticleSyncRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string;
  tags: string[] | null;
  is_active: boolean;
  published_at: string | null;
  updated_at: string;
}

interface SyncKnowledgeCardsOptions {
  supabase: SupabaseClient;
  actorUserId?: string;
  limit?: number;
}

export interface SyncKnowledgeCardsSummary {
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  linksUpserted: number;
}

function buildCardTitle(article: ArticleSyncRow): string {
  return `${article.title}｜文章精華`;
}

function buildCardBody(article: ArticleSyncRow): string {
  const summary = compactMarkdown(article.excerpt || article.content_md || article.title, 360);
  return `【來源文章】${article.title}\n【slug】${article.slug}\n\n${summary}`;
}

function deriveCardStatus(article: ArticleSyncRow): "published" | "ready" | "archived" {
  if (!article.is_active) return "archived";
  if (!article.published_at) return "ready";
  const publishedAt = new Date(article.published_at);
  if (Number.isNaN(publishedAt.getTime())) return "ready";
  return publishedAt.getTime() <= Date.now() ? "published" : "ready";
}

function sameTextArray(left: string[] | null, right: string[]): boolean {
  const safeLeft = Array.isArray(left) ? left : [];
  if (safeLeft.length !== right.length) return false;
  return safeLeft.every((item, index) => item === right[index]);
}

export async function syncKnowledgeCardsFromArticles(
  options: SyncKnowledgeCardsOptions
): Promise<SyncKnowledgeCardsSummary> {
  const { supabase, actorUserId, limit = 500 } = options;
  const summary: SyncKnowledgeCardsSummary = {
    scanned: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    linksUpserted: 0,
  };

  const { data: articleRows, error: articleError } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, content_md, tags, is_active, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (articleError) {
    throw new Error(`Failed to fetch articles: ${articleError.message}`);
  }

  const articles = (articleRows || []) as ArticleSyncRow[];
  if (articles.length === 0) return summary;

  const articleIds = articles.map((item) => item.id);

  const { data: existingRows, error: existingError } = await supabase
    .from("knowledge_cards")
    .select(
      "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
    )
    .eq("source", "article_sync")
    .in("source_article_id", articleIds);

  if (existingError) {
    throw new Error(`Failed to fetch knowledge cards: ${existingError.message}`);
  }

  const existingByArticle = new Map<string, KnowledgeCardRow>();
  for (const row of (existingRows || []) as KnowledgeCardRow[]) {
    if (!row.source_article_id) continue;
    if (!existingByArticle.has(row.source_article_id)) {
      existingByArticle.set(row.source_article_id, row);
    }
  }

  for (const article of articles) {
    summary.scanned += 1;

    const cardTitle = buildCardTitle(article);
    const cardBody = buildCardBody(article);
    const cardTags = sanitizeCardTags([...(article.tags || []), "文章同步"]);
    const cardStatus = deriveCardStatus(article);
    const sourceHash = hashCardSource([
      article.id,
      article.slug,
      article.title,
      article.excerpt,
      article.content_md,
      article.published_at,
      article.updated_at,
      cardStatus,
      cardTags.join(","),
    ]);

    const payload = {
      title: cardTitle,
      body_md: cardBody,
      status: cardStatus,
      source: "article_sync" as const,
      tags: cardTags,
      source_article_id: article.id,
      source_hash: sourceHash,
      is_active: article.is_active,
      updated_by: actorUserId ?? null,
      ...(actorUserId ? { created_by: actorUserId } : {}),
    };

    const existing = existingByArticle.get(article.id);
    let cardId: string;

    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from("knowledge_cards")
        .insert(payload)
        .select("id")
        .single();

      if (insertError || !inserted) {
        throw new Error(`Failed to insert synced card (${article.slug}): ${insertError?.message || "unknown"}`);
      }

      cardId = inserted.id as string;
      summary.inserted += 1;
    } else {
      const unchanged =
        existing.source_hash === sourceHash &&
        existing.title === cardTitle &&
        existing.body_md === cardBody &&
        existing.status === cardStatus &&
        existing.is_active === article.is_active &&
        sameTextArray(existing.tags, cardTags);

      if (unchanged) {
        cardId = existing.id;
        summary.skipped += 1;
      } else {
        const { data: updated, error: updateError } = await supabase
          .from("knowledge_cards")
          .update(payload)
          .eq("id", existing.id)
          .select("id")
          .single();

        if (updateError || !updated) {
          throw new Error(`Failed to update synced card (${article.slug}): ${updateError?.message || "unknown"}`);
        }

        cardId = updated.id as string;
        summary.updated += 1;
      }
    }

    const relationType = cardStatus === "published" ? "published" : "seed";
    const { error: staleLinkError } = await supabase
      .from("knowledge_card_article_links")
      .delete()
      .eq("card_id", cardId)
      .eq("article_id", article.id)
      .neq("relation_type", relationType);

    if (staleLinkError) {
      throw new Error(`Failed to cleanup stale links (${article.slug}): ${staleLinkError.message}`);
    }

    const { error: linkError } = await supabase.from("knowledge_card_article_links").upsert(
      {
        card_id: cardId,
        article_id: article.id,
        relation_type: relationType,
        created_by: actorUserId ?? null,
      },
      { onConflict: "card_id,article_id,relation_type" }
    );

    if (linkError) {
      throw new Error(`Failed to upsert link (${article.slug}): ${linkError.message}`);
    }
    summary.linksUpserted += 1;
  }

  return summary;
}
