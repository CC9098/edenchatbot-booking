import { NextRequest, NextResponse } from "next/server";

import {
  decodeAuthorizationCode,
  encodeAccessToken,
  getCodeChallengeFromVerifier,
  isOAuthModeEnabled,
} from "@/lib/mcp/github-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isOAuthModeEnabled()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const body = await req.formData();
  const grantType = String(body.get("grant_type") || "");
  const code = String(body.get("code") || "");
  const redirectUri = String(body.get("redirect_uri") || "");
  const clientId = String(body.get("client_id") || "");
  const clientSecret = String(body.get("client_secret") || "");
  const codeVerifier = String(body.get("code_verifier") || "");

  if (grantType !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  if (
    clientId !== (process.env.MCP_OAUTH_CLIENT_ID || "") ||
    clientSecret !== (process.env.MCP_OAUTH_CLIENT_SECRET || "")
  ) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  let decodedCode;
  try {
    decodedCode = decodeAuthorizationCode(code);
  } catch {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  if (decodedCode.clientId !== clientId || decodedCode.redirectUri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  if (!codeVerifier || getCodeChallengeFromVerifier(codeVerifier) !== decodedCode.codeChallenge) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  const accessToken = encodeAccessToken({
    clientId,
    scopes: decodedCode.scope.split(" ").filter(Boolean),
    githubAccessToken: decodedCode.githubAccessToken,
    subject: decodedCode.subject,
  });

  const ttl = Number(process.env.MCP_ACCESS_TOKEN_TTL_SECONDS || "3600");

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ttl,
    scope: decodedCode.scope,
  });
}
