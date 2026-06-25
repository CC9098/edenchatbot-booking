export const CHATWOOT_EDEN_TOOLS_PATH = "/chatwoot/eden-tools";
export const CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH = "/chatwoot/eden-tools/login-bridge";

export function getChatwootEdenToolsLoginPath() {
  const params = new URLSearchParams({ next: CHATWOOT_EDEN_TOOLS_LOGIN_BRIDGE_PATH });
  return `/login?${params.toString()}`;
}
