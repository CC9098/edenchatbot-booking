import { createServerClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getDefaultStaffKind, normalizeStaffEmail, type StaffKind } from "@/lib/staff-access";

export type StaffRoleName = "doctor" | "assistant" | "admin";

export type StaffRoleResult = {
  user_id: string;
  role: StaffRoleName;
  is_active: boolean;
  staff_kind: StaffKind | null;
};

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

function isMissingStaffAccessEmailTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /staff_access_emails/i.test(error.message || "");
}

async function getStaffAccessForEmail(email?: string | null) {
  const normalizedEmail = email ? normalizeStaffEmail(email) : "";
  if (!normalizedEmail) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff_access_emails")
    .select("email, role, staff_kind, is_active")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    if (!isMissingStaffAccessEmailTable(error)) {
      console.error("[getStaffAccessForEmail] DB error:", error.message);
    }
    return null;
  }

  return data as
    | {
        email: string;
        role: StaffRoleName;
        staff_kind: StaffKind | null;
        is_active: boolean;
      }
    | null;
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
export async function requireStaffRole(userId: string): Promise<StaffRoleResult> {
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

    const emailAccess = await getStaffAccessForEmail(authUserData.user?.email);
    if (emailAccess) {
      if (!emailAccess.is_active) {
        throw new AuthError(403, "Forbidden: staff role inactive");
      }

      return {
        user_id: userId,
        role: emailAccess.role,
        is_active: true,
        staff_kind: emailAccess.staff_kind ?? getDefaultStaffKind(emailAccess.role),
      };
    }

    const fallbackRole = getFallbackStaffRoleForEmail(authUserData.user?.email);
    if (fallbackRole) {
      return {
        user_id: userId,
        role: fallbackRole,
        is_active: true,
        staff_kind: getDefaultStaffKind(fallbackRole),
      };
    }

    throw new AuthError(403, "Forbidden: staff role required");
  }

  return {
    ...data,
    role: data.role as StaffRoleName,
    staff_kind: getDefaultStaffKind(data.role as StaffRoleName),
  };
}

export async function requireStaffManagerRole(userId: string): Promise<StaffRoleResult> {
  const staffRole = await requireStaffRole(userId);

  if (staffRole.role !== "admin" && staffRole.role !== "doctor") {
    throw new AuthError(403, "Forbidden: doctor or admin role required");
  }

  return staffRole;
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
