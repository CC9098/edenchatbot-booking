import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  getCurrentUser,
  requirePatientAccess,
  requireStaffRole,
} from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const VALID_ANSWER_TYPES = new Set(["yes_no", "scale_0_10", "trend", "frequency", "free_text"]);

interface NormalizedAnswerInput {
  symptomKey: string;
  symptomLabel: string;
  questionText: string;
  answerType: string;
  answerValueText: string;
  answerValueNumber: number | null;
  metadata: Record<string, unknown>;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeAnswerInput(raw: unknown): NormalizedAnswerInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const answer = raw as Record<string, unknown>;
  const questionText = sanitizeText(answer.questionText, 220);
  const answerType = sanitizeText(answer.answerType, 40);
  const answerValueText = sanitizeText(answer.answerValueText, 120);
  const symptomKey = sanitizeText(answer.symptomKey, 80);
  const symptomLabel =
    sanitizeText(answer.symptomLabel, 80) || symptomKey || sanitizeText(answer.questionText, 40);

  if (!questionText || !answerValueText || !VALID_ANSWER_TYPES.has(answerType) || !symptomLabel) {
    return null;
  }

  let answerValueNumber: number | null = null;
  if (answerType === "scale_0_10") {
    const parsed = Number.parseInt(answerValueText, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 10) {
      answerValueNumber = parsed;
    }
  }

  const metadata: Record<string, unknown> = {};
  const reason = sanitizeText(answer.reason, 160);
  const note = sanitizeText(answer.note, 160);
  const suggestionId = sanitizeText(answer.suggestionId, 100);
  const sourceScreen = sanitizeText(answer.sourceScreen, 60);

  if (reason) metadata.reason = reason;
  if (note) metadata.note = note;
  if (suggestionId) metadata.suggestionId = suggestionId;
  if (sourceScreen) metadata.sourceScreen = sourceScreen;

  return {
    symptomKey: symptomKey || symptomLabel,
    symptomLabel,
    questionText,
    answerType,
    answerValueText,
    answerValueNumber,
    metadata,
  };
}

function mapAnswerRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    symptomKey: row.symptom_key,
    symptomLabel: row.symptom_label,
    questionText: row.question_text,
    answerType: row.answer_type,
    answerValueText: row.answer_value_text,
    answerValueNumber: row.answer_value_number,
    source: row.source,
    askedAt: row.asked_at,
    recordedBy: row.recorded_by,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

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
    const rawAnswers = Array.isArray(body.answers) ? body.answers : [];
    const normalizedAnswers = rawAnswers
      .map((item: unknown) => normalizeAnswerInput(item))
      .filter((item: NormalizedAnswerInput | null): item is NormalizedAnswerInput => Boolean(item))
      .slice(0, 12);

    if (normalizedAnswers.length === 0) {
      return NextResponse.json({ error: "至少需要一筆有效問診答案" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const insertPayload = normalizedAnswers.map((answer: NormalizedAnswerInput) => ({
      patient_user_id: patientUserId,
      symptom_key: answer.symptomKey,
      symptom_label: answer.symptomLabel,
      question_text: answer.questionText,
      answer_type: answer.answerType,
      answer_value_text: answer.answerValueText,
      answer_value_number: answer.answerValueNumber,
      source: "doctor_question_card",
      recorded_by: user.id,
      metadata: answer.metadata,
      asked_at: now,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("symptom_follow_up_answers")
      .insert(insertPayload)
      .select(
        "id, symptom_key, symptom_label, question_text, answer_type, answer_value_text, answer_value_number, source, asked_at, recorded_by, metadata, created_at"
      );

    if (insertError || !inserted) {
      console.error("[POST doctor symptom follow-ups] insert error:", insertError?.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_user_id: user.id,
      patient_user_id: patientUserId,
      entity: "symptom_follow_up_answers",
      entity_id: null,
      action: "insert",
      before_json: null,
      after_json: {
        insertedCount: inserted.length,
        ids: inserted.map((row: { id: string }) => row.id),
        symptomLabels: inserted.map((row: { symptom_label: string }) => row.symptom_label),
      },
    });

    if (auditError) {
      console.error("[POST doctor symptom follow-ups] audit log error:", auditError.message);
    }

    return NextResponse.json(
      {
        insertedCount: inserted.length,
        answers: inserted.map((row) => mapAnswerRow(row as unknown as Record<string, unknown>)),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST doctor symptom follow-ups] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
