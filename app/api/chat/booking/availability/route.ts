import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { getMappingWithFallback } from "@/lib/storage-helpers";
import { getFreeBusy } from "@/lib/google-calendar";
import {
  getApplicableHolidaysForDate,
  getScheduleForDayFromWeekly,
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotAvailableUtc,
  isSlotBlockedByHolidaysUtc,
} from "@/lib/booking-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getDoctorBookingSlotMinutes } from "@/shared/clinic-data";
import { type Holiday } from "@/shared/schema";
import { getSafeErrorMessage } from "@/lib/error-sanitizer";
import { getVirtualOnlineAvailability } from "@/lib/virtual-online-booking";

// ── Whitelist schema ────────────────────────────────────────────────
// Only these fields are accepted; anything extra is stripped.
const bridgeAvailabilitySchema = z
  .object({
    doctorId: z.string(),
    clinicId: z.string(),
    date: z.string(), // YYYY-MM-DD
    durationMinutes: z.number().int().positive().default(15),
    visitType: z.enum(["first", "followup"]).optional(),
  })
  .strict(); // reject unknown keys

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

export async function POST(request: NextRequest) {
  try {
    // Optional auth – log user if present, but don't block anonymous
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      console.log(`[chat/booking/availability] authed user: ${user.id}`);
    }

    const body = await request.json();
    const parsed = bridgeAvailabilitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input parameters", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { doctorId, clinicId, date, visitType } = parsed.data;
    const durationMinutes = getDoctorBookingSlotMinutes(doctorId, visitType);
    const slotIntervalMinutes = durationMinutes;

    // Validate date format
    const requestedDate = date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (clinicId === "online") {
      try {
        const availability = await getVirtualOnlineAvailability({
          doctorId,
          requestedDate,
          durationMinutes,
        });

        if (!availability.mappingFound) {
          return NextResponse.json(
            { error: "Doctor not available at this clinic" },
            { status: 404 }
          );
        }

        if (availability.isClosed) {
          return NextResponse.json({
            isClosed: true,
            isHoliday: availability.isHoliday,
            slots: [],
          });
        }

        return NextResponse.json({ success: true, slots: availability.slots });
      } catch (calendarError) {
        console.error(
          `[chat/booking/availability] Calendar error: ${getSafeErrorMessage(calendarError)}`
        );
        return NextResponse.json(
          {
            error: "暫時未能讀取預約日曆，請稍後再試或聯絡診所。",
            errorCode: "CALENDAR_UNAVAILABLE",
          },
          { status: 503 }
        );
      }
    }

    // Look up doctor-clinic mapping
    const mapping = await getMappingWithFallback(doctorId, clinicId, requestedDate);
    if (!mapping || !mapping.isActive) {
      return NextResponse.json(
        { error: "Doctor not available at this clinic" },
        { status: 404 }
      );
    }

    // Check holidays
    let isBlocked = false;
    let applicableHolidays: Holiday[] = [];
    try {
      applicableHolidays = await getApplicableHolidaysForDate(
        requestedDate,
        doctorId,
        clinicId
      );
      isBlocked = applicableHolidays.some(
        (holiday) => !holiday.startTime || !holiday.endTime
      );
    } catch {
      // Fail open if DB is unreachable
      isBlocked = false;
      applicableHolidays = [];
    }

    if (isBlocked) {
      return NextResponse.json({ isClosed: true, isHoliday: true, slots: [] });
    }

    // Determine day schedule
    const requestedDayUtc = fromZonedTime(
      `${requestedDate}T00:00:00`,
      HONG_KONG_TIMEZONE
    );
    const requestedDayInHk = toZonedTime(requestedDayUtc, HONG_KONG_TIMEZONE);
    const dayOfWeek = requestedDayInHk.getDay();
    const daySchedule = getScheduleForDayFromWeekly(
      mapping.schedule,
      dayOfWeek
    );

    if (!daySchedule || daySchedule.length === 0) {
      return NextResponse.json({ isClosed: true, slots: [] });
    }

    // Fetch Google Calendar busy slots
    let busySlots: { start: Date; end: Date }[] = [];
    try {
      busySlots = await getFreeBusy(mapping.calendarId, requestedDayUtc);
    } catch (calendarError) {
      console.error(
        `[chat/booking/availability] Calendar error: ${getSafeErrorMessage(calendarError)}`
      );
      return NextResponse.json(
        {
          error: "暫時未能讀取預約日曆，請稍後再試或聯絡診所。",
          errorCode: "CALENDAR_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    const availableSlots: string[] = [];
    const nowUtc = new Date();
    const todayInHk = formatInTimeZone(
      nowUtc,
      HONG_KONG_TIMEZONE,
      "yyyy-MM-dd"
    );
    const isToday = requestedDate === todayInHk;
    const bufferMinutes = 60;
    const bookingCutoffUtc = new Date(
      nowUtc.getTime() + bufferMinutes * 60 * 1000
    );

    for (const range of daySchedule) {
      let currentSlot = fromZonedTime(
        `${requestedDate}T${range.start}:00`,
        HONG_KONG_TIMEZONE
      );
      const endData = fromZonedTime(
        `${requestedDate}T${range.end}:00`,
        HONG_KONG_TIMEZONE
      );

      while (currentSlot < endData) {
        if (isToday && currentSlot < bookingCutoffUtc) {
          currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
          continue;
        }

        if (isSlotAfterClinicLastBookingCutoffUtc(currentSlot, clinicId)) {
          currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
          continue;
        }

        const slotEnd = new Date(
          currentSlot.getTime() + durationMinutes * 60000
        );
        if (slotEnd > endData) break;

        if (
          isSlotAvailableUtc(currentSlot, slotEnd, busySlots) &&
          !isSlotBlockedByHolidaysUtc(
            currentSlot,
            slotEnd,
            applicableHolidays
          )
        ) {
          const slotStr = formatInTimeZone(
            currentSlot,
            HONG_KONG_TIMEZONE,
            "HH:mm"
          );
          availableSlots.push(slotStr);
        }

        currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
      }
    }

    return NextResponse.json({ success: true, slots: availableSlots });
  } catch (error: unknown) {
    console.error(
      `[chat/booking/availability] Error: ${getSafeErrorMessage(error)}`
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
