export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\bCapacitor\b/i.test(userAgent);
}

export const PATIENT_MOBILE_CHROME_MAX_WIDTH = 1024;

export function isMobileBrowserUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /\b(Android|iPhone|iPad|iPod|Mobile|Windows Phone)\b/i.test(userAgent);
}

export function shouldUsePatientMobileChrome(
  userAgent: string | null | undefined,
  width: number,
): boolean {
  return (
    isNativeAppUserAgent(userAgent) ||
    (isMobileBrowserUserAgent(userAgent) && width <= PATIENT_MOBILE_CHROME_MAX_WIDTH)
  );
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
