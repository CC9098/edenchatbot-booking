import { type BookingVisitType } from '@/lib/booking-intake-storage';
import { buildManageBookingUrl } from '@/lib/public-url';
import { CLINIC_BY_ID, type ClinicId } from '@/shared/clinic-data';

const VISIT_TYPE_LABELS: Record<BookingVisitType, string> = {
  first: '首診',
  followup: '覆診',
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

export interface BookingWhatsappConfirmationInput {
  bookingId: string;
  patientName: string;
  doctorNameZh: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  visitType: BookingVisitType;
}

export interface BookingWhatsappReminderInput extends BookingWhatsappConfirmationInput {}

function formatDateForWhatsapp(dateIso: string): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeWhatsappPhoneNumber(value: string): string {
  const normalizedDigits = digitsOnly(value.trim());
  if (!normalizedDigits) return '';

  if (normalizedDigits.startsWith('852')) {
    return `+${normalizedDigits}`;
  }

  if (normalizedDigits.length === 8) {
    return `+852${normalizedDigits}`;
  }

  return `+${normalizedDigits}`;
}

export function normalizeWhatsappSourceId(value: string): string {
  return normalizeWhatsappPhoneNumber(value).replace(/^\+/, '');
}

export function getClinicWhatsappPhone(clinicId: string): string | null {
  const clinic = CLINIC_BY_ID[clinicId as ClinicId];
  if (!clinic?.whatsappUrl) {
    return null;
  }

  const normalizedDigits = digitsOnly(clinic.whatsappUrl);
  return normalizedDigits ? `+${normalizedDigits}` : null;
}

export function buildWhatsappConfirmationText(
  input: BookingWhatsappConfirmationInput,
): string {
  return [
    '醫天圓中醫診所預約確認',
    '',
    `你好 ${input.patientName}，`,
    `你已成功預約 ${input.doctorNameZh} 醫師。`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate)}`,
    `時間：${input.appointmentTime}`,
    `診症類型：${VISIT_TYPE_LABELS[input.visitType]}`,
    `預約編號：${input.bookingId}`,
    '',
    `管理預約：${buildManageBookingUrl()}`,
    '如需更改或取消，可打開以上連結，以 WhatsApp 驗證碼登入管理預約。',
  ].join('\n');
}

export function buildWhatsappTemplateBodyParams(
  input: BookingWhatsappConfirmationInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    visit_type: VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: buildManageBookingUrl(),
  };
}

export function buildWhatsappReminderText(
  input: BookingWhatsappReminderInput,
): string {
  return [
    '醫天圓中醫診所預約提醒',
    '',
    `你好 ${input.patientName}，`,
    '溫馨提示：你的預約大約將於24小時後進行。',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate)}`,
    `時間：${input.appointmentTime}`,
    `診症類型：${VISIT_TYPE_LABELS[input.visitType]}`,
    `預約編號：${input.bookingId}`,
    '',
    `管理預約：${buildManageBookingUrl()}`,
    '如需更改或取消，可打開以上連結，以 WhatsApp 驗證碼登入管理預約。',
  ].join('\n');
}

export function buildWhatsappReminderTemplateBodyParams(
  input: BookingWhatsappReminderInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    visit_type: VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: buildManageBookingUrl(),
  };
}
