import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    cache: "no-store",
  });

// Server-side Supabase client (service role - bypasses RLS)
export function createServiceClient() {
  const url = getRequiredEnv("SUPABASE_URL");
  const key = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  });
}

// Browser-side Supabase client (anon key - respects RLS)
export function createBrowserClient() {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key);
}
