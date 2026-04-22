import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyWidgetBookingVerificationCode } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const verifyCodeSchema = z.object({
  phone: z.string().trim().min(6, "請輸入 WhatsApp 電話號碼"),
  code: z.string().trim().min(4, "請輸入驗證碼"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Collect cookies written by the auth bridge so we can attach them to the
    // final response. Each entry is a tuple [name, value, options].
    const pendingCookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const result = await verifyWidgetBookingVerificationCode({
      ...parsed.data,
      setCookie: (name, value, options) => {
        pendingCookies.push({ name, value, options });
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          clinicWhatsappUrl: result.clinicWhatsappUrl || null,
        },
        { status: 400 },
      );
    }

    const response = NextResponse.json(result);

    // Write session cookies onto the success response.
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      );
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "驗證預約時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
