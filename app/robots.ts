import type { MetadataRoute } from "next";
import { buildPublicUrl, getPublicBaseUrl } from "@/lib/public-url";

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
    sitemap: buildPublicUrl("/sitemap.xml"),
    host: getPublicBaseUrl(),
  };
}
