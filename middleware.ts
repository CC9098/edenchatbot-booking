import { NextRequest, NextResponse } from "next/server";

function normalizeHost(host: string | null): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

const primaryHost = normalizeHost(process.env.PRIMARY_HOST || null);
const redirectHosts = new Set(
  (process.env.REDIRECT_HOSTS || "")
    .split(",")
    .map((value) => normalizeHost(value))
    .filter((value) => value.length > 0)
);

function shouldBypass(request: NextRequest): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return true;

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/api/auth/callback") return true;

  return false;
}

export function middleware(request: NextRequest) {
  if (!primaryHost || redirectHosts.size === 0) {
    return NextResponse.next();
  }

  if (shouldBypass(request)) {
    return NextResponse.next();
  }

  const incomingHost = normalizeHost(
    request.headers.get("x-forwarded-host") || request.headers.get("host")
  );

  if (!incomingHost || incomingHost === primaryHost) {
    return NextResponse.next();
  }

  if (!redirectHosts.has(incomingHost)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = primaryHost;

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
