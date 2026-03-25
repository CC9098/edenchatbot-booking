import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyManageAccessTokenAndListBookings } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const verifyTokenSchema = z.object({
  token: z.string().trim().min(1, "管理連結無效"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "管理連結無效", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await verifyManageAccessTokenAndListBookings(parsed.data.token);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "驗證管理連結時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
