const DEFAULT_PUBLIC_BASE_URL = "https://edenchatbot-booking.vercel.app";

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getPublicBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  const configuredBaseUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(process.env.BASE_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const vercelProductionUrl = normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelProductionUrl) {
    return vercelProductionUrl;
  }

  if (process.env.VERCEL_ENV === "production") {
    const vercelProductionDeploymentUrl = normalizeBaseUrl(process.env.VERCEL_URL);
    if (vercelProductionDeploymentUrl) {
      return vercelProductionDeploymentUrl;
    }
  }

  const previewDeploymentUrl = normalizeBaseUrl(process.env.VERCEL_URL);
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
