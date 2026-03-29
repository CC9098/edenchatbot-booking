import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';

import { getCurrentUser } from '@/lib/auth-helpers';
import { isSlotAvailableUtc } from '@/lib/booking-helpers';
import {
  createPendingBookingIntake,
  markBookingIntakeConfirmed,
  markBookingIntakeFailed,
  type BookingGender,
  type BookingPickupType,
  type BookingReceiptType,
  type BookingVisitType,
} from '@/lib/booking-intake-storage';
import { sendBookingConfirmationWhatsapp } from '@/lib/chatwoot-whatsapp';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import { createBooking, getFreeBusy } from '@/lib/google-calendar';
import { syncPatientProfileContact } from '@/lib/profile-contact-sync';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { resolveOnlineSourceMappingForSlot } from '@/lib/virtual-online-booking';
import { createManageAccessToken } from '@/lib/widget-booking-management';
import { bookingSchema } from '@/shared/types';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

const whatsappBookingSchema = bookingSchema
  .extend({
    visitType: z.enum(['first', 'followup']),
    needReceipt: z.enum(['no', 'yes_insurance', 'yes_not_insurance']),
    medicationPickup: z.enum(['none', 'lalamove', 'sfexpress', 'clinic_pickup']),
    idCard: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    allergies: z.string().optional(),
    medications: z.string().optional(),
    symptoms: z.string().optional(),
    referralSource: z.string().optional(),
  })
  .strict();

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export async function POST(request: NextRequest) {
  let intakeId: string | undefined;

  try {
    const user = await getCurrentUser().catch(() => null);
    const body = await request.json();
    const parsed = whatsappBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: formatZodIssues(parsed.error) },
        { status: 400 },
      );
    }

    const bookingData = parsed.data;

    let calendarId = '';
    let notificationClinicId = bookingData.clinicId;

    if (bookingData.clinicId === 'online') {
      const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
        doctorId: bookingData.doctorId,
        requestedDate: bookingData.date,
        time: bookingData.time,
        durationMinutes: bookingData.durationMinutes,
      });

      if (resolvedOnlineMapping.errorCode === 'CALENDAR_UNAVAILABLE') {
        return NextResponse.json(
          {
            error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
            errorCode: 'CALENDAR_UNAVAILABLE',
          },
          { status: 503 },
        );
      }

      if (!resolvedOnlineMapping.mapping) {
        return NextResponse.json(
          { error: '這個時段剛剛已滿，請選擇其他時段。' },
          { status: 409 },
        );
      }

      calendarId = resolvedOnlineMapping.mapping.calendarId;
      notificationClinicId = resolvedOnlineMapping.mapping.clinicId;
    } else {
      const mapping = await getMappingWithFallback(bookingData.doctorId, bookingData.clinicId);
      if (mapping?.isActive) {
        calendarId = mapping.calendarId;
      }
    }

    if (!calendarId) {
      return NextResponse.json({ error: 'Doctor schedule not found' }, { status: 404 });
    }

    const startDate = fromZonedTime(
      `${bookingData.date}T${bookingData.time}:00`,
      HONG_KONG_TIMEZONE,
    );

    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
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
          { error: '這個時段剛剛已滿，請選擇其他時段。' },
          { status: 409 },
        );
      }
    } catch (calendarError) {
      console.error(
        `[booking-whatsapp] Calendar availability re-check failed: ${getSafeErrorMessage(calendarError)}`,
      );
      return NextResponse.json(
        {
          error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
          errorCode: 'CALENDAR_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    const intakeResult = await createPendingBookingIntake({
      source: 'booking_whatsapp_page',
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
        channel: 'whatsapp_confirmation',
        notificationClinicId,
      },
    });

    intakeId = intakeResult.intakeId;
    if (!intakeResult.success) {
      console.error(`[booking-whatsapp] booking_intake warning: ${intakeResult.error}`);
    }

    const calResult = await createBooking(calendarId, {
      doctorId: bookingData.doctorId,
      doctorName: bookingData.doctorName,
      doctorNameZh: bookingData.doctorNameZh,
      clinicId: bookingData.clinicId,
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
      if (intakeId) {
        const failedSync = await markBookingIntakeFailed({
          intakeId,
          reason: calResult.error || 'Failed to create booking in calendar',
        });
        if (!failedSync.success) {
          console.warn(`[booking-whatsapp] booking_intake failure sync warning: ${failedSync.error}`);
        }
      }

      console.error('[booking-whatsapp] Calendar creation failed:', calResult.error);
      return NextResponse.json({ error: 'Failed to create booking in calendar' }, { status: 500 });
    }

    const profileSync = await syncPatientProfileContact({
      userId: user?.id,
      displayName: bookingData.patientName,
      phone: bookingData.phone,
    });
    if (!profileSync.success) {
      console.warn(`[booking-whatsapp] profile sync warning: ${profileSync.error}`);
    }

    if (intakeId) {
      const confirmSync = await markBookingIntakeConfirmed({
        intakeId,
        googleEventId: calResult.eventId,
        calendarId,
      });
      if (!confirmSync.success) {
        console.warn(`[booking-whatsapp] booking_intake confirm sync warning: ${confirmSync.error}`);
      }
    }

    // Generate a manage access token so the patient can manage bookings
    // directly from the WhatsApp confirmation link without OTP
    const phoneDigits = normalizePhoneForSearch(bookingData.phone);
    const manageAccessToken = phoneDigits ? createManageAccessToken(phoneDigits) : undefined;

    const whatsappResult = await sendBookingConfirmationWhatsapp({
      bookingId: calResult.eventId,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      doctorNameZh: bookingData.doctorNameZh,
      clinicNameZh: bookingData.clinicNameZh,
      appointmentDate: bookingData.date,
      appointmentTime: bookingData.time,
      visitType: bookingData.visitType as BookingVisitType,
      clinicWhatsappPhone: getClinicWhatsappPhone(notificationClinicId),
      manageAccessToken,
    });

    if (!whatsappResult.success) {
      console.error(
        `[booking-whatsapp] Chatwoot WhatsApp warning: ${whatsappResult.error || 'Unknown error'}`,
      );
    }

    return NextResponse.json({
      success: true,
      bookingId: calResult.eventId,
      intakeId: intakeId || '',
      intakeSaved: intakeResult.success,
      whatsappSent: whatsappResult.success,
      whatsappConversationId: whatsappResult.conversationId,
    });
  } catch (error) {
    if (intakeId) {
      const failedSync = await markBookingIntakeFailed({
        intakeId,
        reason: getSafeErrorMessage(error),
      });
      if (!failedSync.success) {
        console.warn(`[booking-whatsapp] booking_intake exception sync warning: ${failedSync.error}`);
      }
    }

    console.error(`[booking-whatsapp] Error: ${getSafeErrorMessage(error)}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
