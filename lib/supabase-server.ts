import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * Reads auth tokens from cookies automatically.
 *
 * NOTE: This uses the anon key (respects RLS). For admin operations,
 * use createServiceClient() from lib/supabase.ts instead.
 */
export function createServerClient() {
  const cookieStore = cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in Server Components where response headers
            // are read-only. This is expected — middleware handles refresh.
          }
        },
      },
    }
  );
}
