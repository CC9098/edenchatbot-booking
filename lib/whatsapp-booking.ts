import type { BookingLocale } from '@/shared/booking-locale';
import { notificationDoctorName, notificationClinicName } from '@/lib/booking-notification-locale';
import { type BookingVisitType } from '@/lib/booking-intake-storage';
import { buildManageBookingUrl } from '@/lib/public-url';

const VISIT_TYPE_LABELS: Record<BookingVisitType, string> = {
  first: '首診',
  followup: '覆診',
};

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const DEFAULT_CHATWOOT_WHATSAPP_SENDER_PHONE = '+85251899065';

export interface BookingWhatsappConfirmationInput {
  locale?: BookingLocale;
  bookingId: string;
  patientName: string;
  doctorNameZh: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  visitType: BookingVisitType;
  meetLink?: string;
  onlineConsultUrl?: string;
  groupBookingNotice?: string;
}

export interface BookingWhatsappReminderInput extends BookingWhatsappConfirmationInput {}

function formatDateForWhatsapp(dateIso: string, locale?: BookingLocale): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-HK' : 'zh-HK', {
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

export function getChatwootWhatsappSenderPhone(): string {
  const configuredPhone = process.env.CHATWOOT_WHATSAPP_SENDER_PHONE?.trim();
  return normalizeWhatsappPhoneNumber(
    configuredPhone || DEFAULT_CHATWOOT_WHATSAPP_SENDER_PHONE,
  );
}

/**
 * @deprecated Chatwoot currently sends every clinic notification through the
 * Tsuen Wan Cloud API inbox. Keep this alias until the existing call sites are
 * renamed; public clinic contact links live in shared/clinic-data.ts instead.
 */
export function getClinicWhatsappPhone(_clinicId: string): string {
  return getChatwootWhatsappSenderPhone();
}

function buildPatientManageBookingUrl(manageAccessToken?: string, locale?: BookingLocale): string {
  return manageAccessToken
    ? buildManageBookingUrl({ token: manageAccessToken, locale })
    : buildManageBookingUrl({ locale });
}

function buildOnlineConsultFlowLines(input: BookingWhatsappConfirmationInput): string[] {
  if (!input.onlineConsultUrl && !input.meetLink) {
    return [];
  }

  if (input.locale === 'en') return [
    'Online consultation:',
    input.onlineConsultUrl ? '1. Open the consultation link five minutes before your appointment.' : '1. Open Google Meet five minutes before your appointment.',
    input.onlineConsultUrl ? `Consultation link: ${input.onlineConsultUrl}` : '',
    '2. Keep Google Meet open while you wait for your practitioner.',
    input.meetLink ? `Google Meet: ${input.meetLink}` : '',
  ].filter(Boolean);

  const lines = [
    '網上診症流程：',
    input.onlineConsultUrl
      ? '1. 請於預約時間前 5 分鐘按以下「網上診症入口」進入候診。'
      : '1. 請於預約時間前 5 分鐘開啟 Google Meet。',
    input.onlineConsultUrl ? `網上診症入口：${input.onlineConsultUrl}` : '',
    '2. 打開入口後，系統會通知醫師，請保持 Google Meet 開啟等候。',
    input.meetLink
      ? `3. 如入口未能開啟，可直接使用 Google Meet 連結：${input.meetLink}`
      : '',
  ];

  return lines.filter(Boolean);
}

