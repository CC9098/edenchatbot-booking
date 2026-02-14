import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export async function POST(
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

    const body = await request.json();
    const { suggestedDate, reason } = body;

    // Validate required fields
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!suggestedDate || typeof suggestedDate !== "string" || !dateRegex.test(suggestedDate)) {
      return NextResponse.json({ error: "suggestedDate is required and must be YYYY-MM-DD" }, { status: 400 });
    }

    if (reason !== undefined && typeof reason !== "string") {
      return NextResponse.json({ error: "reason must be a string" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const insertData: Record<string, unknown> = {
      patient_user_id: patientUserId,
      suggested_date: suggestedDate,
      status: "pending",
      created_by: user.id,
    };

    if (reason) insertData.reason = reason;

    const { data: inserted, error: insertError } = await supabase
      .from("follow_up_plans")
      .insert(insertData)
      .select("id, patient_user_id, suggested_date, reason, status, linked_booking_id, created_by, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[POST follow-ups] insert error:", insertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "follow_up_plans",
      entity_id: inserted.id,
      action: "insert",
      before_json: null,
      after_json: inserted,
    });

    if (auditError) {
      console.error("[POST follow-ups] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: inserted.id,
      patientUserId: inserted.patient_user_id,
      suggestedDate: inserted.suggested_date,
      reason: inserted.reason,
      status: inserted.status,
      linkedBookingId: inserted.linked_booking_id,
      createdBy: inserted.created_by,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST follow-ups] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
