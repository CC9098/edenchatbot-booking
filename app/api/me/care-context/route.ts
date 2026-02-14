import { NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Fetch patient care profile
    const { data: careProfile, error: cpError } = await supabase
      .from("patient_care_profile")
      .select("constitution, constitution_note")
      .eq("patient_user_id", user.id)
      .maybeSingle();

    if (cpError) {
      console.error("[GET /api/me/care-context] care profile error:", cpError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Fetch active care instructions
    const { data: instructions, error: instrError } = await supabase
      .from("care_instructions")
      .select("id, instruction_type, title, content_md, status, start_date, end_date, created_at")
      .eq("patient_user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (instrError) {
      console.error("[GET /api/me/care-context] instructions error:", instrError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Fetch next pending follow-up plan (earliest suggested_date)
    const { data: nextFollowUp, error: fuError } = await supabase
      .from("follow_up_plans")
      .select("id, suggested_date, status")
      .eq("patient_user_id", user.id)
      .eq("status", "pending")
      .order("suggested_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fuError) {
      console.error("[GET /api/me/care-context] follow-up error:", fuError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      constitution: careProfile?.constitution || "unknown",
      constitutionNote: careProfile?.constitution_note || null,
      activeInstructions: (instructions || []).map((i) => ({
        id: i.id,
        instructionType: i.instruction_type,
        title: i.title,
        contentMd: i.content_md,
        status: i.status,
        startDate: i.start_date,
        endDate: i.end_date,
        createdAt: i.created_at,
      })),
      nextFollowUp: nextFollowUp
        ? {
            id: nextFollowUp.id,
            suggestedDate: nextFollowUp.suggested_date,
            status: nextFollowUp.status,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/me/care-context] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
