import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS_FILTERS = new Set(["all", "active", "resolved", "recurring"]);

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/**
 * GET /api/me/symptoms
 * List patient's own symptom logs with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "all").trim(); // 'active' | 'resolved' | 'recurring' | 'all'
    const category = searchParams.get("category")?.trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 20), 100);
    const offset = parsePositiveInt(searchParams.get("offset"), 0);

    if (!VALID_STATUS_FILTERS.has(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const supabase = createServiceClient();

    let query = supabase
      .from("symptom_logs")
      .select("id, category, description, severity, status, started_at, ended_at, logged_via, created_at, updated_at", { count: "exact" })
      .eq("patient_user_id", user.id);

    // Apply filters
    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    // Order and pagination
    query = query
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /api/me/symptoms] query error:", error.message);
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
    console.error("[GET /api/me/symptoms] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/me/symptoms
 * Create a new symptom log for the patient
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { category, description, severity, startedAt, endedAt } = body;

    // Validate required fields
    if (typeof category !== "string" || !category.trim()) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    if (!startedAt || typeof startedAt !== "string") {
      return NextResponse.json({ error: "startedAt is required" }, { status: 400 });
    }

    // Validate date format
    if (!DATE_REGEX.test(startedAt)) {
      return NextResponse.json({ error: "startedAt must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
    }

    const normalizedEndedAt =
      endedAt === undefined || endedAt === null || endedAt === "" ? undefined : endedAt;

    if (normalizedEndedAt !== undefined) {
      if (typeof normalizedEndedAt !== "string" || !DATE_REGEX.test(normalizedEndedAt)) {
        return NextResponse.json({ error: "endedAt must be a valid date string (YYYY-MM-DD)" }, { status: 400 });
      }
      if (normalizedEndedAt < startedAt) {
        return NextResponse.json({ error: "endedAt cannot be earlier than startedAt" }, { status: 400 });
      }
    }

    // Validate severity
    if (
      severity !== undefined &&
      severity !== null &&
      (!Number.isInteger(severity) || severity < 1 || severity > 5)
    ) {
      return NextResponse.json({ error: "severity must be between 1 and 5" }, { status: 400 });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return NextResponse.json({ error: "description must be a string" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const insertData: Record<string, unknown> = {
      patient_user_id: user.id,
      category: category.trim(),
      status: normalizedEndedAt ? "resolved" : "active",
      started_at: startedAt,
      logged_via: "manual", // Logged via API (not chatbot)
    };

    if (typeof description === "string" && description.trim()) {
      insertData.description = description.trim();
    }

    if (severity !== undefined && severity !== null) {
      insertData.severity = severity;
    }

    if (normalizedEndedAt) {
      insertData.ended_at = normalizedEndedAt;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("symptom_logs")
      .insert(insertData)
      .select("id, patient_user_id, category, description, severity, status, started_at, ended_at, logged_via, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[POST /api/me/symptoms] insert error:", insertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Write audit log
    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: user.id,
      entity: "symptom_logs",
      entity_id: inserted.id,
      action: "insert",
      before_json: null,
      after_json: inserted,
    });

    if (auditError) {
      console.error("[POST /api/me/symptoms] audit log error:", auditError.message);
    }

    return NextResponse.json({
      id: inserted.id,
      patientUserId: inserted.patient_user_id,
      category: inserted.category,
      description: inserted.description,
      severity: inserted.severity,
      status: inserted.status,
      startedAt: inserted.started_at,
      endedAt: inserted.ended_at,
      loggedVia: inserted.logged_via,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/me/symptoms] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
