import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const CONSTITUTION_VALUES = ["depleting", "crossing", "hoarding", "mixed", "unknown"] as const;
type ConstitutionValue = (typeof CONSTITUTION_VALUES)[number];

// Each question answer maps to a constitution type or "neutral"
const ANSWER_VALUES = [...CONSTITUTION_VALUES, "neutral"] as const;

const SubmitSchema = z.object({
  answers: z.record(z.string(), z.enum(ANSWER_VALUES)),
  scores: z.record(z.string(), z.number().int().min(0)),
  suggestedConstitution: z.enum(CONSTITUTION_VALUES),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { answers, scores, suggestedConstitution } = parsed.data;

    const supabase = createServiceClient();

    // Insert self-assessment record
    const { data: assessment, error: insertError } = await supabase
      .from("constitution_self_assessments")
      .insert({
        patient_user_id: user.id,
        answers,
        scores,
        suggested_constitution: suggestedConstitution,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("[POST /api/me/questionnaire] insert error:", insertError.message);
      return NextResponse.json({ error: "Failed to save assessment" }, { status: 500 });
    }

    // If the patient has no doctor-assessed constitution yet (still "unknown"),
    // surface the self-assessment in the profiles table so it shows on /care.
    const { data: careProfile } = await supabase
      .from("patient_care_profile")
      .select("constitution")
      .eq("patient_user_id", user.id)
      .maybeSingle();

    const hasNoOfficialConstitution = !careProfile || careProfile.constitution === "unknown";

    if (hasNoOfficialConstitution && suggestedConstitution !== "unknown") {
      // Update profiles.constitution_type so care-context picks it up as a secondary source.
      // This does NOT touch patient_care_profile, which remains the doctor's authority.
      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, constitution_type: suggestedConstitution }, { onConflict: "id" });

      if (profileErr) {
        // Non-fatal: assessment was already saved
        console.warn("[POST /api/me/questionnaire] profiles update warning:", profileErr.message);
      }
    }

    return NextResponse.json({
      id: assessment.id,
      suggestedConstitution,
      createdAt: assessment.created_at,
    });
  } catch (err) {
    console.error("[POST /api/me/questionnaire] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET – fetch the patient's latest self-assessment
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("constitution_self_assessments")
      .select("id, suggested_constitution, answers, scores, created_at")
      .eq("patient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/me/questionnaire] select error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ assessment: data ?? null });
  } catch (err) {
    console.error("[GET /api/me/questionnaire] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
