import { NextRequest, NextResponse } from "next/server";

import { decodeOAuthState, encodeAuthorizationCode, isOAuthModeEnabled } from "@/lib/mcp/github-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isOAuthModeEnabled()) {
    return new NextResponse("OAuth mode is not enabled", { status: 400 });
  }

  const githubCode = req.nextUrl.searchParams.get("code") || "";
  const encodedState = req.nextUrl.searchParams.get("state") || "";

  if (!githubCode || !encodedState) {
    return new NextResponse("Invalid OAuth callback", { status: 400 });
  }

  let tx;
  try {
    tx = decodeOAuthState(encodedState);
  } catch {
    return new NextResponse("OAuth state invalid or expired", { status: 400 });
  }

  const baseUrl = process.env.MCP_PUBLIC_BASE_URL || "http://localhost:3333";

  const tokenResponse = await fetch(
    process.env.GITHUB_TOKEN_URL || "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID || "",
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET || "",
        code: githubCode,
        redirect_uri: `${new URL(baseUrl).origin}/oauth/github/callback`,
      }),
    },
  );

  if (!tokenResponse.ok) {
    return new NextResponse("GitHub token exchange failed", { status: 500 });
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    return new NextResponse("No GitHub access token returned", { status: 500 });
  }

  const meResponse = await fetch(`${process.env.GITHUB_API_BASE_URL || "https://api.github.com"}/user`, {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!meResponse.ok) {
    return new NextResponse("Failed to fetch GitHub user", { status: 500 });
  }

  const me = (await meResponse.json()) as { id: number };

  const code = encodeAuthorizationCode({
    clientId: tx.clientId,
    redirectUri: tx.redirectUri,
    scope: tx.scope,
    codeChallenge: tx.codeChallenge,
    githubAccessToken: tokenJson.access_token,
    subject: String(me.id),
  });

  const redirect = new URL(tx.redirectUri);
  redirect.searchParams.set("code", code);
  if (tx.state) {
    redirect.searchParams.set("state", tx.state);
  }

  return NextResponse.redirect(redirect.toString());
}
