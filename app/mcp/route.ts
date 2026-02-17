import { NextRequest, NextResponse } from "next/server";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import {
  createMcpServer,
  decodeAccessToken,
  isOAuthModeEnabled,
  parseBearerToken,
} from "@/lib/mcp/github-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGithubTokenForRequest(req: NextRequest): string {
  if (!isOAuthModeEnabled()) {
    const token = process.env.GITHUB_TOKEN || "";
    if (!token) {
      throw new Error("Missing GITHUB_TOKEN in static mode");
    }
    return token;
  }

  const bearer = parseBearerToken(req.headers.get("authorization"));
  if (!bearer) {
    throw new Error("Missing bearer token");
  }

  const decoded = decodeAccessToken(bearer);
  if (!decoded.scopes.includes("mcp:tools")) {
    throw new Error("Insufficient scope");
  }

  return decoded.githubAccessToken;
}

export async function POST(req: NextRequest) {
  try {
    const githubToken = getGithubTokenForRequest(req);
    const server = createMcpServer(githubToken);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(req as unknown as Request);
    await transport.close();
    await server.close();
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const code = message.includes("Missing bearer") ? 401 : message.includes("scope") ? 403 : 500;
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message,
        },
        id: null,
      },
      { status: code },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST /mcp" },
      id: null,
    },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST /mcp" },
      id: null,
    },
    { status: 405 },
  );
}
