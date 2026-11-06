import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import { CHATWOOT_EDEN_TOOLS_DEVICE_STORAGE_KEY } from "@/lib/chatwoot-eden-tools-auth";

let deviceClient: SupabaseClient | null = null;

function assertPersistentStorageAvailable() {
  const probeKey = `${CHATWOOT_EDEN_TOOLS_DEVICE_STORAGE_KEY}.probe`;

  try {
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
  } catch {
    throw new Error("DEVICE_STORAGE_UNAVAILABLE");
  }
}

export function getChatwootEdenToolsDeviceClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Chatwoot Eden Tools device auth is browser-only");
  }
  if (deviceClient) return deviceClient;

  assertPersistentStorageAvailable();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Chatwoot Eden Tools auth is not configured");
  }

  deviceClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        storage: window.localStorage,
        storageKey: CHATWOOT_EDEN_TOOLS_DEVICE_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );

  return deviceClient;
}

export async function getChatwootEdenToolsDeviceSession(): Promise<Session | null> {
  const client = getChatwootEdenToolsDeviceClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) return null;

  const expiresAt = (data.session.expires_at ?? 0) * 1000;
  if (expiresAt > Date.now() + 60_000) return data.session;

  const refreshed = await client.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  return refreshed.data.session;
}

export async function pairChatwootEdenToolsDevice(email: string, password: string) {
  const client = getChatwootEdenToolsDeviceClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("DEVICE_SESSION_MISSING");
  return data.session;
}

export async function forgetChatwootEdenToolsDevice() {
  if (!deviceClient && typeof window !== "undefined") {
    window.localStorage.removeItem(CHATWOOT_EDEN_TOOLS_DEVICE_STORAGE_KEY);
    return;
  }

  await deviceClient?.auth.signOut({ scope: "local" });
}
