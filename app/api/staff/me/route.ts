import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);

    return NextResponse.json({
      userId: user.id,
      role: staffRole.role,
      isActive: staffRole.is_active,
      staffKind: staffRole.staff_kind,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/me] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
