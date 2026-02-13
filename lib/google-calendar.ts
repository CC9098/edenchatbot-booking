import { google } from 'googleapis';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { getGoogleAuthClient } from './google-auth';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleCalendarClient() {
  const auth = await getGoogleAuthClient();
  return google.calendar({ version: 'v3', auth });
}

// Get busy time slots for a calendar on a specific date
export async function getFreeBusy(calendarId: string, date: Date): Promise<{ start: Date; end: Date }[]> {
  const calendar = await getUncachableGoogleCalendarClient();

  // Build day boundaries from Hong Kong local day, independent of server timezone.
  const targetDate = formatInTimeZone(date, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
  const dayStart = fromZonedTime(`${targetDate}T00:00:00`, HONG_KONG_TIMEZONE);
  const dayEnd = fromZonedTime(`${targetDate}T23:59:59.999`, HONG_KONG_TIMEZONE);

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: HONG_KONG_TIMEZONE,
        items: [{ id: calendarId }],
      },
    });

    const busySlots = response.data.calendars?.[calendarId]?.busy || [];

    return busySlots.map(slot => ({
      start: new Date(slot.start!),
      end: new Date(slot.end!),
    }));
  } catch (error: any) {
    if (error.code === 404 || error.message?.includes('notFound')) {
      throw new Error('Calendar not found or no access');
    }
    throw error;
  }
}

// Create a booking event in Google Calendar
export async function createBooking(
  calendarId: string,
  details: {
    doctorName: string;
    doctorNameZh: string;
    clinicName: string;
    clinicNameZh: string;
    startTime: Date;
    endTime: Date;
    patientName: string;
    phone: string;
    email?: string;
    notes?: string;
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const event = {
      summary: `${details.clinicNameZh} - ${details.patientName}`,
      description: [
        `Patient / 病人: ${details.patientName}`,
        `Phone / 電話: ${details.phone}`,
        details.email ? `Email / 電郵: ${details.email}` : '',
        `Doctor / 醫師: ${details.doctorNameZh} (${details.doctorName})`,
        `Clinic / 診所: ${details.clinicNameZh} (${details.clinicName})`,
        details.notes ? `\nNotes / 備註:\n${details.notes}` : ''
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: details.startTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
      end: {
        dateTime: details.endTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
      colorId: '2', // Sage green color in Google Calendar
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: event,
    });

    return {
      success: true,
      eventId: response.data.id || undefined,
    };
  } catch (error: any) {
    console.error('Failed to create calendar event:', error);
    return {
      success: false,
      error: error.message || 'Failed to create booking',
    };
  }
}

// Check if a specific time slot is available (not in busy times)
export function isSlotAvailable(
  time: string, // HH:mm format
  date: Date,
  busySlots: { start: Date; end: Date }[],
  durationMinutes: number
): boolean {
  const [hours, minutes] = time.split(':').map(Number);
  const slotStart = new Date(date);
  slotStart.setHours(hours, minutes, 0, 0);

  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

  // Check if this slot overlaps with any busy period
  for (const busy of busySlots) {
    if (
      (slotStart >= busy.start && slotStart < busy.end) || // Slot starts during busy time
      (slotEnd > busy.start && slotEnd <= busy.end) ||     // Slot ends during busy time
      (slotStart <= busy.start && slotEnd >= busy.end)     // Slot encompasses busy time
    ) {
      return false;
    }
  }

  return true;
}

// Get event details from Google Calendar
export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<{ success: boolean; event?: any; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    const response = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });

    return {
      success: true,
      event: response.data,
    };
  } catch (error: any) {
    console.error('Failed to get calendar event:', error);
    return {
      success: false,
      error: error.message || 'Failed to get event',
    };
  }
}

// Delete/cancel an event from Google Calendar
export async function deleteEvent(
  calendarId: string,
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete calendar event:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete event',
    };
  }
}

// Update an event in Google Calendar (for rescheduling)
export async function updateEvent(
  calendarId: string,
  eventId: string,
  details: {
    startTime: Date;
    endTime: Date;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });

    // Update only the time fields
    const updatedEvent = {
      ...existingEvent.data,
      start: {
        dateTime: details.startTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
      end: {
        dateTime: details.endTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
    };

    await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: updatedEvent,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to update calendar event:', error);
    return {
      success: false,
      error: error.message || 'Failed to update event',
    };
  }
}
