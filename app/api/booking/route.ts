
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { createBooking, getFreeBusy, getEvent, deleteEvent, moveEventToCalendar, updateEvent } from '@/lib/google-calendar';
import { sendBookingCancellationEmail, sendBookingConfirmationEmail } from '@/lib/gmail';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { bookingSchema } from '@/shared/types';
import { CLINIC_ID_BY_NAME_ZH, DOCTOR_ID_BY_NAME_ZH, getClinicAddress } from '@/shared/clinic-data';
import { isSlotAvailableUtc } from '@/lib/booking-helpers';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import { getCurrentUser } from '@/lib/auth-helpers';
import { syncPatientProfileContact } from '@/lib/profile-contact-sync';
import {
                markBookingIntakeCancelledByEvent,
                markBookingIntakeRescheduledByEvent,
} from '@/lib/booking-intake-storage';
import { resolveOnlineSourceMappingForSlot } from '@/lib/virtual-online-booking';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

function formatZodIssues(error: z.ZodError) {
                return error.issues.map((issue) => ({
                                code: issue.code,
                                path: issue.path.join('.'),
                                message: issue.message,
                }));
}

function formatUnknownError(error: unknown): string {
                if (error instanceof Error) {
                                return `${error.name}: ${error.message}`;
                }
                return String(error);
}

function parseLineValue(description: string, label: string): string {
                const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
                return match?.[1]?.trim() || '';
}

function extractBookingEmailMetadata(event: any) {
                const description = typeof event?.description === 'string' ? event.description : '';
                const summary = typeof event?.summary === 'string' ? event.summary : '';

                const patientName =
                                parseLineValue(description, 'Patient / 病人') ||
                                summary.split(' - ').slice(1).join(' - ').trim();
                const patientEmail = parseLineValue(description, 'Email / 電郵');

                const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
                const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);

                const doctorNameZh = doctorMatch?.[1]?.trim() || '';
                const doctorName = doctorMatch?.[2]?.trim() || doctorNameZh;
                const clinicNameZh = clinicMatch?.[1]?.trim() || '';
                const clinicName = clinicMatch?.[2]?.trim() || clinicNameZh;

                if (!patientName || !patientEmail || !doctorNameZh || !clinicNameZh) {
                                return null;
                }

                const clinicId = CLINIC_ID_BY_NAME_ZH[clinicNameZh];
                const clinicAddress = clinicId ? getClinicAddress(clinicId) : '';

                return {
                                patientName,
                                patientEmail,
                                doctorName,
                                doctorNameZh,
                                clinicName,
                                clinicNameZh,
                                clinicAddress,
                };
}

function extractBookingIdentity(event: any) {
                const metadata = extractBookingEmailMetadata(event);
                if (!metadata) {
                                return null;
                }

                const doctorId = DOCTOR_ID_BY_NAME_ZH[metadata.doctorNameZh];
                const clinicId = CLINIC_ID_BY_NAME_ZH[metadata.clinicNameZh];
                if (!doctorId || !clinicId) {
                                return null;
                }

                return {
                                doctorId,
                                clinicId,
                };
}

function buildRescheduleEmailPayload(
                event: any,
                date: string,
                time: string,
                eventId: string,
                calendarId: string
) {
                const metadata = extractBookingEmailMetadata(event);
                if (!metadata) {
                                return null;
                }

                return {
                                ...metadata,
                                date,
                                time,
                                eventId,
                                calendarId,
                };
}

function buildCancellationEmailPayload(event: any) {
                const metadata = extractBookingEmailMetadata(event);
                if (!metadata) {
                                return null;
                }

                const startDateTime = event?.start?.dateTime;
                const startDate = event?.start?.date;

                if (typeof startDateTime === 'string') {
                                const start = new Date(startDateTime);
                                if (Number.isNaN(start.getTime())) {
                                                return null;
                                }
                                return {
                                                ...metadata,
                                                date: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'yyyy-MM-dd'),
                                                time: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'HH:mm'),
                                };
                }

                if (typeof startDate === 'string') {
                                return {
                                                ...metadata,
                                                date: startDate,
                                                time: '00:00',
                                };
                }

                return null;
}

// Schema for rescheduling
const rescheduleSchema = z.object({
                eventId: z.string(),
                calendarId: z.string(),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                time: z.string().regex(/^\d{2}:\d{2}$/),
                durationMinutes: z.number().int().positive().default(15),
                doctorId: z.string().optional(),
                clinicId: z.string().optional(),
});

