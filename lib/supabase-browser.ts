import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof _createBrowserClient> | null = null;

/**
 * Singleton Supabase client for use in Client Components.
 * Uses the anon key and respects RLS policies.
 */
export function createBrowserClient() {
  if (client) return client;

  client = _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
