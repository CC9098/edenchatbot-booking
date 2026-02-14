import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import {
  createBooking,
  getFreeBusy,
} from "@/lib/google-calendar";
import { sendBookingConfirmationEmail } from "@/lib/gmail";
import { getMappingWithFallback } from "@/lib/storage-helpers";
import { isSlotAvailableUtc } from "@/lib/booking-helpers";
import { getClinicAddress } from "@/shared/clinic-data";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

// ── Whitelist schema ────────────────────────────────────────────────
const bridgeBookingSchema = z
  .object({
    doctorId: z.string(),
    doctorName: z.string(),
    doctorNameZh: z.string(),
    clinicId: z.string(),
    clinicName: z.string(),
    clinicNameZh: z.string(),
    date: z.string(), // YYYY-MM-DD
    time: z.string(), // HH:mm
    durationMinutes: z.number().int().positive().default(15),
    patientName: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email(),
    notes: z.string().optional(),
  })
  .strict();

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

export async function POST(request: NextRequest) {
  try {
    // Optional auth
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      console.log(`[chat/booking/create] authed user: ${user.id}`);
    }

    const body = await request.json();
    const parsed = bridgeBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const bookingData = parsed.data;

    // Resolve calendar ID
    const mapping = await getMappingWithFallback(
      bookingData.doctorId,
      bookingData.clinicId
    );
    if (!mapping || !mapping.isActive) {
      return NextResponse.json(
        { error: "Doctor schedule not found" },
        { status: 404 }
      );
    }
    const calendarId = mapping.calendarId;

    // Calculate start/end
    const startDate = fromZonedTime(
      `${bookingData.date}T${bookingData.time}:00`,
      HONG_KONG_TIMEZONE
    );
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date/time" },
        { status: 400 }
      );
    }
    const endDate = new Date(
      startDate.getTime() + bookingData.durationMinutes * 60000
    );

    // Double-check availability to prevent race conditions
    try {
      const requestedDayUtc = fromZonedTime(
        `${bookingData.date}T00:00:00`,
        HONG_KONG_TIMEZONE
      );
      const busySlots = await getFreeBusy(calendarId, requestedDayUtc);
      if (!isSlotAvailableUtc(startDate, endDate, busySlots)) {
        return NextResponse.json(
          {
            error:
              "This time slot has just been booked. Please pick another time.",
          },
          { status: 409 }
        );
      }
    } catch (calError) {
      console.error(
        "[chat/booking/create] Calendar availability re-check failed:",
        calError
      );
      return NextResponse.json(
        { error: "Failed to verify slot availability" },
        { status: 500 }
      );
    }

    // Create Google Calendar event
    const calResult = await createBooking(calendarId, {
      doctorName: bookingData.doctorName,
      doctorNameZh: bookingData.doctorNameZh,
      clinicName: bookingData.clinicName,
      clinicNameZh: bookingData.clinicNameZh,
      startTime: startDate,
      endTime: endDate,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      notes: bookingData.notes,
    });

    if (!calResult.success || !calResult.eventId) {
      console.error(
        "[chat/booking/create] Calendar creation failed:",
        calResult.error
      );
      return NextResponse.json(
        { error: "Failed to create booking in calendar" },
        { status: 500 }
      );
    }

    // Send confirmation email (best-effort)
    if (bookingData.email) {
      try {
        await sendBookingConfirmationEmail({
          patientName: bookingData.patientName,
          patientEmail: bookingData.email,
          doctorName: bookingData.doctorName,
          doctorNameZh: bookingData.doctorNameZh,
          clinicName: bookingData.clinicName,
          clinicNameZh: bookingData.clinicNameZh,
          clinicAddress: getClinicAddress(bookingData.clinicId),
          date: bookingData.date,
          time: bookingData.time,
          eventId: calResult.eventId,
          calendarId: calendarId,
        });
      } catch (emailError) {
        console.error(
          "[chat/booking/create] Email sending failed:",
          emailError
        );
      }
    }

    // ── Link follow-up plan if one exists near the booked date ──────
    if (user) {
      try {
        const supabase = createServiceClient();

        // Find a pending follow_up_plan for this user within +/- 3 days of the booked date
        const bookedDate = bookingData.date; // YYYY-MM-DD
        const dateObj = new Date(bookedDate);
        const windowStart = new Date(dateObj);
        windowStart.setDate(windowStart.getDate() - 3);
        const windowEnd = new Date(dateObj);
        windowEnd.setDate(windowEnd.getDate() + 3);

        const windowStartStr = windowStart.toISOString().slice(0, 10);
        const windowEndStr = windowEnd.toISOString().slice(0, 10);

        const { data: pendingPlan } = await supabase
          .from("follow_up_plans")
          .select("id")
          .eq("patient_user_id", user.id)
          .eq("status", "pending")
          .gte("suggested_date", windowStartStr)
          .lte("suggested_date", windowEndStr)
          .order("suggested_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (pendingPlan) {
          await supabase
            .from("follow_up_plans")
            .update({
              status: "booked",
              linked_booking_id: calResult.eventId,
            })
            .eq("id", pendingPlan.id);

          console.log(
            `[chat/booking/create] Linked follow_up_plan ${pendingPlan.id} to booking ${calResult.eventId}`
          );
        }
      } catch (followUpError) {
        // Non-critical -- don't fail the booking
        console.error(
          "[chat/booking/create] Follow-up link error:",
          followUpError
        );
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: calResult.eventId,
    });
  } catch (error: unknown) {
    console.error("[chat/booking/create] Error:", error);
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
