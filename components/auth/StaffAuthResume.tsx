"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createBrowserClient } from "@/lib/supabase-browser";
import {
  parsePendingStaffAuthResume,
  shouldResumeStaffAuthFromLocation,
  STAFF_AUTH_RESUME_STORAGE_KEY,
} from "@/lib/staff-auth-resume";

export function StaffAuthResume() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (!shouldResumeStaffAuthFromLocation(pathname, searchParams.has("next"))) return;

    const pendingPath = parsePendingStaffAuthResume(
      window.localStorage.getItem(STAFF_AUTH_RESUME_STORAGE_KEY),
    );

    if (!pendingPath) {
      window.localStorage.removeItem(STAFF_AUTH_RESUME_STORAGE_KEY);
      return;
    }

    const supabase = createBrowserClient();
    let active = true;

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const session = data.session;
      if (!active || !session?.user) return;

      window.localStorage.removeItem(STAFF_AUTH_RESUME_STORAGE_KEY);
      router.replace(pendingPath);
    });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  return null;
}
