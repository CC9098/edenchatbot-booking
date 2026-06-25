import { NextRequest, NextResponse } from "next/server";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";

export const dynamic = "force-dynamic";

type ChatwootContact = {
  id?: number;
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
};

function getChatwootConfig() {
  const baseUrl = (process.env.CHATWOOT_BASE_URL || "").trim().replace(/\/$/, "");
  const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || "").trim();
  const configuredAccountId = Number(process.env.CHATWOOT_ACCOUNT_ID || "");

  if (!baseUrl || !apiAccessToken) {
    throw new Error("Chatwoot is not configured");
  }

  return {
    baseUrl,
    apiAccessToken,
    accountId: Number.isFinite(configuredAccountId) && configuredAccountId > 0
      ? configuredAccountId
      : null,
  };
}

async function chatwootRequest<T>(
  baseUrl: string,
  apiAccessToken: string,
  path: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      api_access_token: apiAccessToken,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[Chatwoot] ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function resolveAccountId(
  baseUrl: string,
  apiAccessToken: string,
  configuredAccountId: number | null,
): Promise<number> {
  if (configuredAccountId) return configuredAccountId;

  const profile = await chatwootRequest<{
    account_id?: number;
    accounts?: Array<{ id?: number }>;
  }>(baseUrl, apiAccessToken, "/api/v1/profile");

  const accountId = profile.account_id || profile.accounts?.find((account) => account.id)?.id;
  if (!accountId) throw new Error("Unable to resolve Chatwoot account");
  return accountId;
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffRoleWithChatwootEdenToolsToken(request);

    const query = (request.nextUrl.searchParams.get("q") || "").trim();
    if (query.length < 2) {
      return NextResponse.json({ contacts: [] });
    }

    const { baseUrl, apiAccessToken, accountId: configuredAccountId } = getChatwootConfig();
    const accountId = await resolveAccountId(baseUrl, apiAccessToken, configuredAccountId);
    const searchParams = new URLSearchParams({ q: query });
    const response = await chatwootRequest<{ payload?: ChatwootContact[] }>(
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