export function buildWhatsappConfirmationText(
  input: BookingWhatsappConfirmationInput & { manageAccessToken?: string },
): string {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken, input.locale);
  const onlineConsultFlowLines = buildOnlineConsultFlowLines(input);
  if (input.locale === 'en') return [
    'Eden Clinic — appointment confirmed', '', `Hello ${input.patientName},`,
    `Practitioner: ${notificationDoctorName(input.doctorNameZh, input.locale)}`,
    `Clinic: ${notificationClinicName(input.clinicNameZh, input.locale)}`,
    `Date: ${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `Time: ${input.appointmentTime} (Hong Kong time)`,
    `Visit: ${input.visitType === 'first' ? 'First visit' : 'Follow-up'}`,
    ...onlineConsultFlowLines,
    `Booking reference: ${input.bookingId}`,
    input.groupBookingNotice || '', '', 'Change or cancel your appointment:', manageUrl,
  ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');

  return [
    '醫天圓中醫診所預約確認',
    '',
    `你好 ${input.patientName}，`,
    `你已成功預約 ${input.doctorNameZh} 醫師。`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `時間：${input.appointmentTime}`,
    `診症類型：${VISIT_TYPE_LABELS[input.visitType]}`,
    ...onlineConsultFlowLines,
    `預約編號：${input.bookingId}`,
    input.groupBookingNotice ? '' : '',
    input.groupBookingNotice || '',
    '',
    `管理預約（更改 / 取消）：`,
    manageUrl,
  ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');
}

export function buildWhatsappTemplateBodyParams(
  input: BookingWhatsappConfirmationInput & { manageAccessToken?: string },
): Record<string, string> {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken, input.locale);

  return {
    patient_name: input.patientName,
    doctor_name: notificationDoctorName(input.doctorNameZh, input.locale),
    clinic_name: notificationClinicName(input.clinicNameZh, input.locale),
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate, input.locale)} ${input.appointmentTime}`,
    visit_type: input.locale === 'en' ? (input.visitType === 'first' ? 'First visit' : 'Follow-up') : VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: manageUrl,
    ...(input.meetLink && process.env.CHATWOOT_WHATSAPP_CONFIRMATION_TEMPLATE_INCLUDE_MEET_LINK === 'true'
      ? { meet_link: input.meetLink }
      : {}),
  };
}

export function buildWhatsappOnlineTemplateBodyParams(
  input: BookingWhatsappConfirmationInput & { manageAccessToken?: string },
): Record<string, string> {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken, input.locale);
  const appointmentDateTime = `${formatDateForWhatsapp(input.appointmentDate, input.locale)} ${input.appointmentTime}`;

  return {
    patient_name: input.patientName,
    doctor_name: input.locale === 'en' ? `${notificationDoctorName(input.doctorNameZh, input.locale)} (${appointmentDateTime})` : `${input.doctorNameZh}（預約時間：${appointmentDateTime}）`,
    clinic_name: notificationClinicName(input.clinicNameZh, input.locale),
    appointment_datetime: appointmentDateTime,
    ...(input.onlineConsultUrl ? { online_consult_url: input.onlineConsultUrl } : {}),
    visit_type: input.locale === 'en' ? (input.visitType === 'first' ? 'First visit' : 'Follow-up') : VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: manageUrl,
  };
}

export function buildWhatsappReminderText(
  input: BookingWhatsappReminderInput & { manageAccessToken?: string },
): string {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken, input.locale);
  if (input.locale === 'en') return [
    'Eden Clinic — appointment reminder', '', `Hello ${input.patientName},`,
    'Your appointment is in approximately 24 hours.',
    `Practitioner: ${notificationDoctorName(input.doctorNameZh, input.locale)}`,
    `Clinic: ${notificationClinicName(input.clinicNameZh, input.locale)}`,
    `Date: ${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `Time: ${input.appointmentTime} (Hong Kong time)`,
    `Visit: ${input.visitType === 'first' ? 'First visit' : 'Follow-up'}`,
    `Booking reference: ${input.bookingId}`, '', 'Change or cancel your appointment:', manageUrl,
  ].join('\n');

  return [
    '醫天圓中醫診所預約提醒',
    '',
    `你好 ${input.patientName}，`,
    '溫馨提示：你的預約大約將於24小時後進行。',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `時間：${input.appointmentTime}`,
    `診症類型：${VISIT_TYPE_LABELS[input.visitType]}`,
    `預約編號：${input.bookingId}`,
    '',
    `管理預約（更改 / 取消）：`,
    manageUrl,
  ].join('\n');
}

export function buildWhatsappReminderTemplateBodyParams(
  input: BookingWhatsappReminderInput & { manageAccessToken?: string },
): Record<string, string> {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken, input.locale);

  return {
    patient_name: input.patientName,
    doctor_name: notificationDoctorName(input.doctorNameZh, input.locale),
    clinic_name: notificationClinicName(input.clinicNameZh, input.locale),
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate, input.locale)} ${input.appointmentTime}`,
    visit_type: input.locale === 'en' ? (input.visitType === 'first' ? 'First visit' : 'Follow-up') : VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: manageUrl,
  };
}

// ---------------------------------------------------------------------------
// Cancel / Reschedule notification messages
// ---------------------------------------------------------------------------

