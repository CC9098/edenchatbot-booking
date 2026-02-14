import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_INSTRUCTION_TYPES = ["diet_avoid", "diet_recommend", "lifestyle", "warning", "medication_note"];

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
    const { instructionType, title, contentMd, startDate, endDate } = body;

    // Validate required fields
    if (!instructionType || typeof instructionType !== "string") {
      return NextResponse.json({ error: "instructionType is required" }, { status: 400 });
    }
    if (!VALID_INSTRUCTION_TYPES.includes(instructionType)) {
      return NextResponse.json(
        { error: `Invalid instructionType. Must be one of: ${VALID_INSTRUCTION_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!contentMd || typeof contentMd !== "string") {
      return NextResponse.json({ error: "contentMd is required" }, { status: 400 });
    }

    // Validate optional date fields
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate !== undefined && (typeof startDate !== "string" || !dateRegex.test(startDate))) {
      return NextResponse.json({ error: "startDate must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
    }
    if (endDate !== undefined && (typeof endDate !== "string" || !dateRegex.test(endDate))) {
      return NextResponse.json({ error: "endDate must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const insertData: Record<string, unknown> = {
      patient_user_id: patientUserId,
      instruction_type: instructionType,
      title,
      content_md: contentMd,
      status: "active",
      created_by: user.id,
    };

    if (startDate) insertData.start_date = startDate;
    if (endDate) insertData.end_date = endDate;

    const { data: inserted, error: insertError } = await supabase
      .from("care_instructions")
      .insert(insertData)
      .select("id, patient_user_id, instruction_type, title, content_md, status, start_date, end_date, created_by, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[POST instructions] insert error:", insertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "care_instructions",
      entity_id: inserted.id,
      action: "insert",
      before_json: null,
      after_json: inserted,
    });

    if (auditError) {
      console.error("[POST instructions] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: inserted.id,
      patientUserId: inserted.patient_user_id,
      instructionType: inserted.instruction_type,
      title: inserted.title,
      contentMd: inserted.content_md,
      status: inserted.status,
      startDate: inserted.start_date,
      endDate: inserted.end_date,
      createdBy: inserted.created_by,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST instructions] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
