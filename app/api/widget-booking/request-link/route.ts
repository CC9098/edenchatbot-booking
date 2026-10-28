import { bookingFeedback, parseBookingLocale, type BookingLocale } from '@/shared/booking-locale';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requestWidgetBookingManageLink } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const requestLinkSchema = z.object({
  locale: z.enum(["zh", "en"]).optional(),
  phone: z.string().trim().min(6, "請輸入 WhatsApp 電話號碼"),
  action: z.enum(["reschedule", "cancel"]).optional(),
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
    const parsed = requestLinkSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await requestWidgetBookingManageLink(parsed.data);
    if (!result.success) {
      return respond(
        {
          error: result.error,
          clinicWhatsappUrl: result.clinicWhatsappUrl || null,
        },
        { status: 400 },
      );
    }

    return respond(result);
  } catch (error) {
    return respond(
      {
        error: error instanceof Error ? error.message : "發送登入連結時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
