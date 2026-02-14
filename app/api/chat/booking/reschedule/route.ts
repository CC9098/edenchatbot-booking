import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { updateEvent } from "@/lib/google-calendar";
import { getCurrentUser } from "@/lib/auth-helpers";

// ── Whitelist schema ────────────────────────────────────────────────
const bridgeRescheduleSchema = z
  .object({
    eventId: z.string(),
    calendarId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().positive().default(15),
  })
  .strict();

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

export async function POST(request: NextRequest) {
  try {
    // Optional auth
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      console.log(`[chat/booking/reschedule] authed user: ${user.id}`);
    }

    const body = await request.json();
    const parsed = bridgeRescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { eventId, calendarId, date, time, durationMinutes } = parsed.data;

    // Calculate start/end
    const startDate = fromZonedTime(
      `${date}T${time}:00`,
      HONG_KONG_TIMEZONE
    );
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date/time" },
        { status: 400 }
      );
    }
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const result = await updateEvent(calendarId, eventId, {
      startTime: startDate,
      endTime: endDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reschedule booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[chat/booking/reschedule] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
