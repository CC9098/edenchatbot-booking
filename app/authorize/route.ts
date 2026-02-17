import { NextRequest, NextResponse } from "next/server";

import { encodeOAuthState, isOAuthModeEnabled } from "@/lib/mcp/github-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRedirectUriAllowed(uri: string): boolean {
  const raw = process.env.MCP_OAUTH_ALLOWED_REDIRECT_ORIGINS ?? "";
  const allowed = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    return true;
  }

  try {
    const parsed = new URL(uri);
    return allowed.includes(parsed.origin);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isOAuthModeEnabled()) {
    return new NextResponse("OAuth mode is not enabled", { status: 400 });
  }

  const responseType = req.nextUrl.searchParams.get("response_type") || "";
  const clientId = req.nextUrl.searchParams.get("client_id") || "";
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const codeChallenge = req.nextUrl.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = req.nextUrl.searchParams.get("code_challenge_method") || "";
  const scope = req.nextUrl.searchParams.get("scope") || "mcp:tools";

  if (responseType !== "code") {
    return new NextResponse("Unsupported response_type", { status: 400 });
  }

  if (!redirectUri || !isRedirectUriAllowed(redirectUri)) {
    return new NextResponse("Invalid redirect_uri", { status: 400 });
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return new NextResponse("PKCE S256 is required", { status: 400 });
  }

  const mcpBase = (process.env.MCP_PUBLIC_BASE_URL || "http://localhost:3333").trim();
  const githubOAuthClientId = (process.env.GITHUB_OAUTH_CLIENT_ID || "").trim();
  const githubOAuthScopes = (process.env.GITHUB_OAUTH_SCOPES || "repo read:user").trim();
  const githubAuthUrl = new URL(
    (process.env.GITHUB_AUTH_URL || "https://github.com/login/oauth/authorize").trim(),
  );

  githubAuthUrl.searchParams.set("client_id", githubOAuthClientId);
  githubAuthUrl.searchParams.set("redirect_uri", `${new URL(mcpBase).origin}/oauth/github/callback`);
  githubAuthUrl.searchParams.set("scope", githubOAuthScopes);
  githubAuthUrl.searchParams.set(
    "state",
    encodeOAuthState({
      clientId,
      redirectUri,
      state,
      codeChallenge,
      scope,
    }),
  );

  return NextResponse.redirect(githubAuthUrl.toString());
}
