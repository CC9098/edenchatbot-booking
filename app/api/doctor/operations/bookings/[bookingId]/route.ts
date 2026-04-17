import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { getStaffOperationBooking } from "@/lib/doctor-booking-operations";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { bookingId: string } },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const booking = await getStaffOperationBooking(params.bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/doctor/operations/bookings/[bookingId]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
