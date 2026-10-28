"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isEnglishPublicRoute } from "@/lib/public-language";

/** Keep the document language correct when navigating between shared public routes. */
export function PublicDocumentLanguage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const english = isEnglishPublicRoute(pathname, searchParams.get("lang"));

  useEffect(() => {
    document.documentElement.lang = english ? "en-HK" : "zh-Hant-HK";
  }, [english]);

  return null;
}
