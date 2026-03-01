import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireStaffRole, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch, normalizePhoneForStorage } from "@/lib/contact-utils";
import { getWebAuthCallbackUrl } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";
const MAX_SEARCH_PATIENT_SCAN = 2000;
const AUTH_USER_SCAN_LIMIT = 10;
const AUTH_USER_SCAN_PAGE_SIZE = 200;

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
    const queryText = q.toLowerCase();
    const queryDigits = normalizePhoneForSearch(q);
    const isSearching = q.length > 0;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const cursor = !isSearching ? searchParams.get("cursor") || null : null;

    const supabase = createServiceClient();

    // Get patient_user_ids assigned to this staff member
    let teamQuery = supabase
      .from("patient_care_team")
      .select("patient_user_id")
      .eq("staff_user_id", user.id)
      .order("patient_user_id", { ascending: true });

    if (isSearching) {
      teamQuery = teamQuery.limit(MAX_SEARCH_PATIENT_SCAN);
    } else {
      teamQuery = teamQuery.limit(limit + 1); // fetch one extra for cursor
    }

    if (!isSearching && cursor) {
      teamQuery = teamQuery.gt("patient_user_id", cursor);
    }

    const { data: teamRows, error: teamError } = await teamQuery;

    if (teamError) {
      console.error("[GET /api/doctor/patients] team query error:", teamError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!teamRows || teamRows.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const hasMore = !isSearching && teamRows.length > limit;
    const candidatePatientIds = (isSearching ? teamRows : teamRows.slice(0, limit)).map((r) => r.patient_user_id);
    if (candidatePatientIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, phone")
      .in("id", candidatePatientIds);

    if (profileError) {
      console.error("[GET /api/doctor/patients] profile query error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Pull latest intake contact snapshot for fallback display/search.
    const { data: bookingContacts, error: bookingContactsError } = await supabase
      .from("booking_intake")
      .select("user_id, patient_name, phone, email, created_at")
      .in("user_id", candidatePatientIds)
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

    const matchedIds = !isSearching
      ? candidatePatientIds
      : candidatePatientIds.filter((id) => {
          const profile = profileMap.get(id);
          const intakeContact = bookingContactMap.get(id);

          const nameMatch =
            includesIgnoreCase(profile?.display_name, queryText) ||
            includesIgnoreCase(intakeContact?.patient_name, queryText);

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

    const items = idsToFetch.map((id) => ({
      patientUserId: id,
      displayName: profileMap.get(id)?.display_name || bookingContactMap.get(id)?.patient_name || null,
      phone: profileMap.get(id)?.phone || bookingContactMap.get(id)?.phone || null,
      constitution: careMap.get(id)?.constitution || "unknown",
      nextFollowUpDate: followUpMap.get(id) || null,
    }));

    const nextCursor = hasMore && !isSearching ? matchedIds[matchedIds.length - 1] : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/doctor/patients] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
