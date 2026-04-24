import { createHmac, randomInt, randomUUID, timingSafeEqual } from "crypto";

import { sendBookingManageOtpWhatsapp } from "@/lib/chatwoot-whatsapp";
import { normalizePhoneForSearch, toHKE164 } from "@/lib/contact-utils";
import { createServiceClient } from "@/lib/supabase";
import {
  ensureSupabaseUserForPhone,
  establishSessionForUser,
  type CookieSetter,
} from "@/lib/whatsapp-auth-bridge";

const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MINUTES = 10;
const DEFAULT_CLINIC_WHATSAPP_PHONE = "85267333234";

function getOtpSecret() {
  return process.env.WIDGET_BOOKING_OTP_SECRET?.trim() || "eden-widget-booking-otp-sign";
}

function getPhoneDigitVariants(digits: string): string[] {
  if (!digits) return [];
  const variants = new Set<string>([digits]);
  if (digits.startsWith("852") && digits.length === 11) variants.add(digits.slice(3));
  if (digits.length === 8) variants.add(`852${digits}`);
  return [...variants];
}

function hashOtpCode(verificationId: string, phoneDigits: string, code: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(`widget-booking-otp:${verificationId}:${phoneDigits}:${code}`)
    .digest("base64url");
}

function maskPhone(digits: string): string {
  if (!digits) return "";
  if (digits.startsWith("852") && digits.length >= 7) {
    const local = digits.slice(3);
    return `+852 ${local.slice(0, 2)}****${local.slice(-2)}`;
  }
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

async function invalidateExistingLoginVerifications(phoneDigits: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("widget_booking_verifications")
    .update({ consumed_at: now, updated_at: now })
    .in("phone_digits", getPhoneDigitVariants(phoneDigits))
    .eq("purpose", "login")
    .is("consumed_at", null);
  if (error) throw new Error(error.message);
}

type VerificationRow = {
  id: string;
  phone_digits: string;
  code_hash: string;
  attempt_count: number;
  max_attempts: number;
  expires_at: string;
  consumed_at: string | null;
};

async function getLatestActiveLoginVerification(
  phoneDigits: string,
): Promise<VerificationRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("widget_booking_verifications")
    .select("id, phone_digits, code_hash, attempt_count, max_attempts, expires_at, consumed_at")
    .in("phone_digits", getPhoneDigitVariants(phoneDigits))
    .eq("purpose", "login")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const first = Array.isArray(data) ? data[0] : null;
  if (!first || typeof first.id !== "string") return null;
  return first as VerificationRow;
}

async function markConsumed(id: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("widget_booking_verifications")
    .update({ consumed_at: now, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RequestLoginOtpResult =
  | { success: true; message: string; maskedPhone: string }
  | { success: false; error: string };

export type VerifyLoginOtpResult =
  | { success: true; userId: string }
  | { success: false; error: string };

export async function requestLoginOtp(phone: string): Promise<RequestLoginOtpResult> {
  try {
    const phoneDigits = normalizePhoneForSearch(phone);
    if (!phoneDigits || phoneDigits.length < 6) {
      return { success: false, error: "請輸入有效的 WhatsApp 電話號碼。" };
    }

    const verificationId = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    await invalidateExistingLoginVerifications(phoneDigits);

    const supabase = createServiceClient();
    const { error: insertError } = await supabase.from("widget_booking_verifications").insert({
      id: verificationId,
      phone_digits: phoneDigits,
      purpose: "login",
      code_hash: hashOtpCode(verificationId, phoneDigits, code),
      attempt_count: 0,
      max_attempts: OTP_MAX_ATTEMPTS,
      delivery_channel: "whatsapp",
      expires_at: expiresAt,
      metadata: {},
      updated_at: now,
    });

    if (insertError) throw new Error(insertError.message);

    const e164 = toHKE164(phone);

    const whatsappResult = await sendBookingManageOtpWhatsapp({
      patientName: "用戶",
      phone: e164,
      email: "",
      code,
      expiryMinutes: OTP_TTL_MINUTES,
      clinicWhatsappPhone: DEFAULT_CLINIC_WHATSAPP_PHONE,
    });

    if (!whatsappResult.success) {
      await markConsumed(verificationId).catch(() => undefined);
      return { success: false, error: "驗證碼暫時未能送出，請稍後再試。" };
    }

    return {
      success: true,
      message: `驗證碼已發送到 ${maskPhone(phoneDigits)} 的 WhatsApp。`,
      maskedPhone: maskPhone(phoneDigits),
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "發送驗證碼時發生錯誤。",
    };
  }
}

export async function verifyLoginOtp(params: {
  phone: string;
  code: string;
  setCookie?: CookieSetter;
}): Promise<VerifyLoginOtpResult> {
  try {
    const phoneDigits = normalizePhoneForSearch(params.phone);
    const code = params.code.replace(/\D/g, "").trim();

    if (!phoneDigits || phoneDigits.length < 6) {
      return { success: false, error: "請輸入有效的 WhatsApp 電話號碼。" };
    }
    if (code.length !== 6) {
      return { success: false, error: "請輸入 6 位數驗證碼。" };
    }

    const verification = await getLatestActiveLoginVerification(phoneDigits);
    if (!verification) {
      return { success: false, error: "驗證碼已失效，請重新索取。" };
    }

    const expiresAtMs = new Date(verification.expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await markConsumed(verification.id).catch(() => undefined);
      return { success: false, error: "驗證碼已過期，請重新索取。" };
    }

    const expected = Buffer.from(
      hashOtpCode(verification.id, verification.phone_digits, code),
      "utf8",
    );
    const actual = Buffer.from(verification.code_hash, "utf8");
    const isMatch =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!isMatch) {
      const nextCount = verification.attempt_count + 1;
      const supabase = createServiceClient();
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { attempt_count: nextCount, updated_at: now };
      if (nextCount >= verification.max_attempts) patch.consumed_at = now;
      await supabase
        .from("widget_booking_verifications")
        .update(patch)
        .eq("id", verification.id);
      const remaining = verification.max_attempts - nextCount;
      return {
        success: false,
        error:
          remaining > 0
            ? `驗證碼不正確，還有 ${remaining} 次嘗試機會。`
            : "驗證碼不正確，已超過最多嘗試次數，請重新索取。",
      };
    }

    await markConsumed(verification.id);

    const digitsRaw = verification.phone_digits;
    const phoneE164 = toHKE164(digitsRaw);

    const userResult = await ensureSupabaseUserForPhone({
      phoneDigits: digitsRaw,
      phoneE164,
    });

    if (userResult.error) {
      return { success: false, error: "驗證成功，但無法建立用戶帳戶，請稍後再試。" };
    }

    const { userId } = userResult;

    if (params.setCookie) {
      const sessionResult = await establishSessionForUser(userId, params.setCookie);
      if (!sessionResult.success) {
        return { success: false, error: "驗證成功，但無法建立登入會話，請稍後再試。" };
      }
    }

    return { success: true, userId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "驗證時發生錯誤。",
    };
  }
}