export async function POST(request: NextRequest) {
                try {
                                const user = await getCurrentUser().catch(() => null);
                                const body = await request.json();
                                const parsed = bookingSchema.safeParse(body);
                                if (!parsed.success) {
                                                return NextResponse.json(
                                                                { error: 'Invalid input', details: formatZodIssues(parsed.error) },
                                                                { status: 400 }
                                                );
                                }
                                const bookingData = parsed.data;

                                // Get Calendar ID
                                // Note: We duplicate getMappingWithFallback here to avoid circular imports if extracted incorrectly,
                                // but in a real refactor, this helper should be in lib/booking-helpers.ts
                                // For now, let's inline a quick lookup or just rely on static config if DB fails
                                // Use robust helper that handles DB errors
                                let calendarId = "";
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
                                                                                { status: 503 }
                                                                );
                                                }

                                                if (!resolvedOnlineMapping.mapping) {
                                                                return NextResponse.json(
                                                                                { error: 'This time slot has just been booked. Please pick another time.' },
                                                                                { status: 409 }
                                                                );
                                                }

                                                calendarId = resolvedOnlineMapping.mapping.calendarId;
                                } else {
                                                const mapping = await getMappingWithFallback(bookingData.doctorId, bookingData.clinicId);
                                                if (mapping && mapping.isActive) {
                                                                calendarId = mapping.calendarId;
                                                }
                                }

                                if (!calendarId) {
                                                return NextResponse.json({ error: 'Doctor schedule not found' }, { status: 404 });
                                }

                                // Calculate start and end times
                                const startDate = fromZonedTime(
                                                `${bookingData.date}T${bookingData.time}:00`,
                                                HONG_KONG_TIMEZONE
                                );

                                // Check if valid date
                                if (isNaN(startDate.getTime())) {
                                                return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
                                }

                                const endDate = new Date(startDate.getTime() + bookingData.durationMinutes * 60000);

                                // Re-check Google Calendar right before creating the event
                                // to prevent race conditions / double booking.
                                try {
                                                const requestedDayUtc = fromZonedTime(`${bookingData.date}T00:00:00`, HONG_KONG_TIMEZONE);
                                                const busySlots = await getFreeBusy(calendarId, requestedDayUtc);
                                                const isStillAvailable = isSlotAvailableUtc(startDate, endDate, busySlots);

                                                if (!isStillAvailable) {
                                                                return NextResponse.json(
                                                                                { error: 'This time slot has just been booked. Please pick another time.' },
                                                                                { status: 409 }
                                                                );
                                                }
                                } catch (calError) {
                                                console.error(
                                                                `Calendar availability re-check failed: ${getSafeErrorMessage(calError)}`
                                                );
                                                return NextResponse.json(
                                                                {
                                                                                error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
                                                                                errorCode: 'CALENDAR_UNAVAILABLE',
                                                                },
                                                                { status: 503 }
                                                );
                                }

                                // Create Google Calendar Event
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
                                                notes: bookingData.notes
                                });

                                if (!calResult.success || !calResult.eventId) {
                                                console.error('Calendar creation failed:', calResult.error);
                                                return NextResponse.json({ error: 'Failed to create booking in calendar' }, { status: 500 });
                                }

                                const profileSync = await syncPatientProfileContact({
                                                userId: user?.id,
                                                displayName: bookingData.patientName,
                                                phone: bookingData.phone,
                                });
                                if (!profileSync.success) {
                                                console.warn(`booking profile sync warning: ${profileSync.error}`);
                                }

                                // Send Confirmation Email (Async - fire and forget)
                                // In serverless functions (like Vercel), we should ideally await this or use background jobs.
                                // For simplicity in this demo, we await it to ensure it sends.
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
                                                                                calendarId: calendarId
                                                                });
                                                } catch (emailError) {
                                                                console.error(`Email sending failed: ${getSafeErrorMessage(emailError)}`);
                                                                // We don't fail the request if email fails, but log it
                                                }
                                }

                                return NextResponse.json({ success: true, bookingId: calResult.eventId });

                } catch (error) {
                                console.error(`Booking API Error: ${formatUnknownError(error)}`);
                                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
                }
}


export async function GET(request: NextRequest) {
                const { searchParams } = new URL(request.url);
                const eventId = searchParams.get('eventId');
                const calendarId = searchParams.get('calendarId');

                if (!eventId || !calendarId) {
                                return NextResponse.json({ error: 'Missing eventId or calendarId' }, { status: 400 });
                }

                const result = await getEvent(calendarId, eventId);

                if (!result.success || !result.event) {
                                return NextResponse.json({ error: result.error || 'Booking not found' }, { status: 404 });
                }

                return NextResponse.json(result.event);
}

