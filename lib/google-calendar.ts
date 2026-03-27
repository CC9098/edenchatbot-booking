import { google } from 'googleapis';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

import { getGoogleAuthClient } from './google-auth';
import { getSafeErrorMessage } from './error-sanitizer';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_BOOKING_COLOR_ID = '2';
const DOCTOR_EVENT_COLOR_ID_BY_ID: Record<string, string> = {
  chan: '2',
  lee: '5',
  hon: '6',
  chau: '9',
  cheung: '10',
  leung: '11',
};

function buildBookingEventSummary(details: {
  doctorNameZh: string;
  clinicNameZh: string;
  patientName: string;
}): string {
  return `${details.doctorNameZh}｜${details.clinicNameZh} - ${details.patientName}`;
}

function getBookingEventColorId(doctorId?: string): string {
  if (!doctorId) return DEFAULT_BOOKING_COLOR_ID;
  return DOCTOR_EVENT_COLOR_ID_BY_ID[doctorId] || DEFAULT_BOOKING_COLOR_ID;
}

function buildBookingEventPrivateMetadata(details: {
  doctorId?: string;
  doctorName?: string;
  doctorNameZh: string;
  clinicId?: string;
  clinicName?: string;
  clinicNameZh: string;
}): Record<string, string> | undefined {
  const entries: Array<[string, string]> = [];

  for (const [key, value] of Object.entries({
    doctorId: details.doctorId,
    doctorName: details.doctorName,
    doctorNameZh: details.doctorNameZh,
    clinicId: details.clinicId,
    clinicName: details.clinicName,
    clinicNameZh: details.clinicNameZh,
  })) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized) continue;
    entries.push([key, normalized]);
  }

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function parseBookingEventLineValue(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() || '';
}

function buildBookingEventUpdatePayload(
  existingEvent: any,
  metadata: {
    doctorId?: string;
    doctorName?: string;
    doctorNameZh?: string;
    clinicId?: string;
    clinicName?: string;
    clinicNameZh?: string;
  }
) {
  const description = typeof existingEvent?.description === 'string' ? existingEvent.description : '';
  const summary = typeof existingEvent?.summary === 'string' ? existingEvent.summary : '';
  const existingPrivate = existingEvent?.extendedProperties?.private || {};

  const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
  const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);
  const notesMarker = '\nNotes / 備註:\n';
  const notesIndex = description.indexOf(notesMarker);

  const patientName =
    parseBookingEventLineValue(description, 'Patient / 病人') ||
    summary.split(' - ').slice(1).join(' - ').trim();
  const phone = parseBookingEventLineValue(description, 'Phone / 電話');
  const email = parseBookingEventLineValue(description, 'Email / 電郵');
  const notes = notesIndex >= 0 ? description.slice(notesIndex + notesMarker.length).trim() : '';

  const doctorNameZh =
    metadata.doctorNameZh?.trim() ||
    existingPrivate.doctorNameZh ||
    doctorMatch?.[1]?.trim() ||
    '';
  const doctorName =
    metadata.doctorName?.trim() ||
    existingPrivate.doctorName ||
    doctorMatch?.[2]?.trim() ||
    doctorNameZh;
  const clinicNameZh =
    metadata.clinicNameZh?.trim() ||
    existingPrivate.clinicNameZh ||
    clinicMatch?.[1]?.trim() ||
    '';
  const clinicName =
    metadata.clinicName?.trim() ||
    existingPrivate.clinicName ||
    clinicMatch?.[2]?.trim() ||
    clinicNameZh;
  const doctorId =
    metadata.doctorId?.trim() ||
    existingPrivate.doctorId ||
    undefined;
  const clinicId =
    metadata.clinicId?.trim() ||
    existingPrivate.clinicId ||
    undefined;

  const nextDescription = [
    patientName ? `Patient / 病人: ${patientName}` : '',
    phone ? `Phone / 電話: ${phone}` : '',
    email ? `Email / 電郵: ${email}` : '',
    doctorNameZh ? `Doctor / 醫師: ${doctorNameZh} (${doctorName || doctorNameZh})` : '',
    clinicNameZh ? `Clinic / 診所: ${clinicNameZh} (${clinicName || clinicNameZh})` : '',
    notes ? `\nNotes / 備註:\n${notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary:
      patientName && doctorNameZh && clinicNameZh
        ? buildBookingEventSummary({ doctorNameZh, clinicNameZh, patientName })
        : summary,
    description: nextDescription || description,
    colorId: getBookingEventColorId(doctorId),
    privateMetadata: buildBookingEventPrivateMetadata({
      doctorId,
      doctorName,
      doctorNameZh,
      clinicId,
      clinicName,
      clinicNameZh,
    }),
  };
}

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
    doctorId?: string;
    doctorName: string;
    doctorNameZh: string;
    clinicId?: string;
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
    const privateMetadata = buildBookingEventPrivateMetadata(details);

    const event = {
      summary: buildBookingEventSummary(details),
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
      colorId: getBookingEventColorId(details.doctorId),
      extendedProperties: privateMetadata
        ? {
            private: privateMetadata,
          }
        : undefined,
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
    console.error(`Failed to create calendar event: ${getSafeErrorMessage(error)}`);
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
    console.error(`Failed to get calendar event: ${getSafeErrorMessage(error)}`);
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
    console.error(`Failed to delete calendar event: ${getSafeErrorMessage(error)}`);
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
    privateMetadata?: Record<string, string>;
    bookingMetadata?: {
      doctorId?: string;
      doctorName?: string;
      doctorNameZh?: string;
      clinicId?: string;
      clinicName?: string;
      clinicNameZh?: string;
    };
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();

    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: calendarId,
      eventId: eventId,
    });
    const bookingUpdate = details.bookingMetadata
      ? buildBookingEventUpdatePayload(existingEvent.data, details.bookingMetadata)
      : null;
    const existingPrivate = existingEvent.data.extendedProperties?.private || {};
    const mergedPrivate = {
      ...existingPrivate,
      ...(bookingUpdate?.privateMetadata || {}),
      ...(details.privateMetadata || {}),
    };

    // Update only the time fields
    const updatedEvent = {
      ...existingEvent.data,
      ...(bookingUpdate
        ? {
            summary: bookingUpdate.summary,
            description: bookingUpdate.description,
            colorId: bookingUpdate.colorId,
          }
        : {}),
      start: {
        dateTime: details.startTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
      end: {
        dateTime: details.endTime.toISOString(),
        timeZone: 'Asia/Hong_Kong',
      },
      extendedProperties:
        Object.keys(mergedPrivate).length > 0
          ? {
              private: mergedPrivate,
            }
          : undefined,
    };

    await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: updatedEvent,
    });

    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update calendar event: ${getSafeErrorMessage(error)}`);
    return {
      success: false,
      error: error.message || 'Failed to update event',
    };
  }
}

