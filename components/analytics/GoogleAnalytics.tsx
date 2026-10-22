"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID, isTrackedPath } from "@/lib/analytics";

export function GoogleAnalytics() {
  const pathname = usePathname() || "/";
  if (!GA_MEASUREMENT_ID) return null;

  // gtag honours this flag on every hit, so client-side navigation into staff pages stops tracking too.
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = !isTrackedPath(pathname);
  }

  return (
    <>
      <Script
        id="ga4-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
window['ga-disable-${GA_MEASUREMENT_ID}'] = ${JSON.stringify(!isTrackedPath(pathname))};
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
