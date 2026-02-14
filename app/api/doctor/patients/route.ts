import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100);
    const cursor = searchParams.get("cursor") || null;

    const supabase = createServiceClient();

    // Get patient_user_ids assigned to this staff member
    let teamQuery = supabase
      .from("patient_care_team")
      .select("patient_user_id")
      .eq("staff_user_id", user.id)
      .order("patient_user_id", { ascending: true })
      .limit(limit + 1); // fetch one extra for cursor

    if (cursor) {
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

    const hasMore = teamRows.length > limit;
    const patientIds = teamRows.slice(0, limit).map((r) => r.patient_user_id);

    // Fetch profiles
    let profileQuery = supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", patientIds);

    if (q) {
      profileQuery = profileQuery.ilike("display_name", `%${q}%`);
    }

    const { data: profiles, error: profileError } = await profileQuery;

    if (profileError) {
      console.error("[GET /api/doctor/patients] profile query error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // If search filter applied, narrow down patient IDs
    const matchedIds = profiles ? profiles.map((p) => p.id) : [];

    if (q && matchedIds.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const idsToFetch = q ? matchedIds : patientIds;

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
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
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
      displayName: profileMap.get(id)?.display_name || null,
      constitution: careMap.get(id)?.constitution || "unknown",
      nextFollowUpDate: followUpMap.get(id) || null,
    }));

    const nextCursor = hasMore && !q ? patientIds[patientIds.length - 1] : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/doctor/patients] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
