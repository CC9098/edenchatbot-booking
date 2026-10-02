import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { CHATWOOT_EDEN_TOOLS_ACCESS_TOKEN_HEADER } from "@/lib/chatwoot-eden-tools-auth";
import {
  createChatwootEdenToolsSessionToken,
  verifyChatwootEdenToolsSessionToken,
} from "@/lib/chatwoot-eden-tools-session";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function getVerifiedUser(request: Request) {
  const accessToken = request.headers.get(CHATWOOT_EDEN_TOOLS_ACCESS_TOKEN_HEADER)?.trim();
  if (!accessToken) return getCurrentUser();

  const {
    data: { user },
    error,
  } = await createServiceClient().auth.getUser(accessToken);

  if (error || !user) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const staffRole = await requireStaffRole(user.id);
    const token = createChatwootEdenToolsSessionToken(staffRole);
    const session = verifyChatwootEdenToolsSessionToken(token);

    return json({
      token,
      expiresAt: session?.expiresAt ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }

    console.error("[chatwoot/eden-tools/session-token] unexpected error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
