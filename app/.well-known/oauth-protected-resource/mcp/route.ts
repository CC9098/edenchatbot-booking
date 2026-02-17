import { NextResponse } from "next/server";

import { createProtectedResourceMetadata } from "@/lib/mcp/github-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.MCP_PUBLIC_BASE_URL || "http://localhost:3333";
  return NextResponse.json(createProtectedResourceMetadata(baseUrl));
}
