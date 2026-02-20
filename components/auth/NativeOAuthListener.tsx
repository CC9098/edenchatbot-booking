"use client";

import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createBrowserClient } from "@/lib/supabase-browser";
import { getMobileUrlScheme } from "@/lib/auth-redirect";

function isNativeOAuthCallback(url: string) {
  const expectedPrefix = `${getMobileUrlScheme()}://auth/callback`;
  return url.startsWith(expectedPrefix);
}

export function NativeOAuthListener() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handler = async (event: URLOpenListenerEvent) => {
      if (!event.url || !isNativeOAuthCallback(event.url)) return;

      const callbackUrl = new URL(event.url);
      const code = callbackUrl.searchParams.get("code");

      if (!code) {
        window.location.href = "/login?error=auth";
        return;
      }

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[native-oauth] Code exchange failed:", error.message);
        window.location.href = "/login?error=auth";
        return;
      }

      try {
        await Browser.close();
      } catch {
        // Browser may already be closed; ignore.
      }

      window.location.href = "/chat";
    };

    const listenerPromise = App.addListener("appUrlOpen", handler);

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
