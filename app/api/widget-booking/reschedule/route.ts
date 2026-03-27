import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rescheduleWidgetBooking } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const rescheduleSchema = z.object({
  manageToken: z.string().trim().min(1, "缺少管理憑證"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "時間格式需為 HH:mm"),
  clinicId: z.string().trim().min(1, "缺少診所").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = rescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await rescheduleWidgetBooking(parsed.data);
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
        error: error instanceof Error ? error.message : "更改預約時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
