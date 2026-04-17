import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { rescheduleStaffOperationBooking } from "@/lib/doctor-booking-operations";

export const dynamic = "force-dynamic";

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  clinicId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const body = await request.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await rescheduleStaffOperationBooking(params.bookingId, user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("找不到預約") ? 404 : 400;

    console.error("[POST /api/doctor/operations/bookings/[bookingId]/reschedule] unexpected error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
