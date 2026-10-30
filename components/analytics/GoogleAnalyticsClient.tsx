'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analyticsPage, GA_MEASUREMENT_ID, recordPageView, type AnalyticsBrowser, type PublicAnalyticsPage } from '@/lib/analytics';

export function GoogleAnalyticsClient({ englishPages }: { englishPages: readonly PublicAnalyticsPage[] }) {
  const pathname = usePathname() || '/';
  const search = useSearchParams();
  const language = search.get('lang');
  const intent = search.get('intent');
  const [loadTag, setLoadTag] = useState(false);

  useEffect(() => {
    const page = analyticsPage(pathname, language, window.location.origin, englishPages, intent);
    setLoadTag(recordPageView(window as unknown as AnalyticsBrowser, GA_MEASUREMENT_ID, page, document.referrer, pathname));
  }, [pathname, language, intent, englishPages]);

  return loadTag ? <Script id="ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" /> : null;
}
