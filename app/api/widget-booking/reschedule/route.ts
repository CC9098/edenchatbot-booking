import { bookingFeedback, parseBookingLocale, type BookingLocale } from '@/shared/booking-locale';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rescheduleWidgetBooking } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const rescheduleSchema = z.object({
  locale: z.enum(["zh", "en"]).optional(),
  manageToken: z.string().trim().min(1, "缺少管理憑證"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式需為 YYYY-MM-DD"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "時間格式需為 HH:mm"),
  clinicId: z.string().trim().min(1, "缺少診所").optional(),
});

export async function POST(request: NextRequest) {
  let locale: BookingLocale = 'zh';
  const respond = (payload: Record<string, unknown>, init?: ResponseInit) => NextResponse.json({
    ...payload,
    ...(typeof payload.error === 'string' ? { error: bookingFeedback(payload.error, locale) } : {}),
    ...(typeof payload.message === 'string' ? { message: bookingFeedback(payload.message, locale) } : {}),
  }, init);

  try {
    const body = await request.json();
    locale = parseBookingLocale(body?.locale);
    const parsed = rescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await rescheduleWidgetBooking(parsed.data);
    if (!result.success) {
      return respond(
        { error: result.error, clinicWhatsappUrl: result.clinicWhatsappUrl || null },
        { status: 400 },
      );
    }

    return respond(result);
  } catch (error) {
    return respond(
      {
        error: error instanceof Error ? error.message : "更改預約時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
