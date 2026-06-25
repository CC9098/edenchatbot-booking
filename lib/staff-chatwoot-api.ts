export type ChatwootConfig = {
  baseUrl: string;
  apiAccessToken: string;
  accountId: number | null;
};

export function getStaffChatwootConfig(): ChatwootConfig {
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

export async function staffChatwootRequest<T>(
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

export async function resolveStaffChatwootAccountId(
  baseUrl: string,
  apiAccessToken: string,
  configuredAccountId: number | null,
): Promise<number> {
  if (configuredAccountId) return configuredAccountId;

  const profile = await staffChatwootRequest<{
    account_id?: number;
    accounts?: Array<{ id?: number }>;
  }>(baseUrl, apiAccessToken, "/api/v1/profile");

  const accountId = profile.account_id || profile.accounts?.find((account) => account.id)?.id;
  if (!accountId) throw new Error("Unable to resolve Chatwoot account");
  return accountId;
}
