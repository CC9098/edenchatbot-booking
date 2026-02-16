/**
 * Booking Conversation Helpers
 *
 * These functions are designed to be called by Gemini AI via Function Calling
 * to enable conversational booking flow in the chat interface.
 */

import { getBookableDoctors, getDoctorScheduleSummaryByNameZh } from '@/shared/clinic-schedule-data';
import { DOCTOR_BY_NAME_ZH, DOCTOR_ID_BY_NAME_ZH, CLINIC_BY_ID, CLINIC_ID_BY_NAME_ZH, PHYSICAL_CLINIC_IDS, getClinicAddress } from '@/shared/clinic-data';
import { CALENDAR_MAPPINGS } from '@/shared/schedule-config';
import { getFreeBusy } from './google-calendar';
import { fromZonedTime } from 'date-fns-tz';
import { createBooking } from './google-calendar';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_DURATION_MINUTES = 15;

// ---------------------------------------------------------------------------
// 1. List Bookable Doctors
// ---------------------------------------------------------------------------

export interface DoctorInfo {
  nameZh: string;
  nameEn: string;
  scheduleSummary: string;
}

/**
 * List all doctors that have active booking schedules
 */
export async function listBookableDoctors(): Promise<DoctorInfo[]> {
  const doctors = getBookableDoctors();

  return doctors.map(doctor => {
    const scheduleSummary = getDoctorScheduleSummaryByNameZh(doctor.nameZh) || '暫無時間表';
    return {
      nameZh: doctor.nameZh,
      nameEn: doctor.nameEn,
      scheduleSummary,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Get Available Time Slots
// ---------------------------------------------------------------------------

export interface TimeSlot {
  time: string; // HH:mm format
  available: boolean;
}

/**
 * Get available time slots for a doctor at a specific clinic on a specific date
 */
export async function getAvailableTimeSlots(
  doctorNameZh: string,
  date: string, // YYYY-MM-DD format
  clinicNameZh?: string
): Promise<{
  success: boolean;
  slots?: TimeSlot[];
  clinics?: string[]; // If clinic not specified, return available clinics
  error?: string;
}> {
  try {
    // Validate doctor
    const doctor = DOCTOR_BY_NAME_ZH[doctorNameZh];
    if (!doctor) {
      return { success: false, error: `找不到醫師：${doctorNameZh}` };
    }

    const doctorId = doctor.id;

    // Get all active mappings for this doctor
    const doctorMappings = CALENDAR_MAPPINGS.filter(
      mapping => mapping.doctorId === doctorId && mapping.isActive
    );

    if (doctorMappings.length === 0) {
      return { success: false, error: `${doctorNameZh} 暫時沒有可預約時段` };
    }

    // If clinic not specified, return list of available clinics
    if (!clinicNameZh) {
      const availableClinics = doctorMappings
        .map(m => CLINIC_BY_ID[m.clinicId]?.nameZh)
        .filter((name): name is string => Boolean(name));

      return {
        success: true,
        clinics: [...new Set(availableClinics)], // Remove duplicates
      };
    }

    // Validate clinic
    const clinicId = CLINIC_ID_BY_NAME_ZH[clinicNameZh];
    if (!clinicId) {
      return { success: false, error: `找不到診所：${clinicNameZh}` };
    }

    // Find mapping for this doctor + clinic
    const mapping = doctorMappings.find(m => m.clinicId === clinicId);
    if (!mapping) {
      return { success: false, error: `${doctorNameZh} 在 ${clinicNameZh} 沒有可預約時段` };
    }

    // Parse date and get day of week
    const requestDate = new Date(date);
    if (isNaN(requestDate.getTime())) {
      return { success: false, error: `無效日期格式：${date}` };
    }

    const dayOfWeek = requestDate.getDay(); // 0 = Sunday, 6 = Saturday
    const daySchedule = mapping.schedule[dayOfWeek];

    if (!daySchedule || daySchedule.length === 0) {
      return { success: false, error: `${doctorNameZh} 在 ${clinicNameZh} 於${date}沒有診症` };
    }

    // Get busy slots from Google Calendar
    const requestDateUtc = fromZonedTime(`${date}T00:00:00`, HONG_KONG_TIMEZONE);
    const busySlots = await getFreeBusy(mapping.calendarId, requestDateUtc);

    // Generate time slots based on schedule ranges
    const timeSlots: TimeSlot[] = [];

    for (const range of daySchedule) {
      const [startHour, startMinute] = range.start.split(':').map(Number);
      const [endHour, endMinute] = range.end.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      while (
        currentHour < endHour ||
        (currentHour === endHour && currentMinute < endMinute)
      ) {
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        // Check if this slot is available
        const slotStart = fromZonedTime(`${date}T${timeStr}:00`, HONG_KONG_TIMEZONE);
        const slotEnd = new Date(slotStart.getTime() + DEFAULT_DURATION_MINUTES * 60000);

        const isAvailable = !busySlots.some(busy => {
          return (
            (slotStart >= busy.start && slotStart < busy.end) ||
            (slotEnd > busy.start && slotEnd <= busy.end) ||
            (slotStart <= busy.start && slotEnd >= busy.end)
          );
        });

        timeSlots.push({
          time: timeStr,
          available: isAvailable,
        });

        // Increment by 15 minutes
        currentMinute += 15;
        if (currentMinute >= 60) {
          currentMinute -= 60;
          currentHour += 1;
        }
      }
    }

    return {
      success: true,
      slots: timeSlots,
    };
  } catch (error) {
    console.error('[getAvailableTimeSlots] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢時段時發生錯誤',
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Create Booking
// ---------------------------------------------------------------------------

export interface BookingRequest {
  doctorNameZh: string;
  clinicNameZh: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  patientName: string;
  phone: string;
  email?: string;
  notes?: string;
}

/**
 * Create a booking for the patient
 */
export async function createConversationalBooking(
  request: BookingRequest
): Promise<{
  success: boolean;
  bookingId?: string;
  error?: string;
}> {
  try {
    // Validate doctor
    const doctor = DOCTOR_BY_NAME_ZH[request.doctorNameZh];
    if (!doctor) {
      return { success: false, error: `找不到醫師：${request.doctorNameZh}` };
    }

    // Validate clinic
    const clinicId = CLINIC_ID_BY_NAME_ZH[request.clinicNameZh];
    if (!clinicId) {
      return { success: false, error: `找不到診所：${request.clinicNameZh}` };
    }

    const clinic = CLINIC_BY_ID[clinicId];
    if (!clinic) {
      return { success: false, error: `找不到診所：${request.clinicNameZh}` };
    }

    // Find calendar mapping
    const mapping = CALENDAR_MAPPINGS.find(
      m => m.doctorId === doctor.id && m.clinicId === clinicId && m.isActive
    );

    if (!mapping) {
      return { success: false, error: `${request.doctorNameZh} 在 ${request.clinicNameZh} 沒有可預約時段` };
    }

    // Calculate start and end times
    const startDate = fromZonedTime(
      `${request.date}T${request.time}:00`,
      HONG_KONG_TIMEZONE
    );

    if (isNaN(startDate.getTime())) {
      return { success: false, error: '無效的日期或時間' };
    }

    const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60000);

    // Re-check availability to prevent race conditions
    const requestDateUtc = fromZonedTime(`${request.date}T00:00:00`, HONG_KONG_TIMEZONE);
    const busySlots = await getFreeBusy(mapping.calendarId, requestDateUtc);

    const isStillAvailable = !busySlots.some(busy => {
      return (
        (startDate >= busy.start && startDate < busy.end) ||
        (endDate > busy.start && endDate <= busy.end) ||
        (startDate <= busy.start && endDate >= busy.end)
      );
    });

    if (!isStillAvailable) {
      return {
        success: false,
        error: '呢個時段啱啱俾人預約咗，請揀另一個時段',
      };
    }

    // Create booking in Google Calendar
    const result = await createBooking(mapping.calendarId, {
      doctorName: doctor.nameEn,
      doctorNameZh: doctor.nameZh,
      clinicName: clinic.nameEn,
      clinicNameZh: clinic.nameZh,
      startTime: startDate,
      endTime: endDate,
      patientName: request.patientName,
      phone: request.phone,
      email: request.email,
      notes: request.notes,
    });

    if (!result.success || !result.eventId) {
      return {
        success: false,
        error: result.error || '創建預約失敗',
      };
    }

    // Note: Email confirmation will be sent by the booking API
    // For now, we'll handle email in a separate step if needed

    return {
      success: true,
      bookingId: result.eventId,
    };
  } catch (error) {
    console.error('[createConversationalBooking] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '創建預約時發生錯誤',
    };
  }
}
