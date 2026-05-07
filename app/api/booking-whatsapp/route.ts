import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';

import { getCurrentUser } from '@/lib/auth-helpers';
import {
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotAvailableUtc,
} from '@/lib/booking-helpers';
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
import { normalizePhoneForSearch, toHKE164 } from '@/lib/contact-utils';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import { sendDoctorOnlineBookingNotificationEmail } from '@/lib/gmail';
import { ensureSupabaseUserForPhone } from '@/lib/whatsapp-auth-bridge';
import { createBooking, getFreeBusy } from '@/lib/google-calendar';
import { createServiceClient } from '@/lib/supabase';
import { syncPatientProfileContact } from '@/lib/profile-contact-sync';
import { getDoctorBookingSlotMinutes } from '@/shared/clinic-data';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { resolveOnlineSourceMappingForSlot } from '@/lib/virtual-online-booking';
import { createManageAccessToken } from '@/lib/widget-booking-management';
import { detailedBookingSchema } from '@/shared/booking-intake-schema';
import { findGroupBookingSession, getGroupBookingNotice } from '@/lib/group-booking-policy';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

const whatsappBookingSchema = detailedBookingSchema;

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
    const durationMinutes = getDoctorBookingSlotMinutes(
      bookingData.doctorId,
      bookingData.visitType,
    );
    const groupBookingSession = findGroupBookingSession({
      doctorId: bookingData.doctorId,
      clinicId: bookingData.clinicId,
      date: bookingData.date,
      time: bookingData.time,
    });
    const groupBookingNotice = groupBookingSession
      ? getGroupBookingNotice(bookingData.doctorId, bookingData.clinicId)
      : null;

    let calendarId = '';
    let notificationClinicId = bookingData.clinicId;

    if (bookingData.clinicId === 'online') {
      const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
        doctorId: bookingData.doctorId,
        requestedDate: bookingData.date,
        time: bookingData.time,
        durationMinutes,
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
      const mapping = await getMappingWithFallback(
        bookingData.doctorId,
        bookingData.clinicId,
        bookingData.date
      );
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

    if (bookingData.clinicId !== 'online' && isSlotAfterClinicLastBookingCutoffUtc(startDate, bookingData.clinicId)) {
      return NextResponse.json(
        { error: '已超過此分店最後預約時間，請選擇較早時段。' },
        { status: 409 },
      );
    }

    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

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

    // ------------------------------------------------------------------
    // Silent user provisioning: if the patient is not logged in but has a
    // phone number, ensure a Supabase auth user exists so future OTP logins
    // automatically surface this booking. Failures are non-fatal.
    // ------------------------------------------------------------------
    let effectiveUserId: string | undefined = user?.id;
    if (!effectiveUserId && bookingData.phone) {
      try {
        const phoneDigitsForBridge = normalizePhoneForSearch(bookingData.phone);
        const phoneE164ForBridge = toHKE164(bookingData.phone);
        if (phoneDigitsForBridge && phoneE164ForBridge) {
          const bridgeResult = await ensureSupabaseUserForPhone({
            phoneDigits: phoneDigitsForBridge,
            phoneE164: phoneE164ForBridge,
            displayNameHint: bookingData.patientName,
          });
          if (bridgeResult.error) {
            console.warn(`[booking-whatsapp] silent provisioning warning: ${bridgeResult.error}`);
          } else {
            effectiveUserId = bridgeResult.userId;
          }
        }
      } catch (bridgeErr) {
        console.warn(`[booking-whatsapp] silent provisioning unexpected error: ${bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr)}`);
      }
    }

    // ------------------------------------------------------------------
    // Patient profile ownership check: if a patientProfileId is supplied,
    // verify it belongs to the effective user. A mismatch is a client error
    // rather than a silent drop so callers can surface the issue to users.
    // ------------------------------------------------------------------
    let validatedPatientProfileId: string | undefined;
    if (bookingData.patientProfileId) {
      if (!effectiveUserId) {
        return NextResponse.json(
          { error: '請先登入才能使用家庭成員功能。' },
          { status: 401 },
        );
      }
      try {
        const adminClient = createServiceClient();
        const { data: profileRow, error: profileErr } = await adminClient
          .from('patient_profiles')
          .select('id, user_id')
          .eq('id', bookingData.patientProfileId)
          .maybeSingle();
        if (profileErr) {
          console.warn(`[booking-whatsapp] patient_profiles lookup warning: ${profileErr.message}`);
        } else if (profileRow && profileRow.user_id === effectiveUserId) {
          validatedPatientProfileId = profileRow.id;
        } else {
          return NextResponse.json(
            { error: '無法核對所選家庭成員，請重新選擇。' },
            { status: 403 },
          );
        }
      } catch (profileCheckErr) {
        console.warn(`[booking-whatsapp] patient_profiles check error: ${profileCheckErr instanceof Error ? profileCheckErr.message : String(profileCheckErr)}`);
      }
    }

    const intakeResult = await createPendingBookingIntake({
      source: 'booking_whatsapp_page',
      userId: effectiveUserId,
      patientProfileId: validatedPatientProfileId,
      doctorId: bookingData.doctorId,
      doctorNameZh: bookingData.doctorNameZh,
      clinicId: bookingData.clinicId,
      clinicNameZh: bookingData.clinicNameZh,
      appointmentDate: bookingData.date,
      appointmentTime: bookingData.time,
      durationMinutes,
      patientName: bookingData.patientName,
      phone: bookingData.phone,
      email: bookingData.email,
      visitType: bookingData.visitType as BookingVisitType,
      needReceipt: bookingData.needReceipt as BookingReceiptType,
      medicationPickup: bookingData.medicationPickup as BookingPickupType,
      dob: normalizeOptionalString(bookingData.dateOfBirth),
      gender: bookingData.gender as BookingGender | undefined,
      allergies: normalizeOptionalString(bookingData.allergies),
      medications: normalizeOptionalString(bookingData.medications),
      symptoms: normalizeOptionalString(bookingData.symptoms),
      referralSource: normalizeOptionalString(bookingData.referralSource),
      notes: normalizeOptionalString(bookingData.notes),
      bookingPayload: {
        ...bookingData,
        durationMinutes,
        channel: 'whatsapp_confirmation',
        notificationClinicId,
        ...(groupBookingSession
          ? {
              groupBooking: {
                minPatients: groupBookingSession.policy.minPatients,
                cancelHoursBeforeStart: groupBookingSession.policy.cancelHoursBeforeStart,
                sessionStart: groupBookingSession.start,
                sessionEnd: groupBookingSession.end,
              },
            }
          : {}),
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
      userId: effectiveUserId,
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
      meetLink: calResult.meetLink,
      clinicWhatsappPhone: getClinicWhatsappPhone(notificationClinicId),
      manageAccessToken,
      groupBookingNotice: groupBookingNotice || undefined,
    });

    if (!whatsappResult.success) {
      console.error(
        `[booking-whatsapp] Chatwoot WhatsApp warning: ${whatsappResult.error || 'Unknown error'}`,
      );
    }

    if (calResult.meetLink) {
      try {
        const doctorEmailResult = await sendDoctorOnlineBookingNotificationEmail({
          bookingId: calResult.eventId,
          calendarId,
          doctorId: bookingData.doctorId,
          doctorName: bookingData.doctorName,
          doctorNameZh: bookingData.doctorNameZh,
          patientName: bookingData.patientName,
          patientPhone: bookingData.phone,
          patientEmail: bookingData.email,
          date: bookingData.date,
          time: bookingData.time,
          durationMinutes,
          meetLink: calResult.meetLink,
        });
        if (!doctorEmailResult.success) {
          console.warn(`[booking-whatsapp] Doctor online booking notification warning: ${doctorEmailResult.error}`);
        }
      } catch (doctorEmailError) {
        console.error(
          `[booking-whatsapp] Doctor online booking notification failed: ${getSafeErrorMessage(doctorEmailError)}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: calResult.eventId,
      intakeId: intakeId || '',
      intakeSaved: intakeResult.success,
      whatsappSent: whatsappResult.success,
      whatsappConversationId: whatsappResult.conversationId,
      meetLink: calResult.meetLink,
      groupBookingNotice: groupBookingNotice || undefined,
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
