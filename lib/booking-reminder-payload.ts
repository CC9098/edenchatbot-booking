import { formatInTimeZone } from 'date-fns-tz';

import {
  type BookingReminderIntakeCandidate,
  type BookingVisitType,
} from '@/lib/booking-intake-storage';
import { CLINIC_ID_BY_NAME_ZH, getClinicAddress } from '@/shared/clinic-data';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

export interface BookingReminderMetadata {
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorName: string;
  doctorNameZh: string;
  clinicName: string;
  clinicNameZh: string;
  clinicAddress: string;
  clinicId?: string;
  visitType: BookingVisitType;
}

export interface BookingReminderPayload extends BookingReminderMetadata {
  date: string;
  time: string;
  eventId: string;
  calendarId: string;
}

function inferVisitType(description: string): BookingVisitType {
  if (/first|首診/i.test(description)) {
    return 'first';
  }

  return 'followup';
}

function parseLineValue(description: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
  return match?.[1]?.trim() || '';
}

export function extractBookingReminderMetadata(event: any): BookingReminderMetadata | null {
  const description = typeof event?.description === 'string' ? event.description : '';
  const summary = typeof event?.summary === 'string' ? event.summary : '';

  const patientName =
    parseLineValue(description, 'Patient / 病人') ||
    summary.split(' - ').slice(1).join(' - ').trim();
  const patientPhone = parseLineValue(description, 'Phone / 電話');
  const patientEmail = parseLineValue(description, 'Email / 電郵');

  const doctorMatch = description.match(/Doctor \/ 醫師:\s*(.+?)\s*\((.+?)\)/);
  const clinicMatch = description.match(/Clinic \/ 診所:\s*(.+?)\s*\((.+?)\)/);

  const doctorNameZh = doctorMatch?.[1]?.trim() || '';
  const doctorName = doctorMatch?.[2]?.trim() || doctorNameZh;
  const clinicNameZh = clinicMatch?.[1]?.trim() || '';
  const clinicName = clinicMatch?.[2]?.trim() || clinicNameZh;

  if (!patientName || !doctorNameZh || !clinicNameZh) {
    return null;
  }

  const clinicId = CLINIC_ID_BY_NAME_ZH[clinicNameZh];
  const clinicAddress = clinicId ? getClinicAddress(clinicId) : '';

  return {
    patientName,
    patientPhone,
    patientEmail,
    doctorName,
    doctorNameZh,
    clinicName,
    clinicNameZh,
    clinicAddress,
    clinicId,
    visitType: inferVisitType(description),
  };
}

export function buildBookingReminderPayload(
  event: any,
  calendarId: string,
): BookingReminderPayload | null {
  const metadata = extractBookingReminderMetadata(event);
  if (!metadata) return null;

  const eventId = typeof event?.id === 'string' ? event.id : '';
  const startDateTime = typeof event?.start?.dateTime === 'string' ? event.start.dateTime : '';
  if (!eventId || !startDateTime) return null;

  const start = new Date(startDateTime);
  if (Number.isNaN(start.getTime())) return null;

  return {
    ...metadata,
    date: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'yyyy-MM-dd'),
    time: formatInTimeZone(start, HONG_KONG_TIMEZONE, 'HH:mm'),
    eventId,
    calendarId,
  };
}

export function buildBookingReminderPayloadFromIntake(
  candidate: BookingReminderIntakeCandidate,
): BookingReminderPayload | null {
  const patientName = candidate.patientName.trim();
  const patientPhone = candidate.patientPhone.trim();
  const patientEmail = candidate.patientEmail.trim();
  const doctorNameZh = candidate.doctorNameZh.trim();
  const clinicNameZh = candidate.clinicNameZh.trim();
  const eventId = candidate.googleEventId.trim();
  const calendarId = candidate.calendarId.trim();
  const date = candidate.appointmentDate.trim();
  const time = candidate.appointmentTime.trim();

  if (!patientName || !doctorNameZh || !clinicNameZh || !eventId || !calendarId || !date || !time) {
    return null;
  }

  const clinicId = candidate.clinicId.trim() || CLINIC_ID_BY_NAME_ZH[clinicNameZh];
  const clinicAddress = clinicId ? getClinicAddress(clinicId) : '';

  return {
    patientName,
    patientPhone,
    patientEmail,
    doctorName: doctorNameZh,
    doctorNameZh,
    clinicName: clinicNameZh,
    clinicNameZh,
    clinicAddress,
    clinicId,
    visitType: candidate.visitType,
    date,
    time,
    eventId,
    calendarId,
  };
}
