import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requestWidgetBookingVerificationCode } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const requestCodeSchema = z.object({
  phone: z.string().trim().min(6, "請輸入 WhatsApp 電話號碼"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await requestWidgetBookingVerificationCode(parsed.data.phone);
    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          clinicWhatsappUrl: result.clinicWhatsappUrl || null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "發送驗證碼時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
