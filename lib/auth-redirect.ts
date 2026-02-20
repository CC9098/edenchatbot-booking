const DEFAULT_PUBLIC_WEB_URL = "https://edenchatbot-booking.vercel.app";
const DEFAULT_MOBILE_SCHEME = "com.cc9098.edenchatbotbooking";

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getPublicWebBaseUrl() {
  const configured =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);

  if (configured) return configured;

  if (typeof window !== "undefined" && /^https?:\/\//.test(window.location.origin)) {
    return window.location.origin;
  }

  return DEFAULT_PUBLIC_WEB_URL;
}

export function getWebAuthCallbackUrl(next = "/chat") {
  const url = new URL("/api/auth/callback", getPublicWebBaseUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

export function getMobileUrlScheme() {
  const scheme = process.env.NEXT_PUBLIC_MOBILE_URL_SCHEME?.trim();
  return scheme || DEFAULT_MOBILE_SCHEME;
}

export function getNativeAuthCallbackUrl() {
  return `${getMobileUrlScheme()}://auth/callback`;
}
