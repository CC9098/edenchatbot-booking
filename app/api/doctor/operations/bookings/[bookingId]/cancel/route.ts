import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { cancelStaffOperationBooking } from "@/lib/doctor-booking-operations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { bookingId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const result = await cancelStaffOperationBooking(params.bookingId, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("找不到預約") || message.includes("Booking") ? 404 : 400;

    console.error("[POST /api/doctor/operations/bookings/[bookingId]/cancel] unexpected error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
