import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_CONSTITUTIONS = ["depleting", "crossing", "hoarding", "mixed", "unknown"];

export async function PATCH(
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
    const { constitution, constitutionNote } = body;

    if (!constitution || typeof constitution !== "string") {
      return NextResponse.json({ error: "constitution is required" }, { status: 400 });
    }

    if (!VALID_CONSTITUTIONS.includes(constitution)) {
      return NextResponse.json(
        { error: `Invalid constitution. Must be one of: ${VALID_CONSTITUTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (constitutionNote !== undefined && typeof constitutionNote !== "string") {
      return NextResponse.json({ error: "constitutionNote must be a string" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch existing record for audit log before_json
    const { data: existing } = await supabase
      .from("patient_care_profile")
      .select("patient_user_id, constitution, constitution_note, last_visit_at, updated_by, updated_at")
      .eq("patient_user_id", patientUserId)
      .maybeSingle();

    const upsertData: Record<string, unknown> = {
      patient_user_id: patientUserId,
      constitution,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (constitutionNote !== undefined) {
      upsertData.constitution_note = constitutionNote;
    }

    const { data: updated, error: upsertError } = await supabase
      .from("patient_care_profile")
      .upsert(upsertData, { onConflict: "patient_user_id" })
      .select("patient_user_id, constitution, constitution_note, last_visit_at, updated_by, updated_at")
      .single();

    if (upsertError) {
      console.error("[PATCH constitution] upsert error:", upsertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "patient_care_profile",
      entity_id: patientUserId,
      action: existing ? "update" : "insert",
      before_json: existing || null,
      after_json: updated,
    });

    if (auditError) {
      console.error("[PATCH constitution] audit log error:", auditError.message);
      // Non-fatal: don't fail the request
    }

    return NextResponse.json({
      patientUserId: updated.patient_user_id,
      constitution: updated.constitution,
      constitutionNote: updated.constitution_note,
      lastVisitAt: updated.last_visit_at,
      updatedBy: updated.updated_by,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH constitution] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
