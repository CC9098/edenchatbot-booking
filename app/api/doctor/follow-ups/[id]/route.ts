import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_STATUSES = ["pending", "booked", "done", "overdue", "cancelled"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { id } = params;
    const supabase = createServiceClient();

    // Fetch existing follow-up to verify patient access
    const { data: existing, error: fetchError } = await supabase
      .from("follow_up_plans")
      .select("id, patient_user_id, suggested_date, reason, status, linked_booking_id, created_by, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[PATCH follow-up] fetch error:", fetchError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Follow-up plan not found" }, { status: 404 });
    }

    // Verify staff has access to this patient
    await requirePatientAccess(user.id, existing.patient_user_id);

    const body = await request.json();
    const { status, suggestedDate, reason } = body;

    // Validate fields if provided
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (suggestedDate !== undefined && (typeof suggestedDate !== "string" || !dateRegex.test(suggestedDate))) {
      return NextResponse.json({ error: "suggestedDate must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
    }

    if (reason !== undefined && typeof reason !== "string") {
      return NextResponse.json({ error: "reason must be a string" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) updateData.status = status;
    if (suggestedDate !== undefined) updateData.suggested_date = suggestedDate;
    if (reason !== undefined) updateData.reason = reason;

    const { data: updated, error: updateError } = await supabase
      .from("follow_up_plans")
      .update(updateData)
      .eq("id", id)
      .select("id, patient_user_id, suggested_date, reason, status, linked_booking_id, created_by, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("[PATCH follow-up] update error:", updateError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: existing.patient_user_id,
      entity: "follow_up_plans",
      entity_id: id,
      action: "update",
      before_json: existing,
      after_json: updated,
    });

    if (auditError) {
      console.error("[PATCH follow-up] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: updated.id,
      patientUserId: updated.patient_user_id,
      suggestedDate: updated.suggested_date,
      reason: updated.reason,
      status: updated.status,
      linkedBookingId: updated.linked_booking_id,
      createdBy: updated.created_by,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH follow-up] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
