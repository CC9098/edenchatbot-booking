export const CHATWOOT_EDEN_TOOLS_PATH = "/chatwoot/eden-tools";

export function getChatwootEdenToolsLoginPath() {
  const params = new URLSearchParams({ next: CHATWOOT_EDEN_TOOLS_PATH });
  return `/login?${params.toString()}`;
}
