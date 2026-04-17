import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { listStaffOperationBookings } from "@/lib/doctor-booking-operations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const result = await listStaffOperationBookings({
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || undefined,
      doctorId: searchParams.get("doctorId") || undefined,
      clinicId: searchParams.get("clinicId") || undefined,
      source: searchParams.get("source") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/doctor/operations/bookings] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
