export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '';

// Staff and integration pages must not count as patient traffic.
const UNTRACKED_PATH_PREFIXES = [
  '/doctor',
  '/nurse',
  '/record',
  '/instructiontable',
  '/chatwoot',
  '/mcp',
  '/oauth',
  '/authorize',
];

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

// Never pass patient-identifying data (name, phone, email, notes) in params.
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;
  (window as GtagWindow).gtag?.('event', name, params);
}
