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
  meetLink?: string;
  onlineConsultUrl?: string;
  groupBookingNotice?: string;
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

function buildPatientManageBookingUrl(manageAccessToken?: string): string {
  return manageAccessToken
    ? buildManageBookingUrl({ token: manageAccessToken })
    : buildManageBookingUrl();
}

function buildOnlineConsultFlowLines(input: BookingWhatsappConfirmationInput): string[] {
  if (!input.onlineConsultUrl && !input.meetLink) {
    return [];
  }

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
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken);
  const onlineConsultFlowLines = buildOnlineConsultFlowLines(input);

  return [
    '醫天圓中醫診所預約確認',
    '',
    `你好 ${input.patientName}，`,
    `你已成功預約 ${input.doctorNameZh} 醫師。`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate)}`,
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
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken);

  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    visit_type: VISIT_TYPE_LABELS[input.visitType],
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
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken);

  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    ...(input.onlineConsultUrl ? { online_consult_url: input.onlineConsultUrl } : {}),
    visit_type: VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: manageUrl,
  };
}

export function buildWhatsappReminderText(
  input: BookingWhatsappReminderInput & { manageAccessToken?: string },
): string {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken);

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
    `管理預約（更改 / 取消）：`,
    manageUrl,
  ].join('\n');
}

export function buildWhatsappReminderTemplateBodyParams(
  input: BookingWhatsappReminderInput & { manageAccessToken?: string },
): Record<string, string> {
  const manageUrl = buildPatientManageBookingUrl(input.manageAccessToken);

  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    visit_type: VISIT_TYPE_LABELS[input.visitType],
    booking_id: input.bookingId,
    manage_url: manageUrl,
  };
}

// ---------------------------------------------------------------------------
// Cancel / Reschedule notification messages
// ---------------------------------------------------------------------------

export interface BookingWhatsappCancellationInput {
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
  return [
    '醫天圓中醫診所預約取消確認',
    '',
    `你好 ${input.patientName}，`,
    '你的以下預約已成功取消：',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `原定日期：${formatDateForWhatsapp(input.appointmentDate)}`,
    `原定時間：${input.appointmentTime}`,
    `預約編號：${input.bookingId}`,
    input.cancellationReason ? '' : '',
    input.cancellationReason || '',
    '',
    '如需重新預約，歡迎隨時使用以下連結：',
    buildPatientManageBookingUrl(input.manageAccessToken),
  ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');
}

export function buildWhatsappCancellationTemplateBodyParams(
  input: BookingWhatsappCancellationInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    appointment_datetime: `${formatDateForWhatsapp(input.appointmentDate)} ${input.appointmentTime}`,
    booking_id: input.bookingId,
    manage_url: buildPatientManageBookingUrl(input.manageAccessToken),
  };
}

export interface BookingWhatsappRescheduleInput {
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
  return [
    '醫天圓中醫診所預約更改確認',
    '',
    `你好 ${input.patientName}，`,
    '你的預約已成功更改：',
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `原定時間：${formatDateForWhatsapp(input.oldDate)} ${input.oldTime}`,
    `新時間：${formatDateForWhatsapp(input.newDate)} ${input.newTime}`,
    `預約編號：${input.bookingId}`,
    '',
    `管理預約：${buildPatientManageBookingUrl(input.manageAccessToken)}`,
  ].join('\n');
}

export function buildWhatsappRescheduleTemplateBodyParams(
  input: BookingWhatsappRescheduleInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    doctor_name: input.doctorNameZh,
    clinic_name: input.clinicNameZh,
    old_datetime: `${formatDateForWhatsapp(input.oldDate)} ${input.oldTime}`,
    new_datetime: `${formatDateForWhatsapp(input.newDate)} ${input.newTime}`,
    booking_id: input.bookingId,
    manage_url: buildPatientManageBookingUrl(input.manageAccessToken),
  };
}
