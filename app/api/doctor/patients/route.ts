import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireStaffRole, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch, normalizePhoneForStorage } from "@/lib/contact-utils";
import { getWebAuthCallbackUrl } from "@/lib/auth-redirect";
import {
  buildVisiblePatientIds,
  isMissingPatientProfilesSchemaError,
  prioritizeSelfPatient,
} from "@/lib/doctor-patient-list";

export const dynamic = "force-dynamic";
const MAX_SEARCH_PATIENT_SCAN = 2000;
const AUTH_USER_SCAN_LIMIT = 10;
const AUTH_USER_SCAN_PAGE_SIZE = 200;
const PATIENT_SOURCE_SCAN_LIMIT = 5000;

const createPatientSchema = z
  .object({
    displayName: z.string().min(2).max(80),
    phone: z.string().min(8).max(32),
    email: z.string().email(),
  })
  .strict();

function includesIgnoreCase(source: string | null | undefined, query: string): boolean {
  if (!source || !query) return false;
  return source.toLowerCase().includes(query);
}

function isAlreadyRegisteredError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already registered")
  );
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
): Promise<string | null> {
  for (let page = 1; page <= AUTH_USER_SCAN_LIMIT; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USER_SCAN_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find(
      (item) => (item.email || "").toLowerCase() === email,
    );
    if (matchedUser?.id) {
      return matchedUser.id;
    }

    if (data.users.length < AUTH_USER_SCAN_PAGE_SIZE) {
      break;
    }
  }

  return null;
}

async function cleanupAuthUser(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[POST /api/doctor/patients] cleanup auth user failed:", error.message);
  }
}

