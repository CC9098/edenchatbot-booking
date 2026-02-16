import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

/**
 * GET /api/doctor/patients/[patientUserId]/symptoms
 * View symptom logs for a specific patient (doctor/staff access only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { patientUserId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const { patientUserId } = params;
    await requirePatientAccess(user.id, patientUserId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all"; // 'active' | 'resolved' | 'all'
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = createServiceClient();

    let query = supabase
      .from("symptom_logs")
      .select("id, category, description, severity, status, started_at, ended_at, logged_via, created_at, updated_at", { count: "exact" })
      .eq("patient_user_id", patientUserId);

    // Apply filters
    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    // Order by most recent first
    query = query
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET doctor symptoms] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      symptoms: (data || []).map((s) => ({
        id: s.id,
        category: s.category,
        description: s.description,
        severity: s.severity,
        status: s.status,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        loggedVia: s.logged_via,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })),
      total: count || 0,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET doctor symptoms] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
