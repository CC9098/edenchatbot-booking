const DEFAULT_PUBLIC_WEB_URL = "https://edenchatbot-booking.vercel.app";
const DEFAULT_MOBILE_SCHEME = "com.cc9098.edenchatbotbooking";
const DEFAULT_AUTH_NEXT = "/chat";

type GoogleOAuthOptions = {
  redirectTo: string;
  queryParams: {
    prompt: "select_account";
  };
  skipBrowserRedirect?: true;
};

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getPublicWebBaseUrl() {
  if (typeof window !== "undefined" && /^https?:\/\//.test(window.location.origin)) {
    return window.location.origin;
  }

  const configured =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);

  if (configured) return configured;

  return DEFAULT_PUBLIC_WEB_URL;
}

export function sanitizeAuthNextPath(next?: string | null, fallback = DEFAULT_AUTH_NEXT) {
  if (!next) return fallback;

  const trimmed = next.trim();
  if (!trimmed) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  return trimmed;
}

export function getWebAuthCallbackUrl(next = DEFAULT_AUTH_NEXT) {
  const url = new URL("/api/auth/callback", getPublicWebBaseUrl());
  url.searchParams.set("next", sanitizeAuthNextPath(next));
  return url.toString();
}

export function getMobileUrlScheme() {
  const scheme = process.env.NEXT_PUBLIC_MOBILE_URL_SCHEME?.trim();
  return scheme || DEFAULT_MOBILE_SCHEME;
}

export function getNativeAuthCallbackUrl(next = DEFAULT_AUTH_NEXT) {
  const url = new URL(`${getMobileUrlScheme()}://auth/callback`);
  url.searchParams.set("next", sanitizeAuthNextPath(next));
  return url.toString();
}

export function buildGoogleOAuthOptions(
  next = DEFAULT_AUTH_NEXT,
  isNative = false,
): GoogleOAuthOptions {
  const safeNext = sanitizeAuthNextPath(next);

  if (isNative) {
    return {
      redirectTo: getNativeAuthCallbackUrl(safeNext),
      skipBrowserRedirect: true,
      queryParams: {
        prompt: "select_account",
      },
    };
  }

  return {
    redirectTo: getWebAuthCallbackUrl(safeNext),
    queryParams: {
      prompt: "select_account",
    },
  };
}
