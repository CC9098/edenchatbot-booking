import { NextRequest, NextResponse } from "next/server";

import { getDailyPosSyncPlan } from "@/lib/pos-sync-daily-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const includeCandidates = request.nextUrl.searchParams.get("includeCandidates") !== "0";
    const plan = await getDailyPosSyncPlan({
      date: request.nextUrl.searchParams.get("date") || undefined,
      clinicId: request.nextUrl.searchParams.get("clinicId") || undefined,
      limit: parseLimit(request.nextUrl.searchParams.get("limit")),
    });

    if (!includeCandidates) {
      return NextResponse.json({
        success: true,
        plan: {
          ...plan,
          candidates: [],
        },
      });
    }

    return NextResponse.json({ success: true, plan });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[GET /api/cron/pos-sync-daily] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
