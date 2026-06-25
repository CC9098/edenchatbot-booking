import { NextRequest, NextResponse } from "next/server";

import { verifyChatwootEdenToolsRequest } from "@/lib/chatwoot-eden-tools-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifyChatwootEdenToolsRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    userId: session.userId,
    role: session.role,
    staffKind: session.staffKind,
    expiresAt: session.expiresAt,
  });
}
