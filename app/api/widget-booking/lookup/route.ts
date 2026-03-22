import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { lookupWidgetBooking } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const lookupSchema = z.object({
  bookingId: z.string().trim().min(1, "請輸入預約編號"),
  phone: z.string().trim().min(6, "請輸入電話號碼"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await lookupWidgetBooking(parsed.data.bookingId, parsed.data.phone);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "查詢預約時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
