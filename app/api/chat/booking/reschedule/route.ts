import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getFreeBusy, getEvent, moveEventToCalendar, updateEvent } from "@/lib/google-calendar";
import { getCurrentUser } from "@/lib/auth-helpers";
import { markBookingIntakeRescheduledByEvent } from "@/lib/booking-intake-storage";
import { getSafeErrorMessage } from "@/lib/error-sanitizer";
import {
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotAvailableUtc,
} from "@/lib/booking-helpers";
import { getMappingWithFallback } from "@/lib/storage-helpers";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";
import { CLINIC_BY_ID, CLINIC_ID_BY_NAME_ZH, DOCTOR_ID_BY_NAME_ZH } from "@/shared/clinic-data";

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

function extractBookingIdentity(event: any) {
  const description = typeof event?.description === "string" ? event.description : "";
  const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
  const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);
  const doctorId = doctorMatch?.[1]?.trim() ? DOCTOR_ID_BY_NAME_ZH[doctorMatch[1].trim()] : undefined;
  const clinicId = clinicMatch?.[1]?.trim() ? CLINIC_ID_BY_NAME_ZH[clinicMatch[1].trim()] : undefined;

  if (!doctorId || !clinicId) return null;

  return { doctorId, clinicId };
}

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
    let existingEvent: any = null;
    const existingEventResult = await getEvent(calendarId, eventId);
    if (existingEventResult.success && existingEventResult.event) {
      existingEvent = existingEventResult.event;
    }

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
    const existingIdentity = existingEvent ? extractBookingIdentity(existingEvent) : null;
    const effectiveDoctorId = doctorId || existingIdentity?.doctorId;
    const effectiveClinicId = clinicId || existingIdentity?.clinicId;
    const targetClinicProfile = effectiveClinicId
      ? CLINIC_BY_ID[effectiveClinicId as keyof typeof CLINIC_BY_ID]
      : undefined;
    const bookingMetadataOverrides = effectiveClinicId
      ? {
          doctorId: effectiveDoctorId,
          clinicId: effectiveClinicId,
          clinicName: targetClinicProfile?.nameEn,
          clinicNameZh: targetClinicProfile?.nameZh,
        }
      : undefined;
    const existingStartDateTime =
      typeof existingEvent?.start?.dateTime === "string"
        ? existingEvent.start.dateTime
        : typeof existingEvent?.start?.date === "string"
          ? `${existingEvent.start.date}T00:00:00+08:00`
          : null;
    const sameAsCurrentSlot = existingStartDateTime
      ? formatInTimeZone(new Date(existingStartDateTime), HONG_KONG_TIMEZONE, "yyyy-MM-dd") === date &&
        formatInTimeZone(new Date(existingStartDateTime), HONG_KONG_TIMEZONE, "HH:mm") === time
      : false;

    if (!sameAsCurrentSlot && effectiveClinicId !== "online" && isSlotAfterClinicLastBookingCutoffUtc(startDate, effectiveClinicId)) {
      return NextResponse.json(
        { error: "已超過此分店最後預約時間，請選擇較早時段。" },
        { status: 409 }
      );
    }

    let nextEventId = eventId;
    let nextCalendarId = calendarId;
    let result:
      | { success: true; eventId?: string }
      | { success: false; error?: string };

    if (effectiveDoctorId && effectiveClinicId === "online") {
      const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
        doctorId: effectiveDoctorId,
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
          bookingMetadata: bookingMetadataOverrides,
        });
      } else {
        result = await moveEventToCalendar(calendarId, targetCalendarId, eventId, {
          startTime: startDate,
          endTime: endDate,
          bookingMetadata: bookingMetadataOverrides,
        });
        if (result.success) {
          nextEventId = result.eventId || eventId;
          nextCalendarId = targetCalendarId;
        }
      }
    } else if (effectiveDoctorId && effectiveClinicId) {
      const mapping = await getMappingWithFallback(effectiveDoctorId, effectiveClinicId, date);
      if (!mapping || !mapping.isActive) {
        return NextResponse.json(
          { error: "Doctor schedule not found" },
          { status: 404 }
        );
      }

      const targetCalendarId = mapping.calendarId;
      const shouldRecheckAvailability = targetCalendarId !== calendarId || !sameAsCurrentSlot;

      if (shouldRecheckAvailability) {
        try {
          const requestedDayUtc = fromZonedTime(
            `${date}T00:00:00`,
            HONG_KONG_TIMEZONE
          );
          const busySlots = await getFreeBusy(targetCalendarId, requestedDayUtc);
          const isStillAvailable = isSlotAvailableUtc(startDate, endDate, busySlots);
          if (!isStillAvailable) {
            return NextResponse.json(
              { error: "This time slot has just been booked. Please pick another time." },
              { status: 409 }
            );
          }
        } catch (error) {
          console.error(
            `[chat/booking/reschedule] Calendar availability re-check failed: ${getSafeErrorMessage(error)}`
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

      if (targetCalendarId === calendarId) {
        result = await updateEvent(calendarId, eventId, {
          startTime: startDate,
          endTime: endDate,
          bookingMetadata: bookingMetadataOverrides,
        });
      } else {
        result = await moveEventToCalendar(calendarId, targetCalendarId, eventId, {
          startTime: startDate,
          endTime: endDate,
          bookingMetadata: bookingMetadataOverrides,
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
        bookingMetadata: bookingMetadataOverrides,
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
      nextClinicId:
        effectiveClinicId && effectiveClinicId !== existingIdentity?.clinicId
          ? effectiveClinicId
          : undefined,
      nextClinicNameZh:
        targetClinicProfile?.nameZh && effectiveClinicId !== existingIdentity?.clinicId
          ? targetClinicProfile.nameZh
          : undefined,
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
