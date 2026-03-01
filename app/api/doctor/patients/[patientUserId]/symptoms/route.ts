import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_STATUS_FILTERS = new Set(["all", "active", "resolved", "recurring"]);
const VALID_SYMPTOM_STATUS = new Set(["active", "resolved", "recurring"]);
const SYMPTOM_SELECT_COLUMNS =
  "id, category, description, severity, status, started_at, ended_at, resolution_method, resolution_note, resolution_days, logged_via, created_at, updated_at";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function mapSymptomRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    severity: row.severity,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    resolutionMethod: row.resolution_method,
    resolutionNote: row.resolution_note,
    resolutionDays: row.resolution_days,
    loggedVia: row.logged_via,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    const status = (searchParams.get("status") || "all").trim(); // 'active' | 'resolved' | 'recurring' | 'all'
    const category = searchParams.get("category")?.trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 30), 100);
    const offset = parsePositiveInt(searchParams.get("offset"), 0);

    if (!VALID_STATUS_FILTERS.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("symptom_logs")
      .select(SYMPTOM_SELECT_COLUMNS, { count: "exact" })
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
      symptoms: (data || []).map((s) => mapSymptomRow(s as unknown as Record<string, unknown>)),
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

/**
 * POST /api/doctor/patients/[patientUserId]/symptoms
 * Create a symptom log for a specific patient (doctor/staff access only)
 */
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

    const body = await request.json().catch(() => ({}));
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 6000) : "";
    if (description.length < 3) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim().slice(0, 120)
        : "問診症狀摘要";

    const requestedStatus =
      typeof body.status === "string" ? body.status.trim().toLowerCase() : "active";
    if (!VALID_SYMPTOM_STATUS.has(requestedStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const status = requestedStatus;

    const startedAt =
      typeof body.startedAt === "string" && isIsoDate(body.startedAt.trim())
        ? body.startedAt.trim()
        : todayDateString();

    const endedAtRaw =
      typeof body.endedAt === "string" && isIsoDate(body.endedAt.trim())
        ? body.endedAt.trim()
        : null;
    const endedAt = status === "resolved" ? endedAtRaw || startedAt : null;

    const severityNumber =
      typeof body.severity === "number"
        ? Math.trunc(body.severity)
        : typeof body.severity === "string"
        ? Math.trunc(Number(body.severity))
        : null;

    if (
      severityNumber !== null &&
      (!Number.isFinite(severityNumber) || severityNumber < 1 || severityNumber > 5)
    ) {
      return NextResponse.json({ error: "severity must be between 1 and 5" }, { status: 400 });
    }

    const insertPayload: Record<string, unknown> = {
      patient_user_id: patientUserId,
      category,
      description,
      status,
      started_at: startedAt,
      ended_at: endedAt,
      logged_via: "manual",
    };
    if (severityNumber !== null) {
      insertPayload.severity = severityNumber;
    }

    const supabase = createServiceClient();
    const { data: inserted, error: insertError } = await supabase
      .from("symptom_logs")
      .insert(insertPayload)
      .select(SYMPTOM_SELECT_COLUMNS)
      .single();

    if (insertError || !inserted) {
      console.error("[POST doctor symptoms] insert error:", insertError?.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "symptom_logs",
      entity_id: inserted.id,
      action: "insert",
      before_json: null,
      after_json: inserted,
    });

    if (auditError) {
      console.error("[POST doctor symptoms] audit log error:", auditError.message);
    }

    return NextResponse.json(
      {
        symptom: mapSymptomRow(inserted as unknown as Record<string, unknown>),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST doctor symptoms] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
