const DEFAULT_PUBLIC_BASE_URL = "https://edenchatbot-booking.vercel.app";
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

function parseBaseUrl(value?: string | null): URL | null {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return null;

  try {
    return new URL(normalized);
  } catch {
    return null;
  }
}

function getAllowedVercelHosts(): Set<string> {
  const hosts = [
    parseBaseUrl(DEFAULT_PUBLIC_BASE_URL)?.hostname,
    parseBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)?.hostname,
    parseBaseUrl(process.env.PRIMARY_HOST)?.hostname,
  ].filter((value): value is string => Boolean(value));

  return new Set(hosts);
}

function isSafeServerPublicBaseUrl(url: URL, allowedVercelHosts: Set<string>): boolean {
  if (LOCALHOST_HOSTS.has(url.hostname)) {
    return true;
  }

  if (!url.hostname.endsWith(".vercel.app")) {
    return true;
  }

  return allowedVercelHosts.has(url.hostname);
}

function getSafeServerCandidate(
  label: string,
  value: string | null | undefined,
  allowedVercelHosts: Set<string>,
): string | null {
  const url = parseBaseUrl(value);
  if (!url) return null;

  if (isSafeServerPublicBaseUrl(url, allowedVercelHosts)) {
    return url.toString().replace(/\/$/, "");
  }

  console.warn(`[public-url] Ignoring unsafe preview/developer host from ${label}: ${url.hostname}`);
  return null;
}

export function getPublicBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const allowedVercelHosts = getAllowedVercelHosts();
  const configuredCandidates = [
    ["NEXT_PUBLIC_BASE_URL", process.env.NEXT_PUBLIC_BASE_URL],
    ["NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL],
    ["BASE_URL", process.env.BASE_URL],
    ["VERCEL_PROJECT_PRODUCTION_URL", process.env.VERCEL_PROJECT_PRODUCTION_URL],
  ] as const;

  for (const [label, value] of configuredCandidates) {
    const candidate = getSafeServerCandidate(label, value, allowedVercelHosts);
    if (candidate) {
      return candidate;
    }
  }

  if (process.env.VERCEL_ENV === "production") {
    const vercelProductionDeploymentUrl = getSafeServerCandidate(
      "VERCEL_URL(production)",
      process.env.VERCEL_URL,
      allowedVercelHosts,
    );
    if (vercelProductionDeploymentUrl) {
      return vercelProductionDeploymentUrl;
    }
  }

  const previewDeploymentUrl = getSafeServerCandidate(
    "VERCEL_URL",
    process.env.VERCEL_URL,
    allowedVercelHosts,
  );
  if (previewDeploymentUrl) {
    return previewDeploymentUrl;
  }

  return DEFAULT_PUBLIC_BASE_URL;
}

export function buildPublicUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicBaseUrl()}${normalizedPath}`;
}

export type BookingVisitType = "first" | "followup";

export function buildBookingUrl(options?: {
  doctorId?: string;
  clinicId?: string;
  visitType?: BookingVisitType;
  embed?: boolean;
}): string {
  const params = new URLSearchParams();

  if (options?.doctorId) {
    params.set("doctor", options.doctorId);
  }

  if (options?.clinicId) {
    params.set("clinic", options.clinicId);
  }

  if (options?.visitType) {
    params.set("visitType", options.visitType);
  }

  const pathname = options?.embed ? "/embed/booking" : "/booking";
  const query = params.toString();
  return buildPublicUrl(query ? `${pathname}?${query}` : pathname);
}
