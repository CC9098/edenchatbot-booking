import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { moveEventToCalendar, updateEvent } from "@/lib/google-calendar";
import { getCurrentUser } from "@/lib/auth-helpers";
import { markBookingIntakeRescheduledByEvent } from "@/lib/booking-intake-storage";
import { getSafeErrorMessage } from "@/lib/error-sanitizer";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";

// ── Whitelist schema ────────────────────────────────────────────────
const bridgeRescheduleSchema = z
  .object({
    eventId: z.string(),
    calendarId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().positive().default(15),
    doctorId: z.string().optional(),
    clinicId: z.string().optional(),
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

    const { eventId, calendarId, date, time, durationMinutes, doctorId, clinicId } = parsed.data;

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

    let nextEventId = eventId;
    let nextCalendarId = calendarId;
    let result:
      | { success: true; eventId?: string }
      | { success: false; error?: string };

    if (doctorId && clinicId === "online") {
      const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
        doctorId,
        requestedDate: date,
        time,
        durationMinutes,
        preferredCalendarId: calendarId,
      });

      if (resolvedOnlineMapping.errorCode === "CALENDAR_UNAVAILABLE") {
        return NextResponse.json(
          {
            error: "暫時未能讀取預約日曆，請稍後再試或聯絡診所。",
            errorCode: "CALENDAR_UNAVAILABLE",
          },
          { status: 503 }
        );
      }

      if (!resolvedOnlineMapping.mapping) {
        return NextResponse.json(
          {
            error:
              "This time slot has just been booked. Please pick another time.",
          },
          { status: 409 }
        );
      }

      const targetCalendarId = resolvedOnlineMapping.mapping.calendarId;
      if (targetCalendarId === calendarId) {
        result = await updateEvent(calendarId, eventId, {
          startTime: startDate,
          endTime: endDate,
        });
      } else {
        result = await moveEventToCalendar(calendarId, targetCalendarId, eventId, {
          startTime: startDate,
          endTime: endDate,
        });
        if (result.success) {
          nextEventId = result.eventId || eventId;
          nextCalendarId = targetCalendarId;
        }
      }
    } else {
      result = await updateEvent(calendarId, eventId, {
        startTime: startDate,
        endTime: endDate,
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reschedule booking" },
        { status: 500 }
      );
    }

    const intakeRescheduleSync = await markBookingIntakeRescheduledByEvent({
      googleEventId: eventId,
      calendarId,
      appointmentDate: date,
      appointmentTime: time,
      durationMinutes,
      nextGoogleEventId: nextEventId !== eventId ? nextEventId : undefined,
      nextCalendarId: nextCalendarId !== calendarId ? nextCalendarId : undefined,
    });
    if (!intakeRescheduleSync.success) {
      console.warn(
        `[chat/booking/reschedule] booking_intake sync warning: ${intakeRescheduleSync.error}`
      );
    }

    return NextResponse.json({
      success: true,
      bookingId: nextEventId,
      calendarId: nextCalendarId,
    });
  } catch (error: unknown) {
    console.error(
      `[chat/booking/reschedule] Error: ${getSafeErrorMessage(error)}`
    );
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
