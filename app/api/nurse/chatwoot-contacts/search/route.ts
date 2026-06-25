import { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";
import {
  getStaffChatwootConfig,
  resolveStaffChatwootAccountId,
  staffChatwootRequest,
} from "@/lib/staff-chatwoot-api";
import { shouldSearchStaffContactQuery } from "@/lib/staff-contact-search";

export const dynamic = "force-dynamic";

type ChatwootContact = {
  id?: number;
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireStaffRoleWithChatwootEdenToolsToken(request);

    const query = (request.nextUrl.searchParams.get("q") || "").trim();
    if (!shouldSearchStaffContactQuery(query)) {
      return NextResponse.json({ contacts: [] });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getStaffChatwootConfig();
    const accountId = await resolveStaffChatwootAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const searchParams = new URLSearchParams({ q: query });
    const response = await staffChatwootRequest<{ payload?: ChatwootContact[] }>(
      baseUrl,
      apiAccessToken,
      `/api/v1/accounts/${accountId}/contacts/search?${searchParams.toString()}`,
    );

    const contacts = (response.payload || [])
      .filter((contact) => contact.id && contact.phone_number)
      .slice(0, 8)
      .map((contact) => ({
        id: contact.id,
        name: (contact.name || contact.phone_number || "").trim(),
        phoneNumber: (contact.phone_number || "").trim(),
      }));

    return NextResponse.json({ contacts });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/chatwoot-contacts/search] unexpected error:", error);
    return NextResponse.json({ error: "搜尋客戶失敗" }, { status: 500 });
  }
}
