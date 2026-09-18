export const CHATWOOT_EDEN_TOOLS_PATH = "/chatwoot/eden-tools";
export const CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH = "/chatwoot/eden-tools/login-bridge";
export const CHATWOOT_EDEN_TOOLS_DEVICE_STORAGE_KEY = "eden.chatwootTools.deviceSession";
export const CHATWOOT_EDEN_TOOLS_ACCESS_TOKEN_HEADER = "x-eden-tools-access-token";
export const CHATWOOT_EDEN_TOOLS_SHARED_EMAIL = "tsuenwan.nurse@edenclinic.hk";

const SESSION_RENEWAL_LEAD_MS = 5 * 60 * 1000;
const MINIMUM_SESSION_RENEWAL_DELAY_MS = 5 * 1000;

export function getChatwootEdenToolsLoginPath() {
  const params = new URLSearchParams({ next: CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH });
  return `/login?${params.toString()}`;
}

export function getChatwootEdenToolsSessionRenewalDelay(
  expiresAt: number,
  now = Date.now(),
): number {
  return Math.max(
    MINIMUM_SESSION_RENEWAL_DELAY_MS,
    expiresAt - now - SESSION_RENEWAL_LEAD_MS,
  );
}
