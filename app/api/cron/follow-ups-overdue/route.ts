import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function resolveCronSecret(): string | null {
  const primary = process.env.CRON_SECRET?.trim();
  if (primary) return primary;

  // Backward compatibility for older deployments; prefer CRON_SECRET.
  const legacy = process.env.INTERNAL_CRON_SECRET?.trim();
  if (legacy) return legacy;

  return null;
}

function isAuthorizedCronRequest(request: NextRequest, cronSecret: string): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function getMissingSecretError(): NextResponse {
  return NextResponse.json(
    { error: "CRON_SECRET is not configured" },
    { status: 500 },
  );
}

async function markOverdueFollowUps() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("follow_up_plans")
    .update({ status: "overdue", updated_at: updatedAt })
    .eq("status", "pending")
    .lt("suggested_date", today)
    .select("id, patient_user_id, suggested_date");

  if (error) {
    throw new Error(error.message);
  }

  return {
    today,
    updatedCount: data?.length ?? 0,
  };
}

async function runCron(request: NextRequest) {
  const cronSecret = resolveCronSecret();
  if (!cronSecret) {
    return getMissingSecretError();
  }

  if (!isAuthorizedCronRequest(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await markOverdueFollowUps();
    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/follow-ups-overdue] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}
