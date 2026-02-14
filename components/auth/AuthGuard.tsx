"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/**
 * Wraps children with an authentication check.
 * Redirects to /login if the user is not signed in.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2d5016] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Will redirect in the effect above; render nothing to avoid flash.
    return null;
  }

  return <>{children}</>;
}