async function fetchAllVisiblePatientIds(
  supabase: ReturnType<typeof createServiceClient>,
  scanLimit: number,
  currentStaffUserId?: string,
  includeOtherStaff = false,
): Promise<string[]> {
  const [
    { data: activeStaffRows, error: activeStaffError },
    { data: profileRows, error: profileError },
    { data: patientProfileRows, error: patientProfileError },
    { data: careTeamRows, error: careTeamError },
    { data: careProfileRows, error: careProfileError },
    { data: bookingIntakeRows, error: bookingIntakeError },
    { data: symptomRows, error: symptomError },
    { data: followUpRows, error: followUpError },
    { data: instructionRows, error: instructionError },
  ] = await Promise.all([
    supabase.from("staff_roles").select("user_id").eq("is_active", true).limit(scanLimit),
    supabase.from("profiles").select("id").limit(scanLimit),
    supabase.from("patient_profiles").select("user_id").limit(scanLimit),
    supabase.from("patient_care_team").select("patient_user_id").limit(scanLimit),
    supabase.from("patient_care_profile").select("patient_user_id").limit(scanLimit),
    supabase
      .from("booking_intake")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(scanLimit),
    supabase
      .from("symptom_logs")
      .select("patient_user_id")
      .limit(scanLimit),
    supabase
      .from("follow_up_plans")
      .select("patient_user_id")
      .limit(scanLimit),
    supabase
      .from("care_instructions")
      .select("patient_user_id")
      .limit(scanLimit),
  ]);

  if (isMissingPatientProfilesSchemaError(patientProfileError)) {
    console.warn(
      "[GET /api/doctor/patients] patient_profiles source unavailable; continuing without family profiles:",
      patientProfileError?.message,
    );
  }

  const firstError =
    activeStaffError ||
    profileError ||
    (isMissingPatientProfilesSchemaError(patientProfileError) ? null : patientProfileError) ||
    careTeamError ||
    careProfileError ||
    bookingIntakeError ||
    symptomError ||
    followUpError ||
    instructionError;

  if (firstError) {
    throw firstError;
  }

  return buildVisiblePatientIds({
    activeStaffUserIds: (activeStaffRows || []).map((row) => row.user_id),
    currentStaffUserId,
    includeOtherStaff,
    profileIds: (profileRows || []).map((row) => row.id),
    patientProfileUserIds: (patientProfileRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.user_id as string | null | undefined,
    ),
    patientCareTeamIds: (careTeamRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.patient_user_id as string | null | undefined,
    ),
    patientCareProfileIds: (careProfileRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.patient_user_id as string | null | undefined,
    ),
    bookingUserIds: (bookingIntakeRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.user_id as string | null | undefined,
    ),
    symptomPatientIds: (symptomRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.patient_user_id as string | null | undefined,
    ),
    followUpPatientIds: (followUpRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.patient_user_id as string | null | undefined,
    ),
    instructionPatientIds: (instructionRows as Array<Record<string, unknown>> | null)?.map(
      (row) => row.patient_user_id as string | null | undefined,
    ),
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const body = await request.json().catch(() => null);
    const parsed = createPatientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const displayName = parsed.data.displayName.trim();
    const email = parsed.data.email.trim().toLowerCase();
    const phone = normalizePhoneForStorage(parsed.data.phone);
    if (!phone) {
      return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
    }

    const supabase = createServiceClient();
    let patientUserId: string | null = null;
    let invitedNewUser = false;

    try {
      patientUserId = await findAuthUserIdByEmail(supabase, email);
    } catch (lookupError) {
      const message =
        lookupError instanceof Error ? lookupError.message : "Unknown lookup error";
      console.warn(`[POST /api/doctor/patients] auth lookup warning: ${message}`);
    }

    if (!patientUserId) {
      const { data: inviteData, error: inviteError } =
        await supabase.auth.admin.inviteUserByEmail(email, {
          data: {
            display_name: displayName,
            phone,
          },
          redirectTo: getWebAuthCallbackUrl("/chat"),
        });

      if (inviteError) {
        if (isAlreadyRegisteredError(inviteError.message)) {
          return NextResponse.json(
            {
              error:
                "此電郵已存在帳戶，但系統暫未能自動關聯。請先讓病人自行登入一次，再由病人列表搜尋及指派。",
            },
            { status: 409 },
          );
        }

        console.error(
          "[POST /api/doctor/patients] invite user failed:",
          inviteError.message,
        );
        return NextResponse.json(
          { error: "Unable to create patient account" },
          { status: 500 },
        );
      }

      patientUserId = inviteData.user?.id ?? null;
      invitedNewUser = true;

      if (!patientUserId) {
        return NextResponse.json(
          { error: "Unable to resolve created patient user id" },
          { status: 500 },
        );
      }
    }

    const now = new Date().toISOString();

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: patientUserId,
        display_name: displayName,
        phone,
        updated_at: now,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      if (invitedNewUser) {
        await cleanupAuthUser(supabase, patientUserId);
      }
      console.error(
        "[POST /api/doctor/patients] profile upsert failed:",
        profileError.message,
      );
      return NextResponse.json({ error: "Unable to create patient profile" }, { status: 500 });
    }

    const { error: careTeamError } = await supabase.from("patient_care_team").upsert(
      {
        patient_user_id: patientUserId,
        staff_user_id: user.id,
        team_role: staffRole.role,
        is_primary: true,
      },
      { onConflict: "patient_user_id,staff_user_id" },
    );

    if (careTeamError) {
      if (invitedNewUser) {
        await cleanupAuthUser(supabase, patientUserId);
      }
      console.error(
        "[POST /api/doctor/patients] care team upsert failed:",
        careTeamError.message,
      );
      return NextResponse.json({ error: "Unable to assign patient care team" }, { status: 500 });
    }

    const { error: careProfileError } = await supabase
      .from("patient_care_profile")
      .upsert(
        {
          patient_user_id: patientUserId,
          constitution: "unknown",
          updated_by: user.id,
          updated_at: now,
        },
        { onConflict: "patient_user_id" },
      );

    if (careProfileError) {
      if (invitedNewUser) {
        await cleanupAuthUser(supabase, patientUserId);
      }
      console.error(
        "[POST /api/doctor/patients] care profile upsert failed:",
        careProfileError.message,
      );
      return NextResponse.json({ error: "Unable to initialize patient care profile" }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "patient_care_team",
      entity_id: `${patientUserId}:${user.id}`,
      action: invitedNewUser ? "patient_created_by_staff" : "patient_linked_to_staff",
      after_json: {
        displayName,
        email,
        phone,
        teamRole: staffRole.role,
      },
      created_at: now,
    });

    if (auditError) {
      console.warn(
        "[POST /api/doctor/patients] audit log insert warning:",
        auditError.message,
      );
    }

    return NextResponse.json({
      success: true,
      patientUserId,
      invited: invitedNewUser,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/doctor/patients] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();
    const includeStaff = ["1", "true", "yes", "all"].includes(
      (searchParams.get("includeStaff") || "").trim().toLowerCase(),
    );
    const queryText = q.toLowerCase();
    const queryDigits = normalizePhoneForSearch(q);
    const isSearching = q.length > 0;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const cursor = !isSearching ? searchParams.get("cursor") || null : null;

    const supabase = createServiceClient();

    const visiblePatientIds = await fetchAllVisiblePatientIds(
      supabase,
      isSearching ? MAX_SEARCH_PATIENT_SCAN : PATIENT_SOURCE_SCAN_LIMIT,
      user.id,
      includeStaff,
    );

    if (visiblePatientIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const prioritizedPatientIds =
      !isSearching && !cursor ? prioritizeSelfPatient(visiblePatientIds, user.id) : visiblePatientIds;

    const cursorFilteredIds =
      !isSearching && cursor
        ? visiblePatientIds.filter((patientId) => patientId > cursor)
        : prioritizedPatientIds;
    const candidatePatientIds = isSearching
      ? cursorFilteredIds
      : cursorFilteredIds.slice(0, limit + 1);

    if (candidatePatientIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const hasMore = !isSearching && candidatePatientIds.length > limit;
    const patientIdsToInspect = !isSearching ? candidatePatientIds.slice(0, limit) : candidatePatientIds;

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, phone")
      .in("id", patientIdsToInspect);

    if (profileError) {
      console.error("[GET /api/doctor/patients] profile query error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const { data: visibleStaffRoles, error: visibleStaffRolesError } = await supabase
      .from("staff_roles")
      .select("user_id, role")
      .in("user_id", patientIdsToInspect)
      .eq("is_active", true);

    if (visibleStaffRolesError) {
      console.error("[GET /api/doctor/patients] staff_roles query error:", visibleStaffRolesError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const staffRoleMap = new Map((visibleStaffRoles || []).map((row) => [row.user_id, row.role]));

    const { data: patientProfiles, error: patientProfilesError } = await supabase
      .from("patient_profiles")
      .select("id, user_id, display_name, is_default, created_at")
      .in("user_id", patientIdsToInspect)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (isMissingPatientProfilesSchemaError(patientProfilesError)) {
      console.warn(
        "[GET /api/doctor/patients] patient_profiles detail unavailable; continuing without family profile names:",
        patientProfilesError?.message,
      );
    } else if (patientProfilesError) {
      console.error("[GET /api/doctor/patients] patient_profiles query error:", patientProfilesError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const patientProfilesByUserId = new Map<
      string,
      Array<{ id: string; user_id: string; display_name: string | null; is_default: boolean | null }>
    >();
    for (const patientProfile of patientProfiles || []) {
      if (typeof patientProfile.user_id !== "string") continue;
      const rows = patientProfilesByUserId.get(patientProfile.user_id) || [];
      rows.push(patientProfile);
      patientProfilesByUserId.set(patientProfile.user_id, rows);
    }

    // Pull latest intake contact snapshot for fallback display/search.
    const { data: bookingContacts, error: bookingContactsError } = await supabase
      .from("booking_intake")
      .select("user_id, patient_name, phone, email, created_at")
      .in("user_id", patientIdsToInspect)
      .order("created_at", { ascending: false });

    if (bookingContactsError) {
      console.error(
        "[GET /api/doctor/patients] booking_intake query warning:",
        bookingContactsError.message,
      );
    }

    const bookingContactMap = new Map<
      string,
      { patient_name: string | null; phone: string | null; email: string | null }
    >();
    for (const row of bookingContacts || []) {
      if (typeof row.user_id !== "string") continue;
      if (bookingContactMap.has(row.user_id)) continue;
      bookingContactMap.set(row.user_id, {
        patient_name: row.patient_name,
        phone: row.phone,
        email: row.email,
      });
    }

    const matchedPatientProfileByUserId = new Map<
      string,
      { id: string; display_name: string | null }
    >();

    const matchedIds = !isSearching
      ? patientIdsToInspect
      : patientIdsToInspect.filter((id) => {
          const profile = profileMap.get(id);
          const intakeContact = bookingContactMap.get(id);
          const matchingPatientProfile = (patientProfilesByUserId.get(id) || []).find((patientProfile) =>
            includesIgnoreCase(patientProfile.display_name, queryText),
          );
          if (matchingPatientProfile) {
            matchedPatientProfileByUserId.set(id, {
              id: matchingPatientProfile.id,
              display_name: matchingPatientProfile.display_name,
            });
          }

          const nameMatch =
            includesIgnoreCase(profile?.display_name, queryText) ||
            includesIgnoreCase(intakeContact?.patient_name, queryText) ||
            Boolean(matchingPatientProfile);

          const phoneMatch =
            queryDigits.length > 0 &&
            (normalizePhoneForSearch(profile?.phone).includes(queryDigits) ||
              normalizePhoneForSearch(intakeContact?.phone).includes(queryDigits));

          return nameMatch || phoneMatch;
        });

    if (matchedIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const idsToFetch = isSearching ? matchedIds.slice(0, limit) : matchedIds;

    // Fetch care profiles
    const { data: careProfiles } = await supabase
      .from("patient_care_profile")
      .select("patient_user_id, constitution")
      .in("patient_user_id", idsToFetch);

    // Fetch next follow-up dates (pending, ordered by suggested_date asc, pick first per patient)
    const { data: followUps } = await supabase
      .from("follow_up_plans")
      .select("patient_user_id, suggested_date")
      .in("patient_user_id", idsToFetch)
      .eq("status", "pending")
      .order("suggested_date", { ascending: true });

    // Build lookup maps
    const careMap = new Map(careProfiles?.map((c) => [c.patient_user_id, c]) || []);
    const followUpMap = new Map<string, string>();
    if (followUps) {
      for (const fu of followUps) {
        if (!followUpMap.has(fu.patient_user_id)) {
          followUpMap.set(fu.patient_user_id, fu.suggested_date);
        }
      }
    }

    const items = idsToFetch.map((id) => {
      const matchedPatientProfile = matchedPatientProfileByUserId.get(id);
      const defaultPatientProfile = patientProfilesByUserId.get(id)?.[0] || null;
      const displayName =
        matchedPatientProfile?.display_name ||
        profileMap.get(id)?.display_name ||
        bookingContactMap.get(id)?.patient_name ||
        defaultPatientProfile?.display_name ||
        null;

      return {
        patientUserId: id,
        patientProfileId: matchedPatientProfile?.id || defaultPatientProfile?.id || null,
        displayName,
        phone: profileMap.get(id)?.phone || bookingContactMap.get(id)?.phone || null,
        constitution: careMap.get(id)?.constitution || "unknown",
        nextFollowUpDate: followUpMap.get(id) || null,
        entryType: staffRoleMap.has(id) ? "staff" : "patient",
        staffRole: staffRoleMap.get(id) || null,
        isSelf: id === user.id,
      };
    });

    const nextCursor = hasMore && !isSearching ? patientIdsToInspect[patientIdsToInspect.length - 1] : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/doctor/patients] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