export async function DELETE(request: NextRequest) {
                const { searchParams } = new URL(request.url);
                const eventId = searchParams.get('eventId');
                const calendarId = searchParams.get('calendarId');

                if (!eventId || !calendarId) {
                                return NextResponse.json({ error: 'Missing eventId or calendarId' }, { status: 400 });
                }

                let existingEvent: any = null;
                const existingEventResult = await getEvent(calendarId, eventId);
                if (existingEventResult.success && existingEventResult.event) {
                                existingEvent = existingEventResult.event;
                }

                const result = await deleteEvent(calendarId, eventId);

                if (!result.success) {
                                return NextResponse.json({ error: result.error || 'Failed to cancel booking' }, { status: 500 });
                }

                const intakeCancelSync = await markBookingIntakeCancelledByEvent({
                                googleEventId: eventId,
                                calendarId,
                });
                if (!intakeCancelSync.success) {
                                console.warn(`booking_intake cancel sync warning: ${intakeCancelSync.error}`);
                }

                if (existingEvent) {
                                const payload = buildCancellationEmailPayload(existingEvent);
                                if (payload) {
                                                try {
                                                                await sendBookingCancellationEmail(payload);
                                                } catch (emailError) {
                                                                console.error(`Cancellation email sending failed: ${formatUnknownError(emailError)}`);
                                                }
                                } else {
                                                console.warn('Skip cancellation email: failed to parse event metadata for recipient/details.');
                                }
                } else {
                                console.warn('Skip cancellation email: original event lookup failed before delete.');
                }

                return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
                try {
                                const body = await request.json();
                                const parsed = rescheduleSchema.safeParse(body);
                                if (!parsed.success) {
                                                return NextResponse.json(
                                                                { error: 'Invalid input', details: formatZodIssues(parsed.error) },
                                                                { status: 400 }
                                                );
                                }
                                const { eventId, calendarId, date, time, durationMinutes, doctorId, clinicId } = parsed.data;

                                let existingEvent: any = null;
                                const existingEventResult = await getEvent(calendarId, eventId);
                                if (existingEventResult.success && existingEventResult.event) {
                                                existingEvent = existingEventResult.event;
                                }

                                // Calculate start and end times
                                const startDate = fromZonedTime(
                                                `${date}T${time}:00`,
                                                HONG_KONG_TIMEZONE
                                );

                                if (isNaN(startDate.getTime())) {
                                                return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
                                }

                                const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

                                const existingIdentity = existingEvent ? extractBookingIdentity(existingEvent) : null;
                                const effectiveDoctorId = doctorId || existingIdentity?.doctorId;
                                const effectiveClinicId = clinicId || existingIdentity?.clinicId;

                                let nextEventId = eventId;
                                let nextCalendarId = calendarId;
                                let result:
                                                | { success: true; eventId?: string }
                                                | { success: false; error?: string };

                                if (effectiveDoctorId && effectiveClinicId === 'online') {
                                                const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
                                                                doctorId: effectiveDoctorId,
                                                                requestedDate: date,
                                                                time,
                                                                durationMinutes,
                                                                preferredCalendarId: calendarId,
                                                });

                                                if (resolvedOnlineMapping.errorCode === 'CALENDAR_UNAVAILABLE') {
                                                                return NextResponse.json(
                                                                                {
                                                                                                error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
                                                                                                errorCode: 'CALENDAR_UNAVAILABLE',
                                                                                },
                                                                                { status: 503 }
                                                                );
                                                }

                                                if (!resolvedOnlineMapping.mapping) {
                                                                return NextResponse.json(
                                                                                { error: 'This time slot has just been booked. Please pick another time.' },
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
                                                return NextResponse.json({ error: result.error || 'Failed to reschedule booking' }, { status: 500 });
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
                                                console.warn(`booking_intake reschedule sync warning: ${intakeRescheduleSync.error}`);
                                }

                                // Best effort: send updated confirmation email after reschedule succeeds.
                                if (existingEvent) {
                                                const payload = buildRescheduleEmailPayload(
                                                                existingEvent,
                                                                date,
                                                                time,
                                                                nextEventId,
                                                                nextCalendarId
                                                );
                                                if (payload) {
                                                                try {
                                                                                await sendBookingConfirmationEmail(payload);
                                                                } catch (emailError) {
                                                                                console.error(`Reschedule email sending failed: ${formatUnknownError(emailError)}`);
                                                                }
                                                } else {
                                                                console.warn('Skip reschedule email: failed to parse event metadata for recipient/details.');
                                                }
                                } else {
                                                console.warn('Skip reschedule email: original event lookup failed before update.');
                                }

                                return NextResponse.json({
                                                success: true,
                                                bookingId: nextEventId,
                                                calendarId: nextCalendarId,
                                });

                } catch (error) {
                                console.error(`Reschedule API Error: ${formatUnknownError(error)}`);
                                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
                }
}
