import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { resolveUniqueArticleSlug, sanitizeTags } from "@/lib/content-admin-utils";
import { createServiceClient } from "@/lib/supabase";
import { type KnowledgeCardRow } from "@/lib/knowledge-cards-utils";

export const dynamic = "force-dynamic";

interface DraftPayload {
  title: string;
  excerpt: string;
  contentMd: string;
  tags: string[];
}

function fallbackDraft(cards: KnowledgeCardRow[]): DraftPayload {
  const title = `${cards[0]?.title || "知識卡"}｜整合文章草稿`;
  const contentParts = cards.map((card, index) => `## 觀點 ${index + 1}：${card.title}\n\n${card.body_md}`);
  const contentMd = `# ${title}\n\n${contentParts.join("\n\n")}\n`;
  const excerpt = (cards[0]?.body_md || "由知識卡整合而成的文章草稿。").slice(0, 180);
  const tags = sanitizeTags(cards.flatMap((card) => card.tags || []));
  return { title, excerpt, contentMd, tags };
}

function parseDraftJson(rawText: string): DraftPayload | null {
  const trimmed = rawText.trim();
  const candidates: string[] = [trimmed];

  if (trimmed.startsWith("```")) {
    candidates.push(
      trimmed
        .replace(/^```[a-zA-Z]*\n?/, "")
        .replace(/\n?```$/, "")
        .trim()
    );
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as {
        title?: unknown;
        excerpt?: unknown;
        contentMd?: unknown;
        tags?: unknown;
      };

      if (typeof parsed.title !== "string" || typeof parsed.contentMd !== "string") {
        continue;
      }
      const excerpt = typeof parsed.excerpt === "string" ? parsed.excerpt : parsed.contentMd.slice(0, 180);
      const tags = sanitizeTags(parsed.tags);
      return {
        title: parsed.title.trim().slice(0, 180),
        excerpt: excerpt.trim().slice(0, 360),
        contentMd: parsed.contentMd.trim(),
        tags,
      };
    } catch {
      // keep trying
    }
  }

  return null;
}

async function generateDraftWithAi(cards: KnowledgeCardRow[]): Promise<DraftPayload | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const cardBlocks = cards
    .map(
      (card, index) =>
        `卡片 ${index + 1}\n標題：${card.title}\n標籤：${(card.tags || []).join("、") || "（無）"}\n內容：\n${card.body_md}`
    )
    .join("\n\n---\n\n");

  const prompt = `你是醫天圓中醫內容編輯助手。請把以下知識卡整合成一篇可發佈的文章草稿。\n\n要求：\n1) 用繁體中文（香港用語）。\n2) 內容要有清晰段落與小標。\n3) 避免誇張療效與保證式語句，語氣專業務實。\n4) 僅輸出 JSON，格式：\n{\n  "title": "string",\n  "excerpt": "string",\n  "contentMd": "markdown string",\n  "tags": ["string"]\n}\n\n知識卡內容：\n${cardBlocks}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseDraftJson(text);
  } catch (error) {
    console.error("[POST /api/doctor/content/cards/compose] ai generation failed:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const staffRole = await requireStaffRole(user.id);

    const body = await request.json();
    const cardIds = Array.isArray(body.cardIds)
      ? Array.from(
          new Set(
            body.cardIds
              .filter((item: unknown): item is string => typeof item === "string")
              .map((item: string) => item.trim())
              .filter(Boolean)
          )
        )
      : [];

    if (cardIds.length === 0) {
      return NextResponse.json({ error: "cardIds is required" }, { status: 400 });
    }
    if (cardIds.length > 8) {
      return NextResponse.json({ error: "最多一次處理 8 張卡片" }, { status: 400 });
    }

    const saveAsDraft = body.saveAsDraft === true;
    if (saveAsDraft && staffRole.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required for saveAsDraft" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data: cardRows, error: cardError } = await supabase
      .from("knowledge_cards")
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .in("id", cardIds)
      .eq("is_active", true);

    if (cardError) {
      console.error("[POST /api/doctor/content/cards/compose] card query error:", cardError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const cards = (cardRows || []) as KnowledgeCardRow[];
    if (cards.length === 0) {
      return NextResponse.json({ error: "No active cards found" }, { status: 404 });
    }

    const orderedCards = cardIds
      .map((id) => cards.find((card) => card.id === id))
      .filter((card): card is KnowledgeCardRow => Boolean(card));

    const aiDraft = await generateDraftWithAi(orderedCards);
    const draft = aiDraft || fallbackDraft(orderedCards);

    const responsePayload: Record<string, unknown> = {
      draft,
      usedFallback: !aiDraft,
      sourceCardIds: orderedCards.map((card) => card.id),
    };

    if (saveAsDraft) {
      const slug = await resolveUniqueArticleSlug({
        supabase,
        title: draft.title,
        slug: null,
      });

      const { data: insertedArticle, error: insertError } = await supabase
        .from("articles")
        .insert({
          slug,
          title: draft.title,
          excerpt: draft.excerpt,
          content_md: draft.contentMd,
          tags: sanitizeTags(draft.tags),
          is_active: true,
          published_at: null,
          created_by: user.id,
        })
        .select("id, slug, title, published_at, is_active")
        .single();

      if (insertError || !insertedArticle) {
        console.error("[POST /api/doctor/content/cards/compose] article insert error:", insertError?.message);
        return NextResponse.json({ error: "Failed to save draft article" }, { status: 500 });
      }

      for (const card of orderedCards) {
        const { error: linkError } = await supabase.from("knowledge_card_article_links").upsert(
          {
            card_id: card.id,
            article_id: insertedArticle.id as string,
            relation_type: "draft",
            created_by: user.id,
          },
          { onConflict: "card_id,article_id,relation_type" }
        );
        if (linkError) {
          console.error(
            "[POST /api/doctor/content/cards/compose] link insert error:",
            card.id,
            linkError.message
          );
        }

        await supabase
          .from("knowledge_cards")
          .update({ status: "drafting", updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("id", card.id);
      }

      responsePayload.savedArticle = {
        id: insertedArticle.id,
        slug: insertedArticle.slug,
        title: insertedArticle.title,
      };
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/doctor/content/cards/compose] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
