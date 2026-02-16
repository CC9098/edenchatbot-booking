import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const patchSchema = z.object({
  progressPct: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
});

interface RouteContext {
  params: {
    lessonId: string;
  };
}

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    if (parsed.data.progressPct === undefined && parsed.data.completed === undefined) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      last_viewed_at: new Date().toISOString(),
    };

    if (parsed.data.progressPct !== undefined) {
      updates.progress_pct = parsed.data.progressPct;
    }

    if (parsed.data.completed !== undefined) {
      updates.completed_at = parsed.data.completed ? new Date().toISOString() : null;
    } else if (parsed.data.progressPct !== undefined) {
      updates.completed_at = parsed.data.progressPct >= 100 ? new Date().toISOString() : null;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("user_lesson_progress")
      .update(updates)
      .eq("user_id", user.id)
      .eq("lesson_id", context.params.lessonId)
      .select("user_id, lesson_id, progress_pct, completed_at, last_viewed_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/me/lesson-progress/[lessonId]] update error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Progress record not found" }, { status: 404 });
    }

    return NextResponse.json({
      userId: data.user_id,
      lessonId: data.lesson_id,
      progressPct: data.progress_pct,
      completedAt: data.completed_at,
      lastViewedAt: data.last_viewed_at,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error("[PATCH /api/me/lesson-progress/[lessonId]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("user_lesson_progress")
      .delete()
      .eq("user_id", user.id)
      .eq("lesson_id", context.params.lessonId);

    if (error) {
      console.error("[DELETE /api/me/lesson-progress/[lessonId]] delete error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/me/lesson-progress/[lessonId]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
