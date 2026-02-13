
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getMappingWithFallback } from '@/lib/storage-helpers'; // Need to create this helper wrapper or use direct storage
import { getFreeBusy } from '@/lib/google-calendar';
import { getScheduleForDayFromWeekly, isDateBlocked, isSlotAvailableUtc } from '@/lib/booking-helpers';
import { storage } from '@/lib/storage';
import { CALENDAR_MAPPINGS } from '@/shared/schedule-config';



const availabilitySchema = z.object({
                doctorId: z.string(),
                clinicId: z.string(),
                date: z.string(), // ISO date string
                durationMinutes: z.number().default(15),
});

export async function POST(request: NextRequest) {
                try {
                                const body = await request.json();
                                const { doctorId, clinicId, date, durationMinutes } = availabilitySchema.parse(body);

                                const mapping = await getMappingWithFallback(doctorId, clinicId);
                                if (!mapping || !mapping.isActive) {
                                                return NextResponse.json({ error: 'Doctor not available at this clinic' }, { status: 404 });
                                }

                                // Check holidays
                                let isBlocked = false;
                                try {
                                                console.time('db-check-holidays');
                                                isBlocked = await isDateBlocked(date, doctorId, clinicId);
                                                console.timeEnd('db-check-holidays');
                                } catch (error: any) {
                                                console.timeEnd('db-check-holidays');
                                                console.error('Failed to check holidays from DB, assuming open:', error);
                                                // Fail open: if DB is down, we don't block the date
                                                isBlocked = false;
                                }

                                if (isBlocked) {
                                                return NextResponse.json({ isClosed: true, isHoliday: true, slots: [] });
                                }

                                const dateObj = new Date(date);
                                const dayOfWeek = dateObj.getDay();
                                const daySchedule = getScheduleForDayFromWeekly(mapping.schedule, dayOfWeek);

                                if (!daySchedule || daySchedule.length === 0) {
                                                return NextResponse.json({ isClosed: true, slots: [] });
                                }

                                // Get busy slots from Google Calendar
                                try {
                                                console.time('fetch-google-calendar');
                                                const busySlots = await getFreeBusy(mapping.calendarId, dateObj);
                                                console.timeEnd('fetch-google-calendar');

                                                const availableSlots: string[] = [];
                                                const now = new Date(); // Current time to prevent booking in the past

                                                // Is today?
                                                const isToday = dateObj.toDateString() === now.toDateString();
                                                const bufferMinutes = 60; // 1 hour buffer for same-day bookings
                                                now.setMinutes(now.getMinutes() + bufferMinutes);

                                                for (const range of daySchedule) {
                                                                const [startHour, startMin] = range.start.split(':').map(Number);
                                                                const [endHour, endMin] = range.end.split(':').map(Number);

                                                                let currentSlot = new Date(dateObj);
                                                                currentSlot.setHours(startHour, startMin, 0, 0);

                                                                const endData = new Date(dateObj);
                                                                endData.setHours(endHour, endMin, 0, 0);

                                                                while (currentSlot < endData) {
                                                                                // If booking for today, skip past times
                                                                                if (isToday && currentSlot < now) {
                                                                                                currentSlot.setMinutes(currentSlot.getMinutes() + 15); // Increment by 15 mins
                                                                                                continue;
                                                                                }

                                                                                // Check if slot + duration fits within range end
                                                                                const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
                                                                                if (slotEnd > endData) break;

                                                                                // Check against Google Calendar busy slots
                                                                                if (isSlotAvailableUtc(currentSlot, slotEnd, busySlots)) {
                                                                                                // Format as HH:mm
                                                                                                const slotStr = currentSlot.toTimeString().slice(0, 5);
                                                                                                availableSlots.push(slotStr);
                                                                                }

                                                                                currentSlot.setMinutes(currentSlot.getMinutes() + 15); // Increment by 15 mins
                                                                }
                                                }

                                                return NextResponse.json({ success: true, slots: availableSlots });
                                } catch (calError: any) {
                                                console.error('Calendar error:', calError);
                                                return NextResponse.json({ error: 'Failed to fetch calendar availability' }, { status: 500 });
                                }

                } catch (error: any) {
                                console.error('Availability API Error:', error);
                                if (error instanceof z.ZodError) {
                                                return NextResponse.json({ error: 'Invalid input parameters', details: error.errors }, { status: 400 });
                                }
                                return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
                }
}