export interface BookingWhatsappCancellationInput {
  locale?: BookingLocale;
  bookingId: string;
  patientName: string;
  doctorNameZh: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  manageAccessToken?: string;
  cancellationReason?: string;
}

export function buildWhatsappCancellationText(
  input: BookingWhatsappCancellationInput,
): string {
  if (input.locale === 'en') return [
    'Eden Clinic — appointment cancelled', '', `Hello ${input.patientName},`,
    'Your appointment has been cancelled.',
    `Practitioner: ${notificationDoctorName(input.doctorNameZh, input.locale)}`,
    `Clinic: ${notificationClinicName(input.clinicNameZh, input.locale)}`,
    `Date: ${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `Time: ${input.appointmentTime} (Hong Kong time)`,
    `Booking reference: ${input.bookingId}`, input.cancellationReason || '', '',
    'Manage appointments:', buildPatientManageBookingUrl(input.manageAccessToken, input.locale),
  ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');
  return [
    '醫天圓中醫診所預約取消確認',
    '',
    `你好 ${input.patientName}，`,
    '你的以下預約已成功取消：',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `原定日期：${formatDateForWhatsapp(input.appointmentDate, input.locale)}`,
    `原定時間：${input.appointmentTime}`,
    `預約編號：${input.bookingId}`,
    input.cancellationReason ? '' : '',
    input.cancellationReason || '',
    '',
    '如需重新預約，歡迎隨時使用以下連結：',
    buildPatientManageBookingUrl(input.manageAccessToken, input.locale),
  ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');
}

export function buildWhatsappCancellationTemplateBodyParams(
  input: BookingWhatsappCancellationInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: notificationDoctorName(input.doctorNameZh, input.locale),
    clinic_name: notificationClinicName(input.clinicNameZh, input.locale),
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate, input.locale)} ${input.appointmentTime}`,
    booking_id: input.bookingId,
    manage_url: buildPatientManageBookingUrl(input.manageAccessToken, input.locale),
  };
}

export interface BookingWhatsappRescheduleInput {
  locale?: BookingLocale;
  bookingId: string;
  patientName: string;
  doctorNameZh: string;
  clinicNameZh: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  manageAccessToken?: string;
}

export function buildWhatsappRescheduleText(
  input: BookingWhatsappRescheduleInput,
): string {
  if (input.locale === 'en') return [
    'Eden Clinic — appointment changed', '', `Hello ${input.patientName},`,
    'Your appointment has been rescheduled.',
    `Practitioner: ${notificationDoctorName(input.doctorNameZh, input.locale)}`,
    `Clinic: ${notificationClinicName(input.clinicNameZh, input.locale)}`,
    `Previous time: ${formatDateForWhatsapp(input.oldDate, input.locale)} ${input.oldTime}`,
    `New time: ${formatDateForWhatsapp(input.newDate, input.locale)} ${input.newTime} (Hong Kong time)`,
    `Booking reference: ${input.bookingId}`, '',
    'Manage appointments:', buildPatientManageBookingUrl(input.manageAccessToken, input.locale),
  ].join('\n');
  return [
    '醫天圓中醫診所預約更改確認',
    '',
    `你好 ${input.patientName}，`,
    '你的預約已成功更改：',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `原定時間：${formatDateForWhatsapp(input.oldDate, input.locale)} ${input.oldTime}`,
    `新時間：${formatDateForWhatsapp(input.newDate, input.locale)} ${input.newTime}`,
    `預約編號：${input.bookingId}`,
    '',
    `管理預約：${buildPatientManageBookingUrl(input.manageAccessToken, input.locale)}`,
  ].join('\n');
}

export function buildWhatsappRescheduleTemplateBodyParams(
  input: BookingWhatsappRescheduleInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: notificationDoctorName(input.doctorNameZh, input.locale),
    clinic_name: notificationClinicName(input.clinicNameZh, input.locale),
    old_datetime: `${formatDateForWhatsapp(input.oldDate, input.locale)} ${input.oldTime}`,
    new_datetime: `${formatDateForWhatsapp(input.newDate, input.locale)} ${input.newTime}`,
    booking_id: input.bookingId,
    manage_url: buildPatientManageBookingUrl(input.manageAccessToken, input.locale),
  };
}
