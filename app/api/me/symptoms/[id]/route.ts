import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(["active", "resolved", "recurring"]);

/**
 * PATCH /api/me/symptoms/[id]
 * Update an existing symptom log (e.g., mark as resolved, update severity)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { status, endedAt, severity, description } = body;

    const supabase = createServiceClient();

    // Fetch existing symptom to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("symptom_logs")
      .select("*")
      .eq("id", id)
      .eq("patient_user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[PATCH /api/me/symptoms/[id]] fetch error:", fetchError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Symptom log not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
        return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
      }
      updateData.status = status;
    }

    if (endedAt !== undefined) {
      if (endedAt === null || endedAt === "") {
        updateData.ended_at = null;
      } else {
        if (typeof endedAt !== "string" || !DATE_REGEX.test(endedAt)) {
          return NextResponse.json({ error: "endedAt must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
        }
        if (endedAt < existing.started_at) {
          return NextResponse.json({ error: "endedAt cannot be earlier than startedAt" }, { status: 400 });
        }
        updateData.ended_at = endedAt;

        // If endedAt is provided and status not explicitly set, mark as resolved
        if (!status) {
          updateData.status = "resolved";
        }
      }
    }

    if (severity !== undefined) {
      if (severity === null) {
        updateData.severity = null;
      } else if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
        return NextResponse.json({ error: "severity must be between 1 and 5" }, { status: 400 });
      } else {
        updateData.severity = severity;
      }
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return NextResponse.json({ error: "description must be a string" }, { status: 400 });
      }
      updateData.description = typeof description === "string" ? description.trim() || null : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const nextStatus = (updateData.status as string | undefined) ?? existing.status;
    const nextEndedAt =
      Object.prototype.hasOwnProperty.call(updateData, "ended_at")
        ? (updateData.ended_at as string | null)
        : existing.ended_at;
    if (nextStatus === "active" && nextEndedAt) {
      return NextResponse.json(
        { error: "active status cannot have endedAt. Set endedAt to null first." },
        { status: 400 }
      );
    }

    // Update symptom log
    const { data: updated, error: updateError } = await supabase
      .from("symptom_logs")
      .update(updateData)
      .eq("id", id)
      .eq("patient_user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/me/symptoms/[id]] update error:", updateError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: user.id,
      entity: "symptom_logs",
      entity_id: id,
      action: "update",
      before_json: existing,
      after_json: updated,
    });

    if (auditError) {
      console.error("[PATCH /api/me/symptoms/[id]] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: updated.id,
      patientUserId: updated.patient_user_id,
      category: updated.category,
      description: updated.description,
      severity: updated.severity,
      status: updated.status,
      startedAt: updated.started_at,
      endedAt: updated.ended_at,
      loggedVia: updated.logged_via,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (err) {
    console.error("[PATCH /api/me/symptoms/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/me/symptoms/[id]
 * Delete a symptom log
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const supabase = createServiceClient();

    // Fetch existing symptom to verify ownership and log deletion
    const { data: existing, error: fetchError } = await supabase
      .from("symptom_logs")
      .select("*")
      .eq("id", id)
      .eq("patient_user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("[DELETE /api/me/symptoms/[id]] fetch error:", fetchError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Symptom log not found" }, { status: 404 });
    }

    // Delete symptom log
    const { error: deleteError } = await supabase
      .from("symptom_logs")
      .delete()
      .eq("id", id)
      .eq("patient_user_id", user.id);

    if (deleteError) {
      console.error("[DELETE /api/me/symptoms/[id]] delete error:", deleteError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: user.id,
      entity: "symptom_logs",
      entity_id: id,
      action: "delete",
      before_json: existing,
      after_json: null,
    });

    if (auditError) {
      console.error("[DELETE /api/me/symptoms/[id]] audit log error:", auditError.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/me/symptoms/[id]] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
