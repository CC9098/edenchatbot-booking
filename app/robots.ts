import type { MetadataRoute } from "next";
import { buildPublicUrl, getPublicBaseUrl } from "@/lib/public-url";
import { ENGLISH_SITEMAP_URL, isEnglishPublished } from "@/lib/english-publication-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/articles",
          "/booking",
          "/booking-whatsapp",
          "/chat",
          "/courses",
          "/dr-wong",
          "/manage-booking",
        ],
        disallow: [
          "/api/",
          "/doctor/",
          "/nurse/",
          "/login",
          "/record",
          "/token",
          "/authorize",
          "/instructiontable",
        ],
      },
    ],
    sitemap: isEnglishPublished() ? [buildPublicUrl("/sitemap.xml"), ENGLISH_SITEMAP_URL] : buildPublicUrl("/sitemap.xml"),
    host: getPublicBaseUrl(),
  };
}
