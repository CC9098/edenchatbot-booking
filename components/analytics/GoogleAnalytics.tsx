import { Suspense } from 'react';
import { englishPath, englishRoutes } from '@/content/english/site';
import { GoogleAnalyticsClient } from './GoogleAnalyticsClient';

// Pass public paths/titles only; article bodies stay out of the browser bundle.
const englishPages = englishRoutes.filter(route => route.path !== '/book/').map(route => ({ path: englishPath(route.path), title: route.title }));

export function GoogleAnalytics() {
  return <Suspense fallback={null}><GoogleAnalyticsClient englishPages={englishPages} /></Suspense>;
}
