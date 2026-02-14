import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_STATUSES = ["active", "paused", "done"];

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

    // Fetch the instruction to verify ownership via care team
    const { data: existing, error: fetchError } = await supabase
      .from("care_instructions")
      .select("id, patient_user_id, instruction_type, title, content_md, status, start_date, end_date, created_by, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("[PATCH instruction] fetch error:", fetchError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Instruction not found" }, { status: 404 });
    }

    // Verify staff has access to this patient
    await requirePatientAccess(user.id, existing.patient_user_id);

    const body = await request.json();
    const { title, contentMd, status, startDate, endDate } = body;

    // Validate fields if provided
    if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    if (contentMd !== undefined && (typeof contentMd !== "string" || contentMd.trim() === "")) {
      return NextResponse.json({ error: "contentMd must be a non-empty string" }, { status: 400 });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate !== undefined && startDate !== null && (typeof startDate !== "string" || !dateRegex.test(startDate))) {
      return NextResponse.json({ error: "startDate must be a valid date string (YYYY-MM-DD) or null" }, { status: 400 });
    }
    if (endDate !== undefined && endDate !== null && (typeof endDate !== "string" || !dateRegex.test(endDate))) {
      return NextResponse.json({ error: "endDate must be a valid date string (YYYY-MM-DD) or null" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (contentMd !== undefined) updateData.content_md = contentMd;
    if (status !== undefined) updateData.status = status;
    if (startDate !== undefined) updateData.start_date = startDate;
    if (endDate !== undefined) updateData.end_date = endDate;

    const { data: updated, error: updateError } = await supabase
      .from("care_instructions")
      .update(updateData)
      .eq("id", id)
      .select("id, patient_user_id, instruction_type, title, content_md, status, start_date, end_date, created_by, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("[PATCH instruction] update error:", updateError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: existing.patient_user_id,
      entity: "care_instructions",
      entity_id: id,
      action: "update",
      before_json: existing,
      after_json: updated,
    });

    if (auditError) {
      console.error("[PATCH instruction] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: updated.id,
      patientUserId: updated.patient_user_id,
      instructionType: updated.instruction_type,
      title: updated.title,
      contentMd: updated.content_md,
      status: updated.status,
      startDate: updated.start_date,
      endDate: updated.end_date,
      createdBy: updated.created_by,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH instruction] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
