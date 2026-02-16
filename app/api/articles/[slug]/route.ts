import { NextRequest, NextResponse } from "next/server";
import { getPublishedArticleBySlug } from "@/lib/content-service";
import { buildPublicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    slug: string;
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const article = await getPublishedArticleBySlug(context.params.slug);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      contentMd: article.contentMd,
      tags: article.tags,
      publishedAt: article.publishedAt,
      url: buildPublicUrl(`/articles/${article.slug}`),
    });
  } catch (error) {
    console.error("[GET /api/articles/[slug]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
