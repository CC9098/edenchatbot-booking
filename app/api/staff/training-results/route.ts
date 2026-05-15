import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  getCurrentUser,
  requireStaffManagerRole,
  requireStaffRole,
} from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const resultSchema = z.object({
  moduleId: z.string().min(1).max(120),
  moduleTitle: z.string().min(1).max(200),
  videoId: z.string().min(1).max(200),
  videoTitle: z.string().min(1).max(200),
  score: z.number().int().min(0),
  total: z.number().int().min(1).max(20),
  criticalErrors: z.number().int().min(0).max(20),
  passed: z.boolean(),
  answers: z.record(z.string(), z.enum(["A", "B", "C", "D"])),
});

type TrainingResultRow = {
  id: string;
  staff_user_id: string;
  staff_email: string | null;
  module_id: string;
  module_title: string;
  video_id: string;
  video_title: string;
  score: number;
  total: number;
  critical_errors: number;
  passed: boolean;
  completed_at: string;
};

export const dynamic = "force-dynamic";

function isMissingTrainingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /staff_training_results/i.test(error.message || "");
}

function mapRow(row: TrainingResultRow) {
  return {
    id: row.id,
    staffUserId: row.staff_user_id,
    staffEmail: row.staff_email,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    videoId: row.video_id,
    videoTitle: row.video_title,
    score: row.score,
    total: row.total,
    criticalErrors: row.critical_errors,
    passed: row.passed,
    completedAt: row.completed_at,
    synced: true,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const supabase = createServiceClient();

    if (scope === "all") {
      await requireStaffManagerRole(user.id);

      const { data, error } = await supabase
        .from("staff_training_results")
        .select("id, staff_user_id, staff_email, module_id, module_title, video_id, video_title, score, total, critical_errors, passed, completed_at")
        .order("completed_at", { ascending: false })
        .limit(100);

      if (error) {
        if (isMissingTrainingTable(error)) return NextResponse.json({ items: [] });
        console.error("[GET /api/staff/training-results?scope=all] query error:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      return NextResponse.json({ items: (data || []).map((row) => mapRow(row as TrainingResultRow)) });
    }

    await requireStaffRole(user.id);

    const { data, error } = await supabase
      .from("staff_training_results")
      .select("id, staff_user_id, staff_email, module_id, module_title, video_id, video_title, score, total, critical_errors, passed, completed_at")
      .eq("staff_user_id", user.id)
      .order("completed_at", { ascending: false })
      .limit(100);

    if (error) {
      if (isMissingTrainingTable(error)) return NextResponse.json({ items: [] });
      console.error("[GET /api/staff/training-results] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map((row) => mapRow(row as TrainingResultRow)) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/training-results] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const body = await request.json();
    const parsed = resultSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const { data: authUserData } = await supabase.auth.admin.getUserById(user.id);
    const payload = parsed.data;

    const { data, error } = await supabase
      .from("staff_training_results")
      .insert({
        staff_user_id: user.id,
        staff_email: authUserData.user?.email?.toLowerCase() || null,
        module_id: payload.moduleId,
        module_title: payload.moduleTitle,
        video_id: payload.videoId,
        video_title: payload.videoTitle,
        score: payload.score,
        total: payload.total,
        critical_errors: payload.criticalErrors,
        passed: payload.passed,
        answers: payload.answers,
      })
      .select("id, staff_user_id, staff_email, module_id, module_title, video_id, video_title, score, total, critical_errors, passed, completed_at")
      .single();

    if (error) {
      if (isMissingTrainingTable(error)) {
        return NextResponse.json(
          { degraded: true, error: "Training results table is not ready" },
          { status: 202 },
        );
      }

      console.error("[POST /api/staff/training-results] insert error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ item: mapRow(data as TrainingResultRow) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/staff/training-results] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
