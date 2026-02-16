import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
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

    const supabase = createServiceClient();

    // Fetch patient care profile
    const { data: careProfile, error: cpError } = await supabase
      .from("patient_care_profile")
      .select("patient_user_id, constitution, constitution_note, last_visit_at, updated_by, updated_at")
      .eq("patient_user_id", patientUserId)
      .maybeSingle();

    if (cpError) {
      console.error("[GET patient profile] care profile error:", cpError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Fetch active care instructions
    const { data: instructions, error: instrError } = await supabase
      .from("care_instructions")
      .select("id, instruction_type, title, content_md, status, start_date, end_date, created_by, created_at, updated_at")
      .eq("patient_user_id", patientUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (instrError) {
      console.error("[GET patient profile] instructions error:", instrError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Fetch pending follow-up plans
    const { data: followUps, error: fuError } = await supabase
      .from("follow_up_plans")
      .select("id, suggested_date, reason, status, linked_booking_id, created_by, created_at, updated_at")
      .eq("patient_user_id", patientUserId)
      .eq("status", "pending")
      .order("suggested_date", { ascending: true });

    if (fuError) {
      console.error("[GET patient profile] follow-ups error:", fuError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Fetch recent symptoms (last 30 days or active)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: symptoms, error: symptomsError } = await supabase
      .from("symptom_logs")
      .select("id, category, description, severity, status, started_at, ended_at, logged_via, created_at")
      .eq("patient_user_id", patientUserId)
      .or(`status.eq.active,started_at.gte.${thirtyDaysAgoStr}`)
      .order("started_at", { ascending: false })
      .limit(10);

    if (symptomsError) {
      console.error("[GET patient profile] symptoms error:", symptomsError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      careProfile: careProfile
        ? {
            patientUserId: careProfile.patient_user_id,
            constitution: careProfile.constitution,
            constitutionNote: careProfile.constitution_note,
            lastVisitAt: careProfile.last_visit_at,
            updatedBy: careProfile.updated_by,
            updatedAt: careProfile.updated_at,
          }
        : null,
      activeInstructions: (instructions || []).map((i) => ({
        id: i.id,
        instructionType: i.instruction_type,
        title: i.title,
        contentMd: i.content_md,
        status: i.status,
        startDate: i.start_date,
        endDate: i.end_date,
        createdBy: i.created_by,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
      pendingFollowUps: (followUps || []).map((f) => ({
        id: f.id,
        suggestedDate: f.suggested_date,
        reason: f.reason,
        status: f.status,
        linkedBookingId: f.linked_booking_id,
        createdBy: f.created_by,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      })),
      recentSymptoms: (symptoms || []).map((s) => ({
        id: s.id,
        category: s.category,
        description: s.description,
        severity: s.severity,
        status: s.status,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        loggedVia: s.logged_via,
        createdAt: s.created_at,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET patient profile] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
