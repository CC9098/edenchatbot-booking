"use client";

import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { createBrowserClient } from "@/lib/supabase-browser";
import { getMobileUrlScheme, sanitizeAuthNextPath } from "@/lib/auth-redirect";
import { isNativeAppRuntime } from "@/lib/platform";

function isNativeOAuthCallback(url: string) {
  const expectedPrefix = `${getMobileUrlScheme()}://auth/callback`;
  return url.startsWith(expectedPrefix);
}

export function NativeOAuthListener() {
  useEffect(() => {
    if (!isNativeAppRuntime()) return;

    const handler = async (event: URLOpenListenerEvent) => {
      if (!event.url || !isNativeOAuthCallback(event.url)) return;

      const callbackUrl = new URL(event.url);
      const code = callbackUrl.searchParams.get("code");
      const next = sanitizeAuthNextPath(callbackUrl.searchParams.get("next"));

      if (!code) {
        window.location.href = `/login?error=auth&next=${encodeURIComponent(next)}`;
        return;
      }

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[native-oauth] Code exchange failed:", error.message);
        window.location.href = `/login?error=auth&next=${encodeURIComponent(next)}`;
        return;
      }

      try {
        await Browser.close();
      } catch {
        // Browser may already be closed; ignore.
      }

      window.location.href = next;
    };

    const listenerPromise = App.addListener("appUrlOpen", handler);

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
