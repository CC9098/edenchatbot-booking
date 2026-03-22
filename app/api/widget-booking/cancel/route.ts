import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cancelWidgetBooking } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const cancelSchema = z.object({
  manageToken: z.string().trim().min(1, "缺少管理憑證"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await cancelWidgetBooking(parsed.data.manageToken);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, clinicWhatsappUrl: result.clinicWhatsappUrl || null },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取消預約時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
