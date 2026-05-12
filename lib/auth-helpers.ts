import { createServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

export type StaffRoleName = "doctor" | "assistant" | "admin";

const STAFF_EMAIL_ROLE_FALLBACKS = new Map<string, StaffRoleName>([
  ["chetleung@gmail.com", "doctor"],
  ["drleung@edenclinic.hk", "doctor"],
  ["cheungtinw@gmail.com", "doctor"],
  ["cafu2046@gmail.com", "doctor"],
  ["drchan@edenclinic.hk", "doctor"],
  ["eden333rainie@gmail.com", "doctor"],
  ["eden333yinhei@gmail.com", "doctor"],
  ["edenannachan@gmail.com", "doctor"],
  ["info@edenclinic.hk", "admin"],
  ["admin@edenclinic.hk", "admin"],
  ["edeninfo333@gmail.com", "assistant"],
  ["edenkayilau@gmail.com", "assistant"],
  ["edenling1113@gmail.com", "assistant"],
  ["edenethel333@gmail.com", "assistant"],
  ["edenying1204@gmail.com", "assistant"],
  ["eden2022kiki@gmail.com", "assistant"],
  ["edenwanyi@gmail.com", "assistant"],
  ["graceyung1207@gmail.com", "assistant"],
]);

export function getFallbackStaffRoleForEmail(email?: string | null): StaffRoleName | null {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const exactRole = STAFF_EMAIL_ROLE_FALLBACKS.get(normalizedEmail);
  if (exactRole) return exactRole;

  if (normalizedEmail.endsWith("@edenclinic.hk")) {
    return "assistant";
  }

  return null;
}

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
    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userId);
    if (authUserError) {
      console.error("[requireStaffRole] auth lookup error:", authUserError.message);
      throw new AuthError(403, "Forbidden: staff role required");
    }

    const fallbackRole = getFallbackStaffRoleForEmail(authUserData.user?.email);
    if (fallbackRole) {
      return {
        user_id: userId,
        role: fallbackRole,
        is_active: true,
      };
    }

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
