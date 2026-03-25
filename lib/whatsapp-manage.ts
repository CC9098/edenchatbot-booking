import { buildManageBookingUrl } from "@/lib/public-url";

export interface BookingManageWhatsappOtpInput {
  patientName: string;
  code: string;
  expiryMinutes?: number;
}

export interface BookingManageWhatsappAccessInput {
  patientName: string;
  manageUrl?: string;
}

export function buildWhatsappManageVerificationText(
  input: BookingManageWhatsappOtpInput,
): string {
  return [
    "醫天圓中醫診所預約管理驗證",
    "",
    "你好，",
    `你的預約管理驗證碼是：${input.code}`,
    "此驗證碼會在 10 分鐘後失效。",
    "",
    `管理預約：${buildManageBookingUrl()}`,
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
  return [
    "醫天圓中醫診所預約管理",
    "",
    "你好，",
    "請打開以下連結登入並管理你的預約：",
    input.manageUrl || buildManageBookingUrl(),
    "",
    "此登入連結會在 10 分鐘後失效。",
    "如非你本人操作，請忽略此訊息。",
  ].join("\n");
}

export function buildWhatsappManageAccessTemplateBodyParams(
  input: BookingManageWhatsappAccessInput,
): Record<string, string> {
  return {
    manage_url: input.manageUrl || buildManageBookingUrl(),
  };
}
