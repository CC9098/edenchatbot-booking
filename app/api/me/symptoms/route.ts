import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import {
  buildSymptomElementScores,
  isMissingSymptomElementColumnsError,
  isSymptomElement,
  resolveSeverityWeight,
  resolveSuggestedElement,
} from "@/lib/symptom-element";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUS_FILTERS = new Set(["all", "active", "resolved", "recurring"]);
const RESOLUTION_METHOD_MAX = 120;
const RESOLUTION_NOTE_MAX = 500;
const RESOLUTION_DAYS_MIN = 0;
const RESOLUTION_DAYS_MAX = 365;
const SYMPTOM_BASE_COLUMNS =
  "id, patient_user_id, category, description, severity, status, started_at, ended_at, resolution_method, resolution_note, resolution_days, logged_via, created_at, updated_at";
const SYMPTOM_ELEMENT_COLUMNS =
  "element_traits, element_score_water, element_score_wind, element_score_thunder, element_suggested_label, element_review_label, element_reviewed_by, element_reviewed_at";
const SYMPTOM_COLUMNS_WITH_ELEMENTS = `${SYMPTOM_BASE_COLUMNS}, ${SYMPTOM_ELEMENT_COLUMNS}`;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
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
    elementTraits:
      row.element_traits && typeof row.element_traits === "object"
        ? (row.element_traits as Record<string, unknown>)
        : null,
    elementScoreWater: Number(row.element_score_water || 0),
    elementScoreWind: Number(row.element_score_wind || 0),
    elementScoreThunder: Number(row.element_score_thunder || 0),
    elementSuggestedLabel: isSymptomElement(row.element_suggested_label)
      ? row.element_suggested_label
      : "undetermined",
    elementReviewLabel: isSymptomElement(row.element_review_label) ? row.element_review_label : null,
    elementReviewedBy: typeof row.element_reviewed_by === "string" ? row.element_reviewed_by : null,
    elementReviewedAt: typeof row.element_reviewed_at === "string" ? row.element_reviewed_at : null,
  };
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
    const buildQuery = (columns: string) => {
      let query = supabase
        .from("symptom_logs")
        .select(columns, { count: "exact" })
        .eq("patient_user_id", user.id) as any;

      if (status !== "all") {
        query = query.eq("status", status);
      }
      if (category) {
        query = query.eq("category", category);
      }

      return query.order("started_at", { ascending: false }).range(offset, offset + limit - 1);
    };

    let { data, error, count } = await buildQuery(SYMPTOM_COLUMNS_WITH_ELEMENTS);

    if (error && isMissingSymptomElementColumnsError(error)) {
      console.warn("[GET /api/me/symptoms] element columns missing, fallback to legacy query");
      ({ data, error, count } = await buildQuery(SYMPTOM_BASE_COLUMNS));
    }

    if (error) {
      console.error("[GET /api/me/symptoms] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      symptoms: (data || []).map((row: unknown) => mapSymptomRow(row as Record<string, unknown>)),
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
    const { category, description, severity, startedAt, endedAt, resolutionMethod, resolutionNote, resolutionDays, elementCue, elementTraits } = body;

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

    const normalizedResolutionMethod =
      resolutionMethod === undefined || resolutionMethod === null || resolutionMethod === ""
        ? null
        : resolutionMethod;

    if (
      normalizedResolutionMethod !== null &&
      (typeof normalizedResolutionMethod !== "string" ||
        !normalizedResolutionMethod.trim() ||
        normalizedResolutionMethod.trim().length > RESOLUTION_METHOD_MAX)
    ) {
      return NextResponse.json(
        { error: `resolutionMethod must be a non-empty string up to ${RESOLUTION_METHOD_MAX} chars` },
        { status: 400 },
      );
    }

    const normalizedResolutionNote =
      resolutionNote === undefined || resolutionNote === null || resolutionNote === ""
        ? null
        : resolutionNote;

    if (
      normalizedResolutionNote !== null &&
      (typeof normalizedResolutionNote !== "string" ||
        normalizedResolutionNote.trim().length > RESOLUTION_NOTE_MAX)
    ) {
      return NextResponse.json(
        { error: `resolutionNote must be a string up to ${RESOLUTION_NOTE_MAX} chars` },
        { status: 400 },
      );
    }

    let normalizedResolutionDays: number | null = null;
    if (resolutionDays !== undefined && resolutionDays !== null && resolutionDays !== "") {
      if (
        !Number.isInteger(resolutionDays) ||
        resolutionDays < RESOLUTION_DAYS_MIN ||
        resolutionDays > RESOLUTION_DAYS_MAX
      ) {
        return NextResponse.json(
          { error: `resolutionDays must be an integer between ${RESOLUTION_DAYS_MIN} and ${RESOLUTION_DAYS_MAX}` },
          { status: 400 },
        );
      }
      normalizedResolutionDays = resolutionDays;
    }

    const hasResolutionDetails =
      normalizedResolutionMethod !== null ||
      normalizedResolutionNote !== null ||
      normalizedResolutionDays !== null;

    if (hasResolutionDetails && !normalizedEndedAt) {
      return NextResponse.json(
        { error: "resolution details require endedAt" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const normalizedElementCue = isSymptomElement(elementCue) ? elementCue : "undetermined";
    const elementScores = buildSymptomElementScores(
      normalizedElementCue,
      typeof severity === "number" ? severity : null,
    );
    const suggestedElement = resolveSuggestedElement(elementScores);
    const normalizedElementTraits =
      elementTraits && typeof elementTraits === "object" ? elementTraits : {};

    const baseInsertData: Record<string, unknown> = {
      patient_user_id: user.id,
      category: category.trim(),
      status: normalizedEndedAt ? "resolved" : "active",
      started_at: startedAt,
      logged_via: "manual", // Logged via API (not chatbot)
    };

    const elementInsertData: Record<string, unknown> = {
      element_traits: {
        ...normalizedElementTraits,
        cue: normalizedElementCue,
        source: "manual_api",
        severityWeight: resolveSeverityWeight(typeof severity === "number" ? severity : null),
      },
      element_score_water: elementScores.water,
      element_score_wind: elementScores.wind,
      element_score_thunder: elementScores.thunder,
      element_suggested_label: suggestedElement,
    };

    if (typeof description === "string" && description.trim()) {
      baseInsertData.description = description.trim();
    }

    if (severity !== undefined && severity !== null) {
      baseInsertData.severity = severity;
    }

    if (normalizedEndedAt) {
      baseInsertData.ended_at = normalizedEndedAt;
      if (normalizedResolutionMethod !== null) {
        baseInsertData.resolution_method = normalizedResolutionMethod.trim();
      }
      if (normalizedResolutionNote !== null) {
        baseInsertData.resolution_note = normalizedResolutionNote.trim() || null;
      }
      if (normalizedResolutionDays !== null) {
        baseInsertData.resolution_days = normalizedResolutionDays;
      }
    }

    let { data: inserted, error: insertError } = await supabase
      .from("symptom_logs")
      .insert({ ...baseInsertData, ...elementInsertData })
      .select(SYMPTOM_COLUMNS_WITH_ELEMENTS)
      .single();

    if (insertError && isMissingSymptomElementColumnsError(insertError)) {
      console.warn("[POST /api/me/symptoms] element columns missing, fallback to legacy insert");
      ({ data: inserted, error: insertError } = await supabase
        .from("symptom_logs")
        .insert(baseInsertData)
        .select(SYMPTOM_BASE_COLUMNS)
        .single());
    }

    if (insertError) {
      console.error("[POST /api/me/symptoms] insert error:", insertError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    if (!inserted) {
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

    const normalizedInserted = mapSymptomRow(inserted as unknown as Record<string, unknown>);

    return NextResponse.json(
      {
        ...normalizedInserted,
        patientUserId: (inserted as { patient_user_id?: string | null }).patient_user_id || null,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/me/symptoms] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
