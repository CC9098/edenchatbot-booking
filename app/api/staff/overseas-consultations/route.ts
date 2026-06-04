import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  OVERSEAS_CONSULTATION_STATUSES,
  listOverseasConsultationSubmissions,
  updateOverseasConsultationSubmission,
} from "@/lib/overseas-consultation";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(OVERSEAS_CONSULTATION_STATUSES).optional(),
  basic_fee_status: z.enum(["pending", "uploaded", "confirmed"]).optional(),
  staff_notes: z.string().trim().nullable().optional(),
  suggested_herbal_days: z.number().int().min(0).nullable().optional(),
  quoted_herbal_fee: z.number().int().min(0).nullable().optional(),
  herbal_fee_paid: z.boolean().optional(),
  admin_fee_paid: z.boolean().optional(),
  dispensing_completed: z.boolean().optional(),
  actual_postage: z.number().int().min(0).nullable().optional(),
  tracking_number: z.string().trim().nullable().optional(),
  postage_reimbursed: z.boolean().optional(),
});

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError(401, "Unauthorized");
  }
  await requireStaffRole(user.id);
}

export async function GET(request: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(request.url);
    const rows = await listOverseasConsultationSubmissions({
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/overseas-consultations] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireStaff();
    const parsed = updateSchema.parse(await request.json());
    const { id, ...patch } = parsed;
    const row = await updateOverseasConsultationSubmission(id, patch);
    return NextResponse.json({ row });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    console.error("[PATCH /api/staff/overseas-consultations] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
