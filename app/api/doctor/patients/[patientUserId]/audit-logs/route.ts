import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  requirePatientAccess,
  requireStaffRole,
  AuthError,
} from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { patientUserId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);
    const { patientUserId } = params;
    await requirePatientAccess(user.id, patientUserId);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "30", 10) || 30, 1),
      100,
    );

    const supabase = createServiceClient();

    const { data: logs, error: logsError } = await supabase
      .from("audit_logs")
      .select(
        "id, actor_user_id, patient_user_id, entity, entity_id, action, before_json, after_json, created_at",
      )
      .eq("patient_user_id", patientUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error("[GET audit logs] query error:", logsError.message);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const actorIds = Array.from(
      new Set((logs || []).map((item) => item.actor_user_id).filter(Boolean)),
    );

    const actorNameMap = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);

      if (profileError) {
        console.error("[GET audit logs] profile query error:", profileError.message);
      } else {
        for (const profile of profiles || []) {
          actorNameMap.set(profile.id, profile.display_name || null);
        }
      }
    }

    return NextResponse.json({
      items: (logs || []).map((item) => ({
        id: item.id,
        actorUserId: item.actor_user_id,
        actorDisplayName: item.actor_user_id
          ? actorNameMap.get(item.actor_user_id) || null
          : null,
        patientUserId: item.patient_user_id,
        entity: item.entity,
        entityId: item.entity_id,
        action: item.action,
        beforeJson: item.before_json,
        afterJson: item.after_json,
        createdAt: item.created_at,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[GET audit logs] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
