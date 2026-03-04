import { createServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

/**
 * Extracts the authenticated user from the current request context.
 * Uses the cookie-based server client (for App Router Server Components / Route Handlers).
 * Returns null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/**
 * Checks whether the given user has a staff role.
 * Queries the `staff_roles` table using the service client (bypasses RLS).
 * Throws a structured error if the user is not staff.
 */
export async function requireStaffRole(userId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff_roles")
    .select("user_id, role, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[requireStaffRole] DB error:", error.message);
    throw new AuthError(500, "Internal server error");
  }

  if (!data) {
    throw new AuthError(403, "Forbidden: staff role required");
  }

  return data;
}

/**
 * Verifies that the user is active staff before opening a patient record.
 *
 * The current clinic workflow gives all active staff global read/write access
 * to patient records inside the doctor console, so this helper no longer gates
 * by `patient_care_team`.
 */
export async function requirePatientAccess(
  staffUserId: string,
  patientUserId: string
) {
  const staffRole = await requireStaffRole(staffUserId);

  return {
    patient_user_id: patientUserId,
    staff_user_id: staffUserId,
    team_role: staffRole.role,
    is_primary: false,
  };
}

/**
 * Structured auth error with an HTTP status code.
 * Useful for catching in Route Handlers and returning proper responses.
 */
export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
