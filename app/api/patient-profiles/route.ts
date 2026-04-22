import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export type PatientProfile = {
  id: string;
  user_id: string;
  display_name: string;
  relationship: string | null;
  date_of_birth: string | null;
  gender: string | null;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// GET /api/patient-profiles
// Returns all patient_profiles for the current user, default first, then by created_at asc.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use user-scoped client so RLS enforces user_id = auth.uid()
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("patient_profiles")
      .select("id, user_id, display_name, relationship, date_of_birth, gender, is_default, notes, created_at, updated_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/patient-profiles] DB error:", error.message);
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    return NextResponse.json({ profiles: (data ?? []) as PatientProfile[] });
  } catch (err) {
    console.error("[GET /api/patient-profiles] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/patient-profiles
// Body: { displayName: string, relationship?: string, dateOfBirth?: string, gender?: string }
// Inserts a new patient_profile. is_default = true only if user has zero existing profiles.
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      displayName?: unknown;
      relationship?: unknown;
      dateOfBirth?: unknown;
      gender?: unknown;
    };

    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!displayName) {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    }

    const relationship = typeof body.relationship === "string" ? body.relationship.trim() || null : null;
    const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() || null : null;
    const gender = typeof body.gender === "string" ? body.gender.trim() || null : null;

    // User-scoped client — RLS enforces ownership
    const supabase = createServerClient();

    // Check how many profiles this user already has
    const { count, error: countError } = await supabase
      .from("patient_profiles")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("[POST /api/patient-profiles] Count error:", countError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const isDefault = (count ?? 0) === 0;

    const { data: inserted, error: insertError } = await supabase
      .from("patient_profiles")
      .insert({
        user_id: user.id,
        display_name: displayName,
        relationship,
        date_of_birth: dateOfBirth,
        gender,
        is_default: isDefault,
      })
      .select("id, user_id, display_name, relationship, date_of_birth, gender, is_default, notes, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("[POST /api/patient-profiles] Insert error:", insertError.message);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({ profile: inserted as PatientProfile }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/patient-profiles] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
