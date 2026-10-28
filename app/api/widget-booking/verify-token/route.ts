import { bookingFeedback, parseBookingLocale, type BookingLocale } from '@/shared/booking-locale';
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyManageAccessTokenAndListBookings } from "@/lib/widget-booking-management";

export const runtime = "nodejs";

const verifyTokenSchema = z.object({
  token: z.string().trim().min(1, "管理連結無效"),
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
    const parsed = verifyTokenSchema.safeParse(body);

    if (!parsed.success) {
      return respond(
        { error: "管理連結無效", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await verifyManageAccessTokenAndListBookings(parsed.data.token);
    if (!result.success) {
      return respond(
        { error: result.error },
        { status: 400 },
      );
    }

    return respond(result);
  } catch (error) {
    return respond(
      {
        error: error instanceof Error ? error.message : "驗證管理連結時發生錯誤。",
      },
      { status: 500 },
    );
  }
}
