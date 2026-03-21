export function getPublicBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
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
