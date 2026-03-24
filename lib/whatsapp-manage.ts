import { buildManageBookingUrl } from "@/lib/public-url";

const OTP_EXPIRY_MINUTES_FALLBACK = 10;

export interface BookingManageWhatsappOtpInput {
  patientName: string;
  code: string;
  expiryMinutes?: number;
}

function getExpiryMinutes(value?: number) {
  return Number.isFinite(value) && value && value > 0
    ? Math.floor(value)
    : OTP_EXPIRY_MINUTES_FALLBACK;
}

export function buildWhatsappManageVerificationText(
  input: BookingManageWhatsappOtpInput,
): string {
  const expiryMinutes = getExpiryMinutes(input.expiryMinutes);

  return [
    "醫天圓中醫診所預約管理驗證",
    "",
    "你好，",
    `你的預約管理驗證碼是：${input.code}`,
    `此驗證碼會在 ${expiryMinutes} 分鐘後失效。`,
    "",
    `管理預約：${buildManageBookingUrl()}`,
    "如非你本人操作，請忽略此訊息。",
  ].join("\n");
}

export function buildWhatsappManageVerificationTemplateBodyParams(
  input: BookingManageWhatsappOtpInput,
): Record<string, string> {
  return {
    patient_name: input.patientName,
    verification_code: input.code,
    expiry_minutes: String(getExpiryMinutes(input.expiryMinutes)),
    manage_url: buildManageBookingUrl(),
  };
}
