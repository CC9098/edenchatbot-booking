import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";

import {
  createPendingBookingIntake,
  type BookingGender,
  type BookingPickupType,
  type BookingReceiptType,
  type BookingVisitType,
} from "@/lib/booking-intake-storage";
import { isSlotAvailableUtc } from "@/lib/booking-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getSafeErrorMessage } from "@/lib/error-sanitizer";
import { getFreeBusy } from "@/lib/google-calendar";
import { syncPatientProfileContact } from "@/lib/profile-contact-sync";
import { getMappingWithFallback } from "@/lib/storage-helpers";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";
import {
  buildWhatsappBookingMessage,
  buildWhatsappPrefillUrl,
  getWhatsappClinicTarget,
} from "@/lib/whatsapp-booking";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

const whatsappBookingSchema = z
  .object({
    doctorId: z.string(),
    doctorName: z.string(),
    doctorNameZh: z.string(),
    clinicId: z.string(),
    clinicName: z.string(),
    clinicNameZh: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().positive().default(15),
    patientName: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email(),
    notes: z.string().optional(),
    visitType: z.enum(["first", "followup"]),
    needReceipt: z.enum(["no", "yes_insurance", "yes_not_insurance"]),
    medicationPickup: z.enum(["none", "lalamove", "sfexpress", "clinic_pickup"]),
    idCard: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    allergies: z.string().optional(),
    medications: z.string().optional(),
    symptoms: z.string().optional(),
    referralSource: z.string().optional(),
  })
  .strict();

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser().catch(() => null);
    const body = await request.json();
    const parsed = whatsappBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const bookingData = parsed.data;

    let calendarId = "";
    let whatsappTargetClinicId = bookingData.clinicId;

    if (bookingData.clinicId === "online") {
      const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
        doctorId: bookingData.doctorId,
        requestedDate: bookingData.date,
        time: bookingData.time,
        durationMinutes: bookingData.durationMinutes,
      });

      if (resolvedOnlineMapping.errorCode === "CALENDAR_UNAVAILABLE") {
        return NextResponse.json(
          {
            error: "暫時未能讀取預約日曆，請稍後再試或聯絡診所。",
            errorCode: "CALENDAR_UNAVAILABLE",
          },
          { status: 503 },
        );
      }

      if (!resolvedOnlineMapping.mapping) {
        return NextResponse.json(
          { error: "這個時段剛剛已滿，請選擇其他時段。" },
          { status: 409 },
        );
      }

      calendarId = resolvedOnlineMapping.mapping.calendarId;
      whatsappTargetClinicId = resolvedOnlineMapping.mapping.clinicId;
    } else {
      const mapping = await getMappingWithFallback(bookingData.doctorId, bookingData.clinicId);
      if (mapping?.isActive) {
        calendarId = mapping.calendarId;
      }
    }

    if (!calendarId) {
      return NextResponse.json({ error: "Doctor schedule not found" }, { status: 404 });
    }

    const whatsappTarget = getWhatsappClinicTarget(whatsappTargetClinicId);
    if (!whatsappTarget) {
      return NextResponse.json(
        { error: "暫時未能準備 WhatsApp 連結，請直接聯絡診所。" },
        { status: 503 },
      );
    }

    const startDate = fromZonedTime(
      `${bookingData.date}T${bookingData.time}:00`,
      HONG_KONG_TIMEZONE,
    );

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }

    const endDate = new Date(startDate.getTime() + bookingData.durationMinutes * 60000);

    try {
      const requestedDayUtc = fromZonedTime(
        `${bookingData.date}T00:00:00`,
        HONG_KONG_TIMEZONE,
      );
      const busySlots = await getFreeBusy(calendarId, requestedDayUtc);
      const isStillAvailable = isSlotAvailableUtc(startDate, endDate, busySlots);

      if (!isStillAvailable) {
        return NextResponse.json(
          { error: "這個時段剛剛已滿，請選擇其他時段。" },
          { status: 409 },
        );
      }
    } catch (calendarError) {
      console.error(
        `[booking-whatsapp] Calendar availability re-check failed: ${getSafeErrorMessage(calendarError)}`,
      );
      return NextResponse.json(
        {
          error: "暫時未能讀取預約日曆，請稍後再試或聯絡診所。",
          errorCode: "CALENDAR_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    const profileSync = await syncPatientProfileContact({
      userId: user?.id,
      displayName: bookingData.patientName,
      phone: bookingData.phone,
    });
    if (!profileSync.success) {
      console.warn(`[booking-whatsapp] profile sync warning: ${profileSync.error}`);
    }

    const intakeResult = await createPendingBookingIntake({
      source: "booking_whatsapp_page",
      userId: user?.id,
      doctorId: bookingData.doctorId,
      doctorNameZh: bookingData.doctorNameZh,
      clinicId: bookingData.clinicId,
      clinicNameZh: bookingData.clinicNameZh,
      appointmentDate: bookingData.date,
      appointmentTime: bookingData.time,
      durationMinutes: bookingData.durationMinutes,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      visitType: bookingData.visitType as BookingVisitType,
      needReceipt: bookingData.needReceipt as BookingReceiptType,
      medicationPickup: bookingData.medicationPickup as BookingPickupType,
      idCard: normalizeOptionalString(bookingData.idCard),
      dob: normalizeOptionalString(bookingData.dateOfBirth),
      gender: bookingData.gender as BookingGender | undefined,
      allergies: normalizeOptionalString(bookingData.allergies),
      medications: normalizeOptionalString(bookingData.medications),
      symptoms: normalizeOptionalString(bookingData.symptoms),
      referralSource: normalizeOptionalString(bookingData.referralSource),
      notes: normalizeOptionalString(bookingData.notes),
      bookingPayload: {
        ...bookingData,
        whatsappTargetClinicId: whatsappTarget.clinicId,
        whatsappTargetClinicNameZh: whatsappTarget.clinicNameZh,
      },
    });

    if (!intakeResult.success) {
      console.error(`[booking-whatsapp] booking_intake warning: ${intakeResult.error}`);
    }

    const whatsappMessage = buildWhatsappBookingMessage({
      intakeId: intakeResult.intakeId,
      doctorNameZh: bookingData.doctorNameZh,
      clinicNameZh: bookingData.clinicNameZh,
      appointmentDate: bookingData.date,
      appointmentTime: bookingData.time,
      visitType: bookingData.visitType as BookingVisitType,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      needReceipt: bookingData.needReceipt as BookingReceiptType,
      medicationPickup: bookingData.medicationPickup as BookingPickupType,
      idCard: normalizeOptionalString(bookingData.idCard),
      dateOfBirth: normalizeOptionalString(bookingData.dateOfBirth),
      gender: bookingData.gender as BookingGender | undefined,
      allergies: normalizeOptionalString(bookingData.allergies),
      medications: normalizeOptionalString(bookingData.medications),
      symptoms: normalizeOptionalString(bookingData.symptoms),
      referralSource: normalizeOptionalString(bookingData.referralSource),
      notes: normalizeOptionalString(bookingData.notes),
    });

    return NextResponse.json({
      success: true,
      intakeId: intakeResult.intakeId || "",
      intakeSaved: intakeResult.success,
      whatsappUrl: buildWhatsappPrefillUrl(whatsappTarget.whatsappUrl, whatsappMessage),
      whatsappLabel: `${whatsappTarget.clinicNameZh}診所姑娘`,
    });
  } catch (error) {
    console.error(`[booking-whatsapp] Error: ${getSafeErrorMessage(error)}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
