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

function getAuthForRequest(req: NextRequest): {
  githubToken: string;
} {
  if (!isOAuthModeEnabled()) {
    const token = (process.env.GITHUB_TOKEN || "").trim();
    if (!token) {
      throw new Error("Missing GITHUB_TOKEN in static mode");
    }

    return {
      githubToken: token,
    };
  }

  const bearer = parseBearerToken(req.headers.get("authorization"));
  if (!bearer) {
    throw new Error("Missing bearer token");
  }

  const decoded = decodeAccessToken(bearer);
  if (!decoded.scopes.includes("mcp:tools")) {
    throw new Error("Insufficient scope");
  }

  return {
    githubToken: decoded.githubAccessToken,
  };
}

export async function POST(req: NextRequest) {
  let transport: WebStandardStreamableHTTPServerTransport | null = null;
  let server: ReturnType<typeof createMcpServer> | null = null;

  try {
    const parsedBody = await req.clone().json().catch(() => undefined);
    const auth = getAuthForRequest(req);

    server = createMcpServer(auth.githubToken);
    transport = new WebStandardStreamableHTTPServerTransport({
      // Stateless mode is more reliable on serverless runtimes.
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    return await transport.handleRequest(req as unknown as Request, {
      parsedBody,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("bearer") || message.includes("token")
        ? 401
        : message.includes("scope") || message.includes("mismatch")
          ? 403
          : 500;

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message,
        },
        id: null,
      },
      { status },
    );
  } finally {
    await transport?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  }
}

export async function GET() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed in stateless mode. Use POST /mcp." },
      id: null,
    },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed in stateless mode. Use POST /mcp." },
      id: null,
    },
    { status: 405 },
  );
}
