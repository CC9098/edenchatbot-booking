import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch } from "@/lib/contact-utils";

export const dynamic = "force-dynamic";
const MAX_SEARCH_PATIENT_SCAN = 2000;

function includesIgnoreCase(source: string | null | undefined, query: string): boolean {
  if (!source || !query) return false;
  return source.toLowerCase().includes(query);
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
