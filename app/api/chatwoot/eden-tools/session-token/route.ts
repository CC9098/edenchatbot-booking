import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  createChatwootEdenToolsSessionToken,
  verifyChatwootEdenToolsSessionToken,
} from "@/lib/chatwoot-eden-tools-session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const token = createChatwootEdenToolsSessionToken(staffRole);
    const session = verifyChatwootEdenToolsSessionToken(token);

    return NextResponse.json({
      token,
      expiresAt: session?.expiresAt ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[chatwoot/eden-tools/session-token] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
