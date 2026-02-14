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
 * Verifies that a staff member has access to a specific patient.
 * Queries the `patient_care_team` table using the service client (bypasses RLS).
 * Throws a structured error if the relationship does not exist.
 */
export async function requirePatientAccess(
  staffUserId: string,
  patientUserId: string
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("patient_care_team")
    .select("patient_user_id, staff_user_id, team_role, is_primary")
    .eq("staff_user_id", staffUserId)
    .eq("patient_user_id", patientUserId)
    .maybeSingle();

  if (error) {
    console.error("[requirePatientAccess] DB error:", error.message);
    throw new AuthError(500, "Internal server error");
  }

  if (!data) {
    throw new AuthError(403, "Forbidden: no access to this patient");
  }

  return data;
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
