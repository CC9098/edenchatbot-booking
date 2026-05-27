import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';

import { getCurrentUser, requirePatientAccess, requireStaffRole, AuthError } from '@/lib/auth-helpers';
import {
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotAvailableUtc,
  isSlotBlockedBySameDayEveningCutoffUtc,
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
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import {
  sendBookingConfirmationEmail,
  sendDoctorOnlineBookingNotificationEmail,
} from '@/lib/gmail';
import { createBooking, getFreeBusy } from '@/lib/google-calendar';
import { syncPatientProfileContact } from '@/lib/profile-contact-sync';
import { createServiceClient } from '@/lib/supabase';
import {
  getClinicAddress,
  getDoctorBookingSlotMinutes,
} from '@/shared/clinic-data';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { resolveOnlineSourceMappingForSlot } from '@/lib/virtual-online-booking';
import { createManageAccessToken } from '@/lib/widget-booking-management';
import { detailedBookingSchema } from '@/shared/booking-intake-schema';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

const staffBookingSchema = detailedBookingSchema.extend({
  patientUserId: z.string().uuid().optional(),
});

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const body = await request.json();
    const parsed = staffBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: formatZodIssues(parsed.error) },
        { status: 400 },
      );
    }

    const bookingData = parsed.data;
    if (bookingData.patientUserId) {
      await requirePatientAccess(user.id, bookingData.patientUserId);

      const supabase = createServiceClient();
      const { data: linkedStaffRole, error: linkedStaffRoleError } = await supabase
        .from('staff_roles')
        .select('user_id')
        .eq('user_id', bookingData.patientUserId)
        .eq('is_active', true)
        .maybeSingle();

      if (linkedStaffRoleError) {
        console.error('[doctor/bookings] staff identity check failed:', linkedStaffRoleError.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (linkedStaffRole?.user_id) {
        return NextResponse.json(
          {
            error: '姑娘代約只可連結病人帳戶。若要代未建檔人士落單，請改用手動輸入模式。',
          },
          { status: 409 },
        );
      }

      if (bookingData.patientProfileId) {
        const { data: linkedPatientProfile, error: linkedPatientProfileError } = await supabase
          .from('patient_profiles')
          .select('id, user_id')
          .eq('id', bookingData.patientProfileId)
          .maybeSingle();

        if (linkedPatientProfileError) {
          console.error('[doctor/bookings] patient profile check failed:', linkedPatientProfileError.message);
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }

        if (linkedPatientProfile?.user_id !== bookingData.patientUserId) {
          return NextResponse.json(
            { error: '所選病人檔案與病人帳戶不相符，請重新搜尋病人。' },
            { status: 409 },
          );
        }
      }
    } else if (bookingData.patientProfileId) {
      return NextResponse.json(
        { error: '病人檔案必須連結到病人帳戶。請重新搜尋病人或改用手動輸入。' },
        { status: 400 },
      );
    }

    const durationMinutes = getDoctorBookingSlotMinutes(
      bookingData.doctorId,
      bookingData.visitType,
    );

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

    if (isSlotBlockedBySameDayEveningCutoffUtc(startDate)) {
      return NextResponse.json(
        { error: '今日晚上時段已截止預約，請選擇其他日期或較早時段。' },
        { status: 409 },
      );
    }

    if (
      bookingData.clinicId !== 'online' &&
      isSlotAfterClinicLastBookingCutoffUtc(startDate, bookingData.clinicId)
    ) {
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
        `[doctor/bookings] Calendar availability re-check failed: ${getSafeErrorMessage(calendarError)}`,
      );
      return NextResponse.json(
        {
          error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
          errorCode: 'CALENDAR_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    intakeId = undefined;
    const intakeResult = await createPendingBookingIntake({
      source: 'staff_console',
      userId: bookingData.patientUserId,
      patientProfileId: bookingData.patientProfileId,
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
        durationMinutes,
        channel: 'staff_console',
        notificationClinicId,
        createdByStaffUserId: user.id,
        createdByStaffRole: staffRole.role,
      },
    });

    intakeId = intakeResult.intakeId;
    if (!intakeResult.success) {
      console.error(`[doctor/bookings] booking_intake warning: ${intakeResult.error}`);
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
          console.warn(`[doctor/bookings] booking_intake failure sync warning: ${failedSync.error}`);
        }
      }

      console.error('[doctor/bookings] Calendar creation failed:', calResult.error);
      return NextResponse.json({ error: 'Failed to create booking in calendar' }, { status: 500 });
    }

    if (bookingData.patientUserId && !bookingData.patientProfileId) {
      const profileSync = await syncPatientProfileContact({
        userId: bookingData.patientUserId,
        displayName: bookingData.patientName,
        phone: bookingData.phone,
      });
      if (!profileSync.success) {
        console.warn(`[doctor/bookings] profile sync warning: ${profileSync.error}`);
      }
    }

    if (intakeId) {
      const confirmSync = await markBookingIntakeConfirmed({
        intakeId,
        googleEventId: calResult.eventId,
        calendarId,
      });
      if (!confirmSync.success) {
        console.warn(`[doctor/bookings] booking_intake confirm sync warning: ${confirmSync.error}`);
      }
    }

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
    });

    if (!whatsappResult.success) {
      console.error(
        `[doctor/bookings] Chatwoot WhatsApp warning: ${whatsappResult.error || 'Unknown error'}`,
      );
    }

    let emailSent = false;
    const normalizedEmail = bookingData.email.trim().toLowerCase();
    if (normalizedEmail) {
      try {
        await sendBookingConfirmationEmail({
          patientName: bookingData.patientName,
          patientEmail: normalizedEmail,
          doctorName: bookingData.doctorName,
          doctorNameZh: bookingData.doctorNameZh,
          clinicName: bookingData.clinicName,
          clinicNameZh: bookingData.clinicNameZh,
          clinicAddress: getClinicAddress(bookingData.clinicId),
          date: bookingData.date,
          time: bookingData.time,
          durationMinutes,
          meetLink: calResult.meetLink,
          eventId: calResult.eventId,
          calendarId,
        });
        emailSent = true;
      } catch (emailError) {
        console.error(
          `[doctor/bookings] Email sending failed: ${getSafeErrorMessage(emailError)}`,
        );
      }
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
          patientEmail: normalizedEmail || bookingData.email,
          date: bookingData.date,
          time: bookingData.time,
          durationMinutes,
          meetLink: calResult.meetLink,
        });
        if (!doctorEmailResult.success) {
          console.warn(`[doctor/bookings] Doctor online booking notification warning: ${doctorEmailResult.error}`);
        }
      } catch (doctorEmailError) {
        console.error(
          `[doctor/bookings] Doctor online booking notification failed: ${getSafeErrorMessage(doctorEmailError)}`,
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
      emailSent,
      meetLink: calResult.meetLink,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (intakeId) {
      const failedSync = await markBookingIntakeFailed({
        intakeId,
        reason: getSafeErrorMessage(error),
      });
      if (!failedSync.success) {
        console.warn(`[doctor/bookings] booking_intake exception sync warning: ${failedSync.error}`);
      }
    }

    console.error(`[doctor/bookings] Error: ${getSafeErrorMessage(error)}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
