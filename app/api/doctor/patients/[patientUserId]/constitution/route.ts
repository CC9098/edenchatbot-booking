import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireStaffRole, requirePatientAccess, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_CONSTITUTIONS = ["depleting", "crossing", "hoarding", "mixed", "unknown"];
const SCORABLE_CONSTITUTIONS = ["depleting", "crossing", "hoarding", "mixed"] as const;
const ASSESSMENT_LEVELS = ["suspect", "likely", "confirmed"] as const;
const ASSESSMENT_WEIGHT: Record<DoctorAssessmentLevel, number> = {
  suspect: 30,
  likely: 70,
  confirmed: 100,
};

type ScorableConstitution = (typeof SCORABLE_CONSTITUTIONS)[number];
type DoctorAssessmentLevel = (typeof ASSESSMENT_LEVELS)[number];
type ConstitutionScoreMap = Record<ScorableConstitution, number>;

function isDoctorAssessmentLevel(value: unknown): value is DoctorAssessmentLevel {
  return typeof value === "string" && ASSESSMENT_LEVELS.includes(value as DoctorAssessmentLevel);
}

function isScorableConstitution(value: unknown): value is ScorableConstitution {
  return typeof value === "string" && SCORABLE_CONSTITUTIONS.includes(value as ScorableConstitution);
}

function parseScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function buildExistingScores(existing: Record<string, unknown> | null | undefined): ConstitutionScoreMap {
  return {
    depleting: parseScore(existing?.constitution_score_depleting),
    crossing: parseScore(existing?.constitution_score_crossing),
    hoarding: parseScore(existing?.constitution_score_hoarding),
    mixed: parseScore(existing?.constitution_score_mixed),
  };
}

function resolveFromScores(
  scores: ConstitutionScoreMap,
  fallbackConstitution: string | null | undefined,
): string {
  const ranked = SCORABLE_CONSTITUTIONS
    .map((type) => ({ type, score: scores[type] }))
    .sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;

  if (topScore <= 0) return "unknown";

  const topTypes = ranked.filter((item) => item.score === topScore).map((item) => item.type);
  if (fallbackConstitution && topTypes.includes(fallbackConstitution as ScorableConstitution)) {
    return fallbackConstitution;
  }
  return topTypes[0];
}

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
    const { constitution, constitutionNote, assessmentLevel } = body;
    const resolvedAssessmentLevel: DoctorAssessmentLevel = isDoctorAssessmentLevel(assessmentLevel)
      ? assessmentLevel
      : "confirmed";

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

    if (assessmentLevel !== undefined && !isDoctorAssessmentLevel(assessmentLevel)) {
      return NextResponse.json(
        { error: `assessmentLevel must be one of: ${ASSESSMENT_LEVELS.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Fetch existing record for audit log before_json
    const { data: existing } = await supabase
      .from("patient_care_profile")
      .select(
        "patient_user_id, constitution, constitution_note, last_visit_at, updated_by, updated_at, constitution_score_depleting, constitution_score_crossing, constitution_score_hoarding, constitution_score_mixed, doctor_assessment_level, doctor_assessment_constitution, doctor_assessment_at",
      )
      .eq("patient_user_id", patientUserId)
      .maybeSingle();

    const currentScores = buildExistingScores(existing as Record<string, unknown> | null | undefined);
    const nextScores: ConstitutionScoreMap = { ...currentScores };
    const existingAssessmentLevel = isDoctorAssessmentLevel(existing?.doctor_assessment_level)
      ? existing.doctor_assessment_level
      : null;
    const existingAssessmentConstitution =
      typeof existing?.doctor_assessment_constitution === "string"
        ? existing.doctor_assessment_constitution
        : null;

    if (resolvedAssessmentLevel !== "confirmed" && isScorableConstitution(constitution)) {
      nextScores[constitution] += ASSESSMENT_WEIGHT[resolvedAssessmentLevel];
    }

    if (resolvedAssessmentLevel === "confirmed" && isScorableConstitution(constitution)) {
      nextScores[constitution] = Math.max(nextScores[constitution], ASSESSMENT_WEIGHT.confirmed);
    }

    let resolvedConstitution = constitution;
    const hasConfirmedLock = existingAssessmentLevel === "confirmed" && !!existingAssessmentConstitution;
    if (resolvedAssessmentLevel !== "confirmed") {
      if (hasConfirmedLock) {
        resolvedConstitution = existingAssessmentConstitution;
      } else {
        resolvedConstitution = resolveFromScores(nextScores, existing?.constitution);
      }
    }

    const nowIso = new Date().toISOString();
    const persistedAssessmentLevel: DoctorAssessmentLevel = hasConfirmedLock && resolvedAssessmentLevel !== "confirmed"
      ? "confirmed"
      : resolvedAssessmentLevel;
    const persistedAssessmentConstitution =
      hasConfirmedLock && resolvedAssessmentLevel !== "confirmed"
        ? existingAssessmentConstitution
        : constitution;
    const persistedAssessmentAt =
      hasConfirmedLock && resolvedAssessmentLevel !== "confirmed"
        ? (typeof existing?.doctor_assessment_at === "string" ? existing.doctor_assessment_at : nowIso)
        : nowIso;

    const upsertData: Record<string, unknown> = {
      patient_user_id: patientUserId,
      constitution: resolvedConstitution,
      updated_by: user.id,
      updated_at: nowIso,
      constitution_score_depleting: nextScores.depleting,
      constitution_score_crossing: nextScores.crossing,
      constitution_score_hoarding: nextScores.hoarding,
      constitution_score_mixed: nextScores.mixed,
      doctor_assessment_level: persistedAssessmentLevel,
      doctor_assessment_constitution: persistedAssessmentConstitution,
      doctor_assessment_at: persistedAssessmentAt,
    };

    if (constitutionNote !== undefined) {
      upsertData.constitution_note = constitutionNote;
    }

    const { data: updated, error: upsertError } = await supabase
      .from("patient_care_profile")
      .upsert(upsertData, { onConflict: "patient_user_id" })
      .select(
        "patient_user_id, constitution, constitution_note, last_visit_at, updated_by, updated_at, constitution_score_depleting, constitution_score_crossing, constitution_score_hoarding, constitution_score_mixed, doctor_assessment_level, doctor_assessment_constitution, doctor_assessment_at",
      )
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
      doctorAssessmentLevel: updated.doctor_assessment_level,
      doctorAssessmentConstitution: updated.doctor_assessment_constitution,
      doctorAssessmentAt: updated.doctor_assessment_at,
      constitutionScores: {
        depleting: parseScore(updated.constitution_score_depleting),
        crossing: parseScore(updated.constitution_score_crossing),
        hoarding: parseScore(updated.constitution_score_hoarding),
        mixed: parseScore(updated.constitution_score_mixed),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH constitution] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
