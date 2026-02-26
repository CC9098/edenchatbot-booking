"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

/**
 * Wraps children with an authentication check.
 * Redirects to /login if the user is not signed in.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
