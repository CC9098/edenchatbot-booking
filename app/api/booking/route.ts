
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fromZonedTime } from 'date-fns-tz';
import { createBooking } from '@/lib/google-calendar';
import { sendBookingConfirmationEmail } from '@/lib/gmail';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { bookingSchema } from '@/shared/types';
import { getEvent, deleteEvent, updateEvent } from '@/lib/google-calendar';
import { getClinicAddress } from '@/shared/clinic-data';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

// Schema for rescheduling
const rescheduleSchema = z.object({
                eventId: z.string(),
                calendarId: z.string(),
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                time: z.string().regex(/^\d{2}:\d{2}$/),
                durationMinutes: z.number().int().positive().default(15),
});

export async function POST(request: NextRequest) {
                try {
                                const body = await request.json();
                                const bookingData = bookingSchema.parse(body);

                                // Get Calendar ID
                                // Note: We duplicate getMappingWithFallback here to avoid circular imports if extracted incorrectly,
                                // but in a real refactor, this helper should be in lib/booking-helpers.ts
                                // For now, let's inline a quick lookup or just rely on static config if DB fails
                                // Use robust helper that handles DB errors
                                let calendarId = "";
                                // Use robust helper that handles DB errors
                                const mapping = await getMappingWithFallback(bookingData.doctorId, bookingData.clinicId);
                                if (mapping && mapping.isActive) {
                                                calendarId = mapping.calendarId;
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

                                // Create Google Calendar Event
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
                                                notes: bookingData.notes
                                });

                                if (!calResult.success || !calResult.eventId) {
                                                console.error('Calendar creation failed:', calResult.error);
                                                return NextResponse.json({ error: 'Failed to create booking in calendar' }, { status: 500 });
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
                                                                console.error('Email sending failed:', emailError);
                                                                // We don't fail the request if email fails, but log it
                                                }
                                }

                                return NextResponse.json({ success: true, bookingId: calResult.eventId });

                } catch (error) {
                                console.error('Booking API Error:', error);
                                if (error instanceof z.ZodError) {
                                                return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
                                }
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

                const result = await deleteEvent(calendarId, eventId);

                if (!result.success) {
                                return NextResponse.json({ error: result.error || 'Failed to cancel booking' }, { status: 500 });
                }

                return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
                try {
                                const body = await request.json();
                                const { eventId, calendarId, date, time, durationMinutes } = rescheduleSchema.parse(body);

                                // Calculate start and end times
                                const startDate = fromZonedTime(
                                                `${date}T${time}:00`,
                                                HONG_KONG_TIMEZONE
                                );

                                if (isNaN(startDate.getTime())) {
                                                return NextResponse.json({ error: 'Invalid date/time' }, { status: 400 });
                                }

                                const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

                                const result = await updateEvent(calendarId, eventId, {
                                                startTime: startDate,
                                                endTime: endDate,
                                });

                                if (!result.success) {
                                                return NextResponse.json({ error: result.error || 'Failed to reschedule booking' }, { status: 500 });
                                }

                                return NextResponse.json({ success: true });

                } catch (error) {
                                console.error('Reschedule API Error:', error);
                                if (error instanceof z.ZodError) {
                                                return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
                                }
                                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
                }
}
