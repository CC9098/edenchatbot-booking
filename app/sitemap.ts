import type { MetadataRoute } from "next";
import { listPublishedArticles, listPublishedCourses } from "@/lib/content-service";
import { buildPublicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

const staticRoutes = [
  "/",
  "/articles",
  "/booking",
  "/booking-whatsapp",
  "/chat",
  "/courses",
  "/dr-wong",
  "/generalized-anxiety-disorder-gad7",
  "/manage-booking",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [articles, courses] = await Promise.all([
    listPublishedArticles(200),
    listPublishedCourses(100),
  ]);

  return [
    ...staticRoutes.map((route) => ({
      url: buildPublicUrl(route),
      lastModified: now,
      changeFrequency: route === "/" ? "weekly" as const : "monthly" as const,
      priority: route === "/" ? 1 : 0.7,
    })),
    ...articles.map((article) => ({
      url: buildPublicUrl(`/articles/${article.slug}`),
      lastModified: article.publishedAt ? new Date(article.publishedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...courses.map((course) => ({
      url: buildPublicUrl(`/courses/${course.slug}`),
      lastModified: course.publishedAt ? new Date(course.publishedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
