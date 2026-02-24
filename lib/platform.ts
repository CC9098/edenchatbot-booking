export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\bCapacitor\b/i.test(userAgent);
}

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

export function isNativeAppRuntime(): boolean {
  if (typeof window === "undefined") return false;

  const cap = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;

  const nativeByBridge =
    (typeof cap?.isNativePlatform === "function" && cap.isNativePlatform()) ||
    (typeof cap?.getPlatform === "function" && cap.getPlatform() !== "web");

  if (nativeByBridge) return true;
  return isNativeAppUserAgent(window.navigator.userAgent);
}
