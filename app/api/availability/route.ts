
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getMappingWithFallback } from '@/lib/storage-helpers';
import { getFreeBusy } from '@/lib/google-calendar';
import { getSafeErrorMessage } from '@/lib/error-sanitizer';
import {
                getApplicableHolidaysForDate,
                getScheduleForDayFromWeekly,
                isSlotAfterClinicLastBookingCutoffUtc,
                isSlotAvailableUtc,
                isSlotBlockedByHolidaysUtc,
} from '@/lib/booking-helpers';
import { getDoctorBookingSlotMinutes } from '@/shared/clinic-data';
import { type Holiday } from '@/shared/schema';
import { getVirtualOnlineAvailability } from '@/lib/virtual-online-booking';



const availabilitySchema = z.object({
                doctorId: z.string(),
                clinicId: z.string(),
                date: z.string(), // ISO date string
                durationMinutes: z.number().default(15),
});

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

export async function POST(request: NextRequest) {
                try {
                                const body = await request.json();
                                const { doctorId, clinicId, date } = availabilitySchema.parse(body);
                                const durationMinutes = getDoctorBookingSlotMinutes(doctorId);
                                const slotIntervalMinutes = durationMinutes;
                                const requestedDate = date.slice(0, 10);
                                if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
                                                return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
                                }

                                if (clinicId === 'online') {
                                                try {
                                                                const availability = await getVirtualOnlineAvailability({
                                                                                doctorId,
                                                                                requestedDate,
                                                                                durationMinutes,
                                                                });

                                                                if (!availability.mappingFound) {
                                                                                return NextResponse.json({ error: 'Doctor not available at this clinic' }, { status: 404 });
                                                                }

                                                                if (availability.isClosed) {
                                                                                return NextResponse.json({
                                                                                                isClosed: true,
                                                                                                isHoliday: availability.isHoliday,
                                                                                                slots: [],
                                                                                });
                                                                }

                                                                return NextResponse.json({ success: true, slots: availability.slots });
                                                } catch (calError: any) {
                                                                console.error(`Calendar error: ${getSafeErrorMessage(calError)}`);
                                                                return NextResponse.json(
                                                                                {
                                                                                                error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
                                                                                                errorCode: 'CALENDAR_UNAVAILABLE',
                                                                                },
                                                                                { status: 503 }
                                                                );
                                                }
                                }

                                const mapping = await getMappingWithFallback(doctorId, clinicId);
                                if (!mapping || !mapping.isActive) {
                                                return NextResponse.json({ error: 'Doctor not available at this clinic' }, { status: 404 });
                                }

                                // Check holidays
                                let isBlocked = false;
                                let applicableHolidays: Holiday[] = [];
                                try {
                                                console.time('db-check-holidays');
                                                applicableHolidays = await getApplicableHolidaysForDate(requestedDate, doctorId, clinicId);
                                                isBlocked = applicableHolidays.some((holiday) => !holiday.startTime || !holiday.endTime);
                                                console.timeEnd('db-check-holidays');
                                } catch (error: any) {
                                                console.timeEnd('db-check-holidays');
                                                console.error('Failed to check holidays from DB, assuming open:', error);
                                                // Fail open: if DB is down, we don't block the date
                                                isBlocked = false;
                                                applicableHolidays = [];
                                }

                                if (isBlocked) {
                                                return NextResponse.json({ isClosed: true, isHoliday: true, slots: [] });
                                }

                                const requestedDayUtc = fromZonedTime(`${requestedDate}T00:00:00`, HONG_KONG_TIMEZONE);
                                const requestedDayInHk = toZonedTime(requestedDayUtc, HONG_KONG_TIMEZONE);
                                const dayOfWeek = requestedDayInHk.getDay();
                                const daySchedule = getScheduleForDayFromWeekly(mapping.schedule, dayOfWeek);

                                if (!daySchedule || daySchedule.length === 0) {
                                                return NextResponse.json({ isClosed: true, slots: [] });
                                }

                                // Get busy slots from Google Calendar
                                try {
                                                console.time('fetch-google-calendar');
                                                const busySlots = await getFreeBusy(mapping.calendarId, requestedDayUtc);
                                                console.timeEnd('fetch-google-calendar');

                                                const availableSlots: string[] = [];
                                                const nowUtc = new Date(); // Current time to prevent booking in the past

                                                // Is today?
                                                const todayInHk = formatInTimeZone(nowUtc, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
                                                const isToday = requestedDate === todayInHk;
                                                const bufferMinutes = 60; // 1 hour buffer for same-day bookings
                                                const bookingCutoffUtc = new Date(nowUtc.getTime() + bufferMinutes * 60 * 1000);

                                                for (const range of daySchedule) {
                                                                let currentSlot = fromZonedTime(`${requestedDate}T${range.start}:00`, HONG_KONG_TIMEZONE);
                                                                const endData = fromZonedTime(`${requestedDate}T${range.end}:00`, HONG_KONG_TIMEZONE);

                                                                while (currentSlot < endData) {
                                                                                // If booking for today, skip past times
                                                                                if (isToday && currentSlot < bookingCutoffUtc) {
                                                                                                currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
                                                                                                continue;
                                                                                }

                                                                                if (isSlotAfterClinicLastBookingCutoffUtc(currentSlot, clinicId)) {
                                                                                                currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
                                                                                                continue;
                                                                                }

                                                                                // Check if slot + duration fits within range end
                                                                                const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
                                                                                if (slotEnd > endData) break;

                                                                                // Check against Google Calendar busy slots + partial-day holiday blocks
                                                                                if (
                                                                                                isSlotAvailableUtc(currentSlot, slotEnd, busySlots)
                                                                                                && !isSlotBlockedByHolidaysUtc(currentSlot, slotEnd, applicableHolidays)
                                                                                ) {
                                                                                                // Format as HH:mm
                                                                                                const slotStr = formatInTimeZone(currentSlot, HONG_KONG_TIMEZONE, 'HH:mm');
                                                                                                availableSlots.push(slotStr);
                                                                                }

                                                                                currentSlot = new Date(currentSlot.getTime() + slotIntervalMinutes * 60 * 1000);
                                                                }
                                                }

                                                return NextResponse.json({ success: true, slots: availableSlots });
                                } catch (calError: any) {
                                                console.error(`Calendar error: ${getSafeErrorMessage(calError)}`);
                                                return NextResponse.json(
                                                                {
                                                                                error: '暫時未能讀取預約日曆，請稍後再試或聯絡診所。',
                                                                                errorCode: 'CALENDAR_UNAVAILABLE',
                                                                },
                                                                { status: 503 }
                                                );
                                }

                } catch (error: any) {
                                console.error('Availability API Error:', error);
                                if (error instanceof z.ZodError) {
                                                return NextResponse.json({ error: 'Invalid input parameters', details: error.errors }, { status: 400 });
                                }
                                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
                }
}
