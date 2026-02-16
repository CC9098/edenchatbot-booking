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

    const staffRole = await requireStaffRole(user.id);
    if (staffRole.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }

    const body = await request.json();
    const supabase = createServiceClient();

    const { data: existing, error: existingError } = await supabase
      .from("articles")
      .select(
        "id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at, created_by, created_at, updated_at"
      )
      .eq("id", params.id)
      .maybeSingle();

    if (existingError) {
      console.error("[PATCH /api/doctor/content/articles/[id]] fetch error:", existingError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      const title = parseRequiredString(body.title, "title", 1, 180);
      updateData.title = title;
    }

    if (body.excerpt !== undefined) {
      updateData.excerpt = parseOptionalString(body.excerpt, 360);
    }

    if (body.contentMd !== undefined) {
      updateData.content_md = parseRequiredString(body.contentMd, "contentMd", 1, 50000);
    }

    if (body.coverImageUrl !== undefined) {
      updateData.cover_image_url = parseOptionalString(body.coverImageUrl, 2000);
    }

    if (body.tags !== undefined) {
      updateData.tags = sanitizeTags(body.tags);
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
      }
      updateData.is_active = body.isActive;
    }

    if (body.slug !== undefined || body.title !== undefined) {
      const nextTitle = (updateData.title as string | undefined) || existing.title;
      const nextSlug = await resolveUniqueArticleSlug({
        supabase,
        slug: typeof body.slug === "string" ? body.slug : existing.slug,
        title: nextTitle,
        excludeId: params.id,
      });
      updateData.slug = nextSlug;
    }

    const publishNow = body.publishNow === true;
    const unpublish = body.unpublish === true;
    if (publishNow) {
      updateData.published_at = new Date().toISOString();
      updateData.is_active = true;
    } else if (unpublish) {
      updateData.published_at = null;
    } else if (body.publishedAt !== undefined) {
      updateData.published_at = parseNullableIsoDate(body.publishedAt, "publishedAt");
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("articles")
      .update(updateData)
      .eq("id", params.id)
      .select(
        "id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at, created_by, created_at, updated_at"
      )
      .single();

    if (updateError) {
      console.error("[PATCH /api/doctor/content/articles/[id]] update error:", updateError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ item: mapArticleRow(updated as ArticleRow) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[PATCH /api/doctor/content/articles/[id]] unexpected error:", error);
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
    const { data, error } = await supabase
      .from("articles")
      .delete()
      .eq("id", params.id)
      .select(
        "id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at, created_by, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/doctor/content/articles/[id]] delete error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({ item: mapArticleRow(data as ArticleRow) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/doctor/content/articles/[id]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
