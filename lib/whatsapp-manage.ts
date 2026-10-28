import type { BookingLocale } from '@/shared/booking-locale';
import { buildManageBookingUrl } from "@/lib/public-url";

export interface BookingManageWhatsappOtpInput {
  locale?: BookingLocale;
  patientName: string;
  code: string;
  expiryMinutes?: number;
  purpose?: "manage_booking" | "member_login";
}

export interface BookingManageWhatsappAccessInput {
  locale?: BookingLocale;
  patientName: string;
  manageUrl?: string;
}

export function buildWhatsappManageVerificationText(
  input: BookingManageWhatsappOtpInput,
): string {
  if (input.locale === 'en') return [
    input.purpose === 'member_login' ? 'Eden Clinic — sign-in code' : 'Eden Clinic — appointment verification', '',
    `Your verification code is: ${input.code}`,
    `This code expires in ${input.expiryMinutes || 10} minutes.`, '',
    ...(input.purpose === 'member_login' ? [] : [`Manage appointments: ${buildManageBookingUrl({ locale: input.locale })}`]),
    'If you did not request this code, ignore this message.',
  ].join('\n');
  return [
    input.purpose === "member_login" ? "醫天圓中醫診所會員登入驗證" : "醫天圓中醫診所預約管理驗證",
    "",
    "你好，",
    `你的${input.purpose === "member_login" ? "會員登入" : "預約管理"}驗證碼是：${input.code}`,
    `此驗證碼會在 ${input.expiryMinutes || 10} 分鐘後失效。`,
    "",
    ...(input.purpose === "member_login" ? [] : [`管理預約：${buildManageBookingUrl({ locale: input.locale })}`]),
    "如非你本人操作，請忽略此訊息。",
  ].join("\n");
}

export function buildWhatsappManageVerificationTemplateBodyParams(
  input: BookingManageWhatsappOtpInput,
): Record<string, string> {
  return {
    verification_code: input.code,
  };
}

export function buildWhatsappManageAccessText(
  input: BookingManageWhatsappAccessInput,
): string {
  if (input.locale === 'en') return [
    'Eden Clinic — manage appointments', '',
    'Open this link to sign in and manage your appointments:',
    input.manageUrl || buildManageBookingUrl({ locale: input.locale }), '',
    'This sign-in link expires in 10 minutes.',
    'If you did not request this link, ignore this message.',
  ].join('\n');
  return [
    "醫天圓中醫診所預約管理",
    "",
    "你好，",
    "請打開以下連結登入並管理你的預約：",
    input.manageUrl || buildManageBookingUrl({ locale: input.locale }),
    "",
    "此登入連結會在 10 分鐘後失效。",
    "如非你本人操作，請忽略此訊息。",
  ].join("\n");
}

export function buildWhatsappManageAccessTemplateBodyParams(
  input: BookingManageWhatsappAccessInput,
): Record<string, string> {
  return {
    manage_url: input.manageUrl || buildManageBookingUrl({ locale: input.locale }),
  };
}
