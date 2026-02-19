import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { parseOptionalString, parseRequiredString } from "@/lib/content-admin-utils";
import {
  mapKnowledgeCardRow,
  parseKnowledgeCardSource,
  parseKnowledgeCardStatus,
  sanitizeCardTags,
  type KnowledgeCardRow,
} from "@/lib/knowledge-cards-utils";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requireStaffRole(user.id);

    const supabase = createServiceClient();
    const { data: existing, error: existingError } = await supabase
      .from("knowledge_cards")
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      console.error("[PATCH /api/doctor/content/cards/[id]] fetch error:", existingError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updateData.title = parseRequiredString(body.title, "title", 1, 180);
    }
    if (body.bodyMd !== undefined) {
      updateData.body_md = parseOptionalString(body.bodyMd, 20000) || "";
    }
    if (body.status !== undefined) {
      updateData.status = parseKnowledgeCardStatus(body.status, existing.status);
    }
    if (body.source !== undefined) {
      updateData.source = parseKnowledgeCardSource(body.source, existing.source);
    }
    if (body.tags !== undefined) {
      updateData.tags = sanitizeCardTags(body.tags);
    }
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
      }
      updateData.is_active = body.isActive;
    }
    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== "number" || !Number.isFinite(body.sortOrder)) {
        return NextResponse.json({ error: "sortOrder must be a number" }, { status: 400 });
      }
      updateData.sort_order = Math.floor(body.sortOrder);
    }
    if (body.sourceArticleId !== undefined) {
      updateData.source_article_id =
        typeof body.sourceArticleId === "string" && body.sourceArticleId.trim().length > 0
          ? body.sourceArticleId.trim()
          : null;
    }
    if (body.sourceHash !== undefined) {
      updateData.source_hash =
        typeof body.sourceHash === "string" && body.sourceHash.trim().length > 0
          ? body.sourceHash.trim().slice(0, 80)
          : null;
    }

    if (Object.keys(updateData).length > 2) {
      const { error: updateError } = await supabase.from("knowledge_cards").update(updateData).eq("id", params.id);
      if (updateError) {
        console.error("[PATCH /api/doctor/content/cards/[id]] update error:", updateError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    if (body.linkArticleId !== undefined) {
      const articleId =
        typeof body.linkArticleId === "string" && body.linkArticleId.trim().length > 0
          ? body.linkArticleId.trim()
          : null;

      if (!articleId) {
        return NextResponse.json({ error: "linkArticleId must be a valid id" }, { status: 400 });
      }

      const relationType =
        body.linkRelationType === "draft" || body.linkRelationType === "published" ? body.linkRelationType : "seed";

      const { error: linkError } = await supabase.from("knowledge_card_article_links").upsert(
        {
          card_id: params.id,
          article_id: articleId,
          relation_type: relationType,
          created_by: user.id,
        },
        { onConflict: "card_id,article_id,relation_type" }
      );

      if (linkError) {
        console.error("[PATCH /api/doctor/content/cards/[id]] link error:", linkError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    if (body.unlinkArticleId !== undefined) {
      const articleId =
        typeof body.unlinkArticleId === "string" && body.unlinkArticleId.trim().length > 0
          ? body.unlinkArticleId.trim()
          : null;

      if (!articleId) {
        return NextResponse.json({ error: "unlinkArticleId must be a valid id" }, { status: 400 });
      }

      const { error: unlinkError } = await supabase
        .from("knowledge_card_article_links")
        .delete()
        .eq("card_id", params.id)
        .eq("article_id", articleId);

      if (unlinkError) {
        console.error("[PATCH /api/doctor/content/cards/[id]] unlink error:", unlinkError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    const { data: updated, error: updatedError } = await supabase
      .from("knowledge_cards")
      .select(
        "id, title, body_md, status, source, tags, source_article_id, source_hash, sort_order, is_active, created_by, updated_by, created_at, updated_at"
      )
      .eq("id", params.id)
      .single();

    if (updatedError || !updated) {
      console.error("[PATCH /api/doctor/content/cards/[id]] re-fetch error:", updatedError?.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ item: mapKnowledgeCardRow(updated as KnowledgeCardRow) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[PATCH /api/doctor/content/cards/[id]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    if (staffRole.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.from("knowledge_cards").delete().eq("id", params.id).select("id").maybeSingle();
    if (error) {
      console.error("[DELETE /api/doctor/content/cards/[id]] delete error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id: params.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/doctor/content/cards/[id]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
