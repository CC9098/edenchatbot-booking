import { NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const CONSTITUTION_VALUES = ["depleting", "crossing", "hoarding", "mixed", "unknown"] as const;
type ConstitutionValue = (typeof CONSTITUTION_VALUES)[number];

function isConstitutionValue(value: unknown): value is ConstitutionValue {
  return typeof value === "string" && CONSTITUTION_VALUES.includes(value as ConstitutionValue);
}

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

    // Fallback source: profile-level constitution
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("constitution_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[GET /api/me/care-context] profile constitution error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Last fallback source: latest chat session type bound to this login user.
    const { data: latestSession, error: latestSessionError } = await supabase
      .from("chat_sessions")
      .select("type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSessionError) {
      console.error("[GET /api/me/care-context] latest session type error:", latestSessionError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Keep consistency with chat/v2 resolution while adding legacy fallback to chat_sessions.type.
    let resolvedConstitution: ConstitutionValue = "unknown";
    let constitutionSource: "patient_care_profile" | "profiles" | "chat_sessions" | "default" = "default";

    if (isConstitutionValue(careProfile?.constitution) && careProfile.constitution !== "unknown") {
      resolvedConstitution = careProfile.constitution;
      constitutionSource = "patient_care_profile";
    } else if (isConstitutionValue(profile?.constitution_type)) {
      resolvedConstitution = profile.constitution_type;
      constitutionSource = "profiles";
    } else if (isConstitutionValue(latestSession?.type)) {
      resolvedConstitution = latestSession.type;
      constitutionSource = "chat_sessions";
    } else if (isConstitutionValue(careProfile?.constitution)) {
      resolvedConstitution = careProfile.constitution;
      constitutionSource = "patient_care_profile";
    }

    // Fetch active care instructions
    const { data: instructions, error: instrError } = await supabase
      .from("care_instructions")
      .select("id, instruction_type, title, content_md, status, start_date, end_date, created_by, created_at, updated_at")
      .eq("patient_user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (instrError) {
      console.error("[GET /api/me/care-context] instructions error:", instrError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const creatorIds = Array.from(
      new Set(
        (instructions || [])
          .map((item) => item.created_by)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    let creatorNameMap = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators, error: creatorsError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", creatorIds);

      if (creatorsError) {
        console.error("[GET /api/me/care-context] creator profile error:", creatorsError.message);
      } else {
        creatorNameMap = new Map(
          (creators || [])
            .filter((row): row is { id: string; display_name: string | null } => typeof row.id === "string")
            .map((row) => [row.id, row.display_name || "醫師"]),
        );
      }
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
      constitution: resolvedConstitution,
      constitutionSource,
      constitutionNote: careProfile?.constitution_note || null,
      activeInstructions: (instructions || []).map((i) => {
        const createdBy = typeof i.created_by === "string" ? i.created_by : null;
        return {
          id: i.id,
          instructionType: i.instruction_type,
          title: i.title,
          contentMd: i.content_md,
          status: i.status,
          startDate: i.start_date,
          endDate: i.end_date,
          createdBy,
          createdByName: createdBy ? creatorNameMap.get(createdBy) || null : null,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        };
      }),
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
