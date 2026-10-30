export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

export type PublicAnalyticsPage = { path: string; title: string };
export type AnalyticsPage = { page_path: string; page_location: string; page_title: string; content_language: 'en' | 'zh-Hant' };
type AnalyticsState = { configuredId?: string; lastPageKey?: string; previousPage?: string };
export type AnalyticsBrowser = { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[]; edenAnalytics?: AnalyticsState; [key: string]: unknown };

// Public titles are fixed; document.title can contain private account data.
const PUBLIC_PAGES: Record<string, string> = {
  '/': 'Eden Clinic', '/en': 'Eden Clinic | Chinese medicine in Hong Kong',
  '/articles': 'Articles | Eden Clinic', '/courses': 'Courses | Eden Clinic', '/care': 'Care | Eden Clinic',
  '/chat': 'Eden Clinic', '/chat/symptoms': 'Eden Clinic', '/chat/symptoms/tendency-quiz': 'Eden Clinic',
  '/dr-wong': 'Dr. Wong | Eden Clinic', '/dr-lee-chin-lam': 'Dr. Lee | Eden Clinic',
  '/generalized-anxiety-disorder-gad7': 'GAD-7 | Eden Clinic', '/overseas-online-consultation': 'Online consultation | Eden Clinic',
  '/booking': '預約服務 | 醫天圓', '/booking-whatsapp': '預約服務 | 醫天圓', '/en/booking': 'Book an appointment | Eden Clinic',
  '/embed': 'Eden Clinic widget', '/embed/booking': '預約服務 | 醫天圓', '/embed/booking-whatsapp': '預約服務 | 醫天圓', '/embed/timetable': 'Eden Clinic timetable',
  '/privacy': 'Privacy | Eden Clinic', '/privacy-policy': 'Privacy | Eden Clinic', '/terms': 'Terms | Eden Clinic',
  '/terms-of-service': 'Terms | Eden Clinic', '/data-deletion': 'Data deletion | Eden Clinic', '/chatwoot-privacy': 'Privacy | Eden Clinic',
};
const BOOKING_PATHS = new Set(['/booking', '/booking-whatsapp', '/en/booking', '/embed', '/embed/booking', '/embed/booking-whatsapp']);
const DOCTOR_IDS = new Set(['chan', 'lee', 'hon', 'chau', 'cheung', 'cheungmy', 'leung', 'wong']);
const CLINIC_IDS = new Set(['central', 'jordan', 'tsuenwan', 'online']);

function publicPage(pathname: string, englishPages: readonly PublicAnalyticsPage[]) {
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  const english = englishPages.find(page => page.path === path);
  if (english) return { path, title: english.title };
  if (PUBLIC_PAGES[path]) return { path, title: PUBLIC_PAGES[path] };
  // Group dynamic app content without sending arbitrary URL slugs.
  if (/^\/articles\/[^/]+$/.test(path)) return { path: '/articles/[article]', title: 'Article | Eden Clinic' };
  if (/^\/courses\/[^/]+(?:\/lessons\/[^/]+)?$/.test(path)) return { path: path.includes('/lessons/') ? '/courses/[course]/lessons/[lesson]' : '/courses/[course]', title: 'Course | Eden Clinic' };
  return null;
}

export function isTrackedPath(pathname: string, englishPages: readonly PublicAnalyticsPage[] = []): boolean {
  return publicPage(pathname, englishPages) !== null;
}

export function analyticsPage(pathname: string, language: string | null, origin: string, englishPages: readonly PublicAnalyticsPage[] = [], widgetIntent: string | null = null): AnalyticsPage | null {
  const page = publicPage(pathname, englishPages);
  if (!page || (page.path === '/embed' && widgetIntent === 'manage-booking')) return null;
  let base: URL;
  try { base = new URL(origin); } catch { return null; }
  if (!['https:', 'http:'].includes(base.protocol)) return null;
  const content_language = pathname === '/en' || pathname.startsWith('/en/') || language === 'en' ? 'en' : 'zh-Hant';
  const title = content_language === 'en' && BOOKING_PATHS.has(page.path) ? 'Book an appointment | Eden Clinic' : page.title;
  return { page_path: page.path, page_location: `${base.origin}${page.path}`, page_title: title, content_language };
}

export function analyticsReferrer(value: string): string {
  try { const referrer = new URL(value); return ['https:', 'http:'].includes(referrer.protocol) ? referrer.origin : ''; } catch { return ''; }
}

/** Queue a safe context before gtag loads; explicitly update it on public routes. */
export function recordPageView(browser: AnalyticsBrowser, measurementId: string, page: AnalyticsPage | null, initialReferrer = '', routeKey = page?.page_path || ''): boolean {
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) return false;
  browser[`ga-disable-${measurementId}`] = !page;
  const state = browser.edenAnalytics ||= {};
  if (!page) { state.lastPageKey = undefined; state.previousPage = undefined; return false; }
  const key = `${routeKey}|${page.content_language}`;
  if (state.lastPageKey === key && state.configuredId === measurementId) return true;
  browser.dataLayer ||= [];
  browser.gtag ||= function () { browser.dataLayer!.push(arguments); };
  const context = { ...page, page_referrer: state.previousPage || analyticsReferrer(initialReferrer) };
  const configured = state.configuredId === measurementId;
  if (!configured) browser.gtag('js', new Date());
  browser.gtag('set', context);
  browser.gtag('config', measurementId, { ...context, send_page_view: false, ...(configured ? { update: true } : {}), allow_google_signals: false, allow_ad_personalization_signals: false });
  browser.gtag('event', 'page_view', context);
  state.configuredId = measurementId;
  state.lastPageKey = key;
  state.previousPage = page.page_location;
  return true;
}

export function bookingCompletedParams(page: AnalyticsPage | null, params: Record<string, unknown>) {
  if (!page || !BOOKING_PATHS.has(page.page_path) || params.booking_flow === 'staff') return null;
  return { ...page,
    ...(typeof params.doctor_id === 'string' && DOCTOR_IDS.has(params.doctor_id) ? { doctor_id: params.doctor_id } : {}),
    ...(typeof params.clinic_id === 'string' && CLINIC_IDS.has(params.clinic_id) ? { clinic_id: params.clinic_id } : {}),
    ...(params.booking_flow === 'whatsapp' ? { booking_flow: 'whatsapp' } : {}),
  };
}

// Preserve the existing key event; only public enumerated conversion parameters survive.
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (name !== 'booking_completed' || !GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  const query = new URLSearchParams(window.location.search);
  const page = analyticsPage(window.location.pathname, query.get('lang'), window.location.origin, [], query.get('intent'));
  const safeParams = bookingCompletedParams(page, params);
  if (safeParams) (window as unknown as AnalyticsBrowser).gtag?.('event', name, safeParams);
}