export async function moveEventToCalendar(
  sourceCalendarId: string,
  targetCalendarId: string,
  eventId: string,
  details: {
    startTime: Date;
    endTime: Date;
    privateMetadata?: Record<string, string>;
    bookingMetadata?: {
      doctorId?: string;
      doctorName?: string;
      doctorNameZh?: string;
      clinicId?: string;
      clinicName?: string;
      clinicNameZh?: string;
    };
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const existingEvent = await calendar.events.get({
      calendarId: sourceCalendarId,
      eventId,
    });
    const bookingUpdate = details.bookingMetadata
      ? buildBookingEventUpdatePayload(existingEvent.data, details.bookingMetadata)
      : null;

    const existingPrivate = existingEvent.data.extendedProperties?.private || {};
    const mergedPrivate = {
      ...existingPrivate,
      ...(bookingUpdate?.privateMetadata || {}),
      ...(details.privateMetadata || {}),
    };

    const insertResponse = await calendar.events.insert({
      calendarId: targetCalendarId,
      requestBody: {
        summary: bookingUpdate?.summary || existingEvent.data.summary || '',
        description: bookingUpdate?.description || existingEvent.data.description || '',
        colorId: bookingUpdate?.colorId || existingEvent.data.colorId || undefined,
        start: {
          dateTime: details.startTime.toISOString(),
          timeZone: 'Asia/Hong_Kong',
        },
        end: {
          dateTime: details.endTime.toISOString(),
          timeZone: 'Asia/Hong_Kong',
        },
        extendedProperties:
          Object.keys(mergedPrivate).length > 0
            ? {
                private: mergedPrivate,
              }
            : undefined,
      },
    });

    const nextEventId = insertResponse.data.id;
    if (!nextEventId) {
      return {
        success: false,
        error: 'Failed to create replacement event',
      };
    }

    await calendar.events.delete({
      calendarId: sourceCalendarId,
      eventId,
    });

    return {
      success: true,
      eventId: nextEventId,
    };
  } catch (error: any) {
    console.error(`Failed to move calendar event: ${getSafeErrorMessage(error)}`);
    return {
      success: false,
      error: error.message || 'Failed to move event',
    };
  }
}

export async function listEventsInRange(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<{ success: boolean; events: any[]; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const events: any[] = [];
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        showDeleted: false,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken,
      });

      if (response.data.items) {
        events.push(...response.data.items);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return { success: true, events };
  } catch (error: any) {
    console.error(
      `Failed to list calendar events for ${calendarId}: ${getSafeErrorMessage(error)}`
    );
    return {
      success: false,
      events: [],
      error: error.message || 'Failed to list events',
    };
  }
}

export async function patchEventPrivateMetadata(
  calendarId: string,
  eventId: string,
  privateMetadata: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const existing = await calendar.events.get({
      calendarId,
      eventId,
    });

    const existingPrivate = existing.data.extendedProperties?.private || {};
    const mergedPrivate = { ...existingPrivate, ...privateMetadata };

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        extendedProperties: {
          private: mergedPrivate,
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(
      `Failed to patch event metadata for ${calendarId}/${eventId}: ${getSafeErrorMessage(error)}`
    );
    return {
      success: false,
      error: error.message || 'Failed to patch event metadata',
    };
  }
}
