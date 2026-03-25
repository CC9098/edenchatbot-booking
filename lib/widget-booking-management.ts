import "server-only";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "crypto";

import { fromZonedTime } from "date-fns-tz";

import {
  sendBookingManageAccessWhatsapp,
  sendBookingCancellationWhatsapp,
  sendBookingManageOtpWhatsapp,
  sendBookingRescheduleWhatsapp,
} from "@/lib/chatwoot-whatsapp";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import { isSlotAvailableUtc } from "@/lib/booking-helpers";
import {
  markBookingIntakeCancelledByEvent,
  markBookingIntakeRescheduledByEvent,
} from "@/lib/booking-intake-storage";
import {
  deleteEvent,
  getFreeBusy,
  moveEventToCalendar,
  updateEvent,
} from "@/lib/google-calendar";
import { buildManageBookingUrl } from "@/lib/public-url";
import { createServiceClient } from "@/lib/supabase";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";
import { getClinicWhatsappPhone } from "@/lib/whatsapp-booking";
import { CLINIC_BY_ID, isClinicId } from "@/shared/clinic-data";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const MANAGE_TOKEN_TTL_MS = 1000 * 60 * 15;
const MANAGE_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 72; // 72 hours
const OTP_MAX_ATTEMPTS = 5;
const SELF_SERVICE_CUTOFF_MS = 1000 * 60 * 60;
const STATIC_WIDGET_MANAGE_SECRET = "eden-widget-booking-manage-sign";
const STATIC_WIDGET_OTP_SECRET = "eden-widget-booking-otp-sign";
const DEFAULT_OTP_TTL_MINUTES = 10;

type BookingStatus = "pending" | "confirmed" | "cancelled" | "failed";

type WidgetBookingRow = {
  id: string;
  status: BookingStatus;
  google_event_id: string | null;
  calendar_id: string | null;
  doctor_id: string;
  doctor_name_zh: string;
  clinic_id: string;
  clinic_name_zh: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  patient_name: string;
  phone: string;
  phone_digits: string | null;
  email: string;
  visit_type: "first" | "followup";
};

type WidgetManageAction = "reschedule" | "cancel";

type WidgetVerificationRow = {
  id: string;
  phone_digits: string;
  code_hash: string;
  attempt_count: number;
  max_attempts: number;
  expires_at: string;
  consumed_at: string | null;
};

type ManageTokenPayload = {
  intakeId: string;
  bookingId: string;
  phoneDigits: string;
  expiresAtMs: number;
};

/** Phone-level access token — lets the holder skip OTP and manage all bookings for that phone. */
type ManageAccessTokenPayload = {
  type: "access";
  phoneDigits: string;
  expiresAtMs: number;
};

type WidgetBookingSummary = {
  bookingId: string;
  status: BookingStatus;
  patientName: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitType: "first" | "followup";
  clinicWhatsappUrl: string | null;
};

type WidgetManagedBooking = WidgetBookingSummary & {
  canSelfManage: boolean;
  message: string;
  manageToken?: string;
};

export type WidgetBookingLookupResult =
  | {
      success: true;
      booking: WidgetBookingSummary;
      canSelfManage: boolean;
      message: string;
      manageToken?: string;
    }
  | {
      success: false;
      error: string;
    };

export type WidgetBookingRequestCodeResult =
  | {
      success: true;
      message: string;
      maskedPhone: string;
    }
  | {
      success: false;
      error: string;
      clinicWhatsappUrl?: string | null;
    };

export type WidgetBookingVerifyCodeResult =
  | {
      success: true;
      message: string;
      maskedPhone: string;
      bookings: WidgetManagedBooking[];
    }
  | {
      success: false;
      error: string;
      clinicWhatsappUrl?: string | null;
    };

type WidgetBookingActionResult =
  | {
      success: true;
      booking: {
        bookingId: string;
        doctorId: string;
        doctorNameZh: string;
        clinicId: string;
        clinicNameZh: string;
        appointmentDate: string;
        appointmentTime: string;
        clinicWhatsappUrl: string | null;
      };
      message: string;
    }
  | {
      success: false;
      error: string;
      clinicWhatsappUrl?: string | null;
    };

const BOOKING_SELECT_FIELDS = [
  "id",
  "status",
  "google_event_id",
  "calendar_id",
  "doctor_id",
  "doctor_name_zh",
  "clinic_id",
  "clinic_name_zh",
  "appointment_date",
  "appointment_time",
  "duration_minutes",
  "patient_name",
  "phone",
  "phone_digits",
  "email",
  "visit_type",
].join(", ");

function getWidgetManageSecret() {
  return process.env.WIDGET_BOOKING_MANAGE_SECRET?.trim() || STATIC_WIDGET_MANAGE_SECRET;
}

function getWidgetOtpSecret() {
  return process.env.WIDGET_BOOKING_OTP_SECRET?.trim() || STATIC_WIDGET_OTP_SECRET;
}

function getWidgetOtpTtlMinutes() {
  const raw = Number(process.env.WIDGET_BOOKING_OTP_TTL_MINUTES);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(1, Math.floor(raw));
  }

  return DEFAULT_OTP_TTL_MINUTES;
}

function getWidgetOtpTtlMs() {
  return getWidgetOtpTtlMinutes() * 60 * 1000;
}

function getTodayInHongKongDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HONG_KONG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signManagePayload(encodedPayload: string) {
  return createHmac("sha256", getWidgetManageSecret())
    .update(`widget-booking:${encodedPayload}`)
    .digest("base64url");
}

function hashOtpCode(verificationId: string, phoneDigits: string, code: string) {
  return createHmac("sha256", getWidgetOtpSecret())
    .update(`widget-booking-otp:${verificationId}:${phoneDigits}:${code}`)
    .digest("base64url");
}

function createManageToken(payload: Omit<ManageTokenPayload, "expiresAtMs">) {
  const tokenPayload: ManageTokenPayload = {
    ...payload,
    expiresAtMs: Date.now() + MANAGE_TOKEN_TTL_MS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));
  const signature = signManagePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyManageToken(token: string) {
  const [encodedPayload, signatureRaw] = token.split(".");
  if (!encodedPayload || !signatureRaw) {
    return { success: false as const, error: "管理憑證無效，請重新驗證。" };
  }

  const expected = signManagePayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureRaw, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return { success: false as const, error: "管理憑證無效，請重新驗證。" };
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { success: false as const, error: "管理憑證無效，請重新驗證。" };
  }

  let parsed: ManageTokenPayload;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload)) as ManageTokenPayload;
  } catch {
    return { success: false as const, error: "管理憑證無效，請重新驗證。" };
  }

  if (!parsed?.intakeId || !parsed?.bookingId || !parsed?.phoneDigits) {
    return { success: false as const, error: "管理憑證無效，請重新驗證。" };
  }

  if (!Number.isFinite(parsed.expiresAtMs) || parsed.expiresAtMs <= Date.now()) {
    return { success: false as const, error: "管理時段已逾時，請重新驗證。" };
  }

  return { success: true as const, payload: parsed };
}

// ---------------------------------------------------------------------------
// Phone-level manage access token (for zero-OTP entry from WhatsApp links)
// ---------------------------------------------------------------------------

export function createManageAccessToken(
  phoneDigits: string,
  options?: { ttlMs?: number },
): string {
  const payload: ManageAccessTokenPayload = {
    type: "access",
    phoneDigits,
    expiresAtMs: Date.now() + (options?.ttlMs && options.ttlMs > 0 ? options.ttlMs : MANAGE_ACCESS_TOKEN_TTL_MS),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signManagePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyManageAccessToken(token: string): {
  success: true;
  phoneDigits: string;
} | {
  success: false;
  error: string;
} {
  const [encodedPayload, signatureRaw] = token.split(".");
  if (!encodedPayload || !signatureRaw) {
    return { success: false, error: "管理連結無效，請重新驗證。" };
  }

  const expected = signManagePayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureRaw, "utf8");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { success: false, error: "管理連結無效，請重新驗證。" };
  }

  let parsed: ManageAccessTokenPayload;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload)) as ManageAccessTokenPayload;
  } catch {
    return { success: false, error: "管理連結無效，請重新驗證。" };
  }

  if (parsed?.type !== "access" || !parsed?.phoneDigits) {
    return { success: false, error: "管理連結無效，請重新驗證。" };
  }

  if (!Number.isFinite(parsed.expiresAtMs) || parsed.expiresAtMs <= Date.now()) {
    return { success: false, error: "管理連結已過期，請重新驗證。" };
  }

  return { success: true, phoneDigits: parsed.phoneDigits };
}

/**
 * Verify a manage access token from a WhatsApp link and return bookings.
 * This allows the user to skip OTP entirely.
 */
export async function verifyManageAccessTokenAndListBookings(
  token: string,
): Promise<WidgetBookingVerifyCodeResult> {
  const result = verifyManageAccessToken(token);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const rows = await listMatchingBookingRowsByPhone(result.phoneDigits);
  if (rows.length === 0) {
    return {
      success: false,
      error: "這個電話號碼目前沒有可管理的未來預約。",
    };
  }

  const bookings = rows.map(toManagedBooking);
  return {
    success: true,
    message:
      bookings.length === 1
        ? "已驗證，請繼續管理你的預約。"
        : `已驗證，找到 ${bookings.length} 個可管理預約。`,
    maskedPhone: maskPhoneForDisplay(result.phoneDigits),
    bookings,
  };
}

function isWidgetBookingRow(value: unknown): value is WidgetBookingRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.status === "string" &&
    typeof row.doctor_id === "string" &&
    typeof row.doctor_name_zh === "string" &&
    typeof row.clinic_id === "string" &&
    typeof row.clinic_name_zh === "string" &&
    typeof row.appointment_date === "string" &&
    typeof row.appointment_time === "string" &&
    typeof row.duration_minutes === "number" &&
    typeof row.patient_name === "string" &&
    typeof row.phone === "string" &&
    (typeof row.phone_digits === "string" || row.phone_digits === null) &&
    typeof row.email === "string" &&
    typeof row.visit_type === "string"
  );
}

function isWidgetVerificationRow(value: unknown): value is WidgetVerificationRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;

  return (
    typeof row.id === "string" &&
    typeof row.phone_digits === "string" &&
    typeof row.code_hash === "string" &&
    typeof row.attempt_count === "number" &&
    typeof row.max_attempts === "number" &&
    typeof row.expires_at === "string" &&
    (typeof row.consumed_at === "string" || row.consumed_at === null)
  );
}

function getClinicWhatsappUrl(clinicId: string) {
  if (!isClinicId(clinicId)) return null;
  return CLINIC_BY_ID[clinicId].whatsappUrl || null;
}

function getAppointmentStart(row: Pick<WidgetBookingRow, "appointment_date" | "appointment_time">) {
  return fromZonedTime(
    `${row.appointment_date}T${row.appointment_time}:00`,
    HONG_KONG_TIMEZONE,
  );
}

function getSelfManageBlockMessage(row: WidgetBookingRow) {
  if (row.status === "cancelled") {
    return "這個預約已經取消，毋須再處理。";
  }

  if (!row.google_event_id || !row.calendar_id) {
    return "這個預約暫時未能自助管理，請直接 WhatsApp 聯絡姑娘。";
  }

  const startAt = getAppointmentStart(row);
  if (Number.isNaN(startAt.getTime())) {
    return "這個預約暫時未能自助管理，請直接 WhatsApp 聯絡姑娘。";
  }

  if (startAt.getTime() - Date.now() <= SELF_SERVICE_CUTOFF_MS) {
    return "距離預約時間少於 1 小時，請直接 WhatsApp 聯絡姑娘協助更改或取消。";
  }

  return "";
}

function canSelfManage(row: WidgetBookingRow) {
  return getSelfManageBlockMessage(row) === "";
}

function getRowPhoneDigits(row: Pick<WidgetBookingRow, "phone" | "phone_digits">) {
  return row.phone_digits || normalizePhoneForSearch(row.phone);
}

function toWidgetBookingSummary(row: WidgetBookingRow): WidgetBookingSummary {
  return {
    bookingId: row.google_event_id || row.id,
    status: row.status,
    patientName: row.patient_name,
    doctorId: row.doctor_id,
    doctorNameZh: row.doctor_name_zh,
    clinicId: row.clinic_id,
    clinicNameZh: row.clinic_name_zh,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    durationMinutes: row.duration_minutes,
    visitType: row.visit_type,
    clinicWhatsappUrl: getClinicWhatsappUrl(row.clinic_id),
  };
}

function toManagedBooking(row: WidgetBookingRow): WidgetManagedBooking {
  const allowed = canSelfManage(row);
  const phoneDigits = getRowPhoneDigits(row);

  return {
    ...toWidgetBookingSummary(row),
    canSelfManage: allowed,
    message: allowed
      ? "已驗證，可繼續自助處理。"
      : getSelfManageBlockMessage(row),
    ...(allowed
      ? {
          manageToken: createManageToken({
            intakeId: row.id,
            bookingId: row.google_event_id || row.id,
            phoneDigits,
          }),
        }
      : {}),
  };
}

function maskPhoneForDisplay(phoneDigits: string) {
  if (!phoneDigits) return "";

  if (phoneDigits.startsWith("852") && phoneDigits.length >= 7) {
    const local = phoneDigits.slice(3);
    return `+852 ${local.slice(0, 2)}****${local.slice(-2)}`;
  }

  if (phoneDigits.length <= 4) {
    return phoneDigits;
  }

  return `${phoneDigits.slice(0, 2)}****${phoneDigits.slice(-2)}`;
}

function getWhatsappContactEmail(row: WidgetBookingRow) {
  const normalizedEmail = row.email.trim().toLowerCase();
  if (normalizedEmail) {
    return normalizedEmail;
  }

  return `patient-${getRowPhoneDigits(row)}@manage.edenclinic.invalid`;
}

function normalizeVerificationCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

async function listMatchingBookingRowsByPhone(phone: string): Promise<WidgetBookingRow[]> {
  const phoneDigits = normalizePhoneForSearch(phone);
  if (!phoneDigits) {
    return [];
  }

  const supabase = createServiceClient();
  const today = getTodayInHongKongDate();

  const directResult = await supabase
    .from("booking_intake")
    .select(BOOKING_SELECT_FIELDS)
    .eq("phone_digits", phoneDigits)
    .in("status", ["pending", "confirmed"])
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(20);

  if (directResult.error) {
    throw new Error(directResult.error.message);
  }

  const directRows = Array.isArray(directResult.data)
    ? (directResult.data as unknown[]).filter(isWidgetBookingRow)
    : [];
  if (directRows.length > 0) {
    return directRows;
  }

  const fallbackResult = await supabase
    .from("booking_intake")
    .select(BOOKING_SELECT_FIELDS)
    .in("status", ["pending", "confirmed"])
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(200);

  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message);
  }

  return Array.isArray(fallbackResult.data)
    ? (fallbackResult.data as unknown[])
        .filter(isWidgetBookingRow)
        .filter((row) => getRowPhoneDigits(row) === phoneDigits)
    : [];
}

async function findMatchingBookingRow(
  bookingId: string,
  phone: string,
): Promise<WidgetBookingRow | null> {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    return null;
  }

  const rows = await listMatchingBookingRowsByPhone(phone);
  return rows.find((row) => row.google_event_id === normalizedBookingId || row.id === normalizedBookingId) || null;
}

async function invalidateExistingPhoneVerifications(phoneDigits: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("widget_booking_verifications")
    .update({
      consumed_at: now,
      updated_at: now,
    })
    .eq("phone_digits", phoneDigits)
    .eq("purpose", "manage_booking")
    .is("consumed_at", null);

  if (error) {
    throw new Error(error.message);
  }
}

async function getLatestActiveVerification(phoneDigits: string): Promise<WidgetVerificationRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("widget_booking_verifications")
    .select("id, phone_digits, code_hash, attempt_count, max_attempts, expires_at, consumed_at")
    .eq("phone_digits", phoneDigits)
    .eq("purpose", "manage_booking")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return isWidgetVerificationRow(data) ? data : null;
}

async function markVerificationConsumed(id: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("widget_booking_verifications")
    .update({
      consumed_at: now,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function registerVerificationFailure(row: WidgetVerificationRow) {
  const supabase = createServiceClient();
  const nextAttemptCount = row.attempt_count + 1;
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    attempt_count: nextAttemptCount,
    updated_at: now,
  };

  if (nextAttemptCount >= row.max_attempts) {
    payload.consumed_at = now;
  }

  const { error } = await supabase
    .from("widget_booking_verifications")
    .update(payload)
    .eq("id", row.id);

  if (error) {
    throw new Error(error.message);
  }

  if (nextAttemptCount >= row.max_attempts) {
    return "驗證碼輸入錯誤次數過多，請重新索取新驗證碼。";
  }

  return "驗證碼不正確，請重新輸入。";
}

async function getBookingRowByManageToken(
  token: string,
): Promise<
  | { success: true; row: WidgetBookingRow }
  | { success: false; error: string }
> {
  const tokenResult = verifyManageToken(token);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("booking_intake")
    .select(BOOKING_SELECT_FIELDS)
    .eq("id", tokenResult.payload.intakeId)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  if (!isWidgetBookingRow(data)) {
    return { success: false, error: "找不到對應預約，請重新驗證。" };
  }

  if (getRowPhoneDigits(data) !== tokenResult.payload.phoneDigits) {
    return { success: false, error: "驗證資料不符，請重新驗證。" };
  }

  return { success: true, row: data };
}

export async function requestWidgetBookingVerificationCode(
  phone: string,
): Promise<WidgetBookingRequestCodeResult> {
  try {
    const phoneDigits = normalizePhoneForSearch(phone);
    if (!phoneDigits) {
      return { success: false, error: "請輸入有效的 WhatsApp 電話號碼。" };
    }

    const rows = await listMatchingBookingRowsByPhone(phoneDigits);
    if (rows.length === 0) {
      return {
        success: false,
        error: "這個電話號碼暫時找不到可管理的未來預約。",
      };
    }

    const primaryRow = rows[0];
    const verificationId = randomUUID();
    const verificationCode = String(randomInt(0, 1000000)).padStart(6, "0");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + getWidgetOtpTtlMs()).toISOString();

    await invalidateExistingPhoneVerifications(phoneDigits);

    const supabase = createServiceClient();
    const { error: insertError } = await supabase
      .from("widget_booking_verifications")
      .insert({
        id: verificationId,
        phone_digits: phoneDigits,
        purpose: "manage_booking",
        code_hash: hashOtpCode(verificationId, phoneDigits, verificationCode),
        attempt_count: 0,
        max_attempts: OTP_MAX_ATTEMPTS,
        delivery_channel: "whatsapp",
        expires_at: expiresAt,
        metadata: {
          booking_count: rows.length,
          primary_booking_intake_id: primaryRow.id,
        },
        updated_at: now,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    const whatsappResult = await sendBookingManageOtpWhatsapp({
      patientName: primaryRow.patient_name,
      phone: primaryRow.phone,
      email: getWhatsappContactEmail(primaryRow),
      code: verificationCode,
      expiryMinutes: getWidgetOtpTtlMinutes(),
      clinicWhatsappPhone: getClinicWhatsappPhone(primaryRow.clinic_id),
    });

    if (!whatsappResult.success) {
      await markVerificationConsumed(verificationId).catch(() => undefined);
      return {
        success: false,
        error: "驗證碼暫時未能送出，請稍後再試或直接 WhatsApp 聯絡姑娘。",
        clinicWhatsappUrl: getClinicWhatsappUrl(primaryRow.clinic_id),
      };
    }

    return {
      success: true,
      message: `驗證碼已發送到 ${maskPhoneForDisplay(phoneDigits)} 的 WhatsApp。`,
      maskedPhone: maskPhoneForDisplay(phoneDigits),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "發送驗證碼時發生錯誤。",
    };
  }
}

export async function requestWidgetBookingManageLink(params: {
  phone: string;
  action?: WidgetManageAction | null;
}): Promise<WidgetBookingRequestCodeResult> {
  try {
    const phoneDigits = normalizePhoneForSearch(params.phone);
    if (!phoneDigits) {
      return { success: false, error: "請輸入有效的 WhatsApp 電話號碼。" };
    }

    const rows = await listMatchingBookingRowsByPhone(phoneDigits);
    if (rows.length === 0) {
      return {
        success: false,
        error: "這個電話號碼暫時找不到可管理的未來預約。",
      };
    }

    const primaryRow = rows[0];
    const manageAccessToken = createManageAccessToken(phoneDigits, {
      ttlMs: getWidgetOtpTtlMs(),
    });
    const manageUrl = buildManageBookingUrl({
      action: params.action || undefined,
      token: manageAccessToken,
    });

    const whatsappResult = await sendBookingManageAccessWhatsapp({
      patientName: primaryRow.patient_name,
      phone: primaryRow.phone,
      email: getWhatsappContactEmail(primaryRow),
      manageUrl,
      clinicWhatsappPhone: getClinicWhatsappPhone(primaryRow.clinic_id),
    });

    if (!whatsappResult.success) {
      return {
        success: false,
        error: "登入連結暫時未能送出，請稍後再試或直接 WhatsApp 聯絡姑娘。",
        clinicWhatsappUrl: getClinicWhatsappUrl(primaryRow.clinic_id),
      };
    }

    return {
      success: true,
      message: `登入連結已發送到 ${maskPhoneForDisplay(phoneDigits)} 的 WhatsApp。`,
      maskedPhone: maskPhoneForDisplay(phoneDigits),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "發送登入連結時發生錯誤。",
    };
  }
}

export async function verifyWidgetBookingVerificationCode(params: {
  phone: string;
  code: string;
}): Promise<WidgetBookingVerifyCodeResult> {
  try {
    const phoneDigits = normalizePhoneForSearch(params.phone);
    const code = normalizeVerificationCode(params.code);
    if (!phoneDigits) {
      return { success: false, error: "請輸入有效的 WhatsApp 電話號碼。" };
    }

    if (code.length !== 6) {
      return { success: false, error: "請輸入 6 位數驗證碼。" };
    }

    const verification = await getLatestActiveVerification(phoneDigits);
    if (!verification) {
      return { success: false, error: "驗證碼已失效，請重新索取。" };
    }

    const expiresAtMs = new Date(verification.expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      await markVerificationConsumed(verification.id).catch(() => undefined);
      return { success: false, error: "驗證碼已過期，請重新索取。" };
    }

    const expected = Buffer.from(hashOtpCode(verification.id, phoneDigits, code), "utf8");
    const actual = Buffer.from(verification.code_hash, "utf8");
    const isMatch = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!isMatch) {
      return { success: false, error: await registerVerificationFailure(verification) };
    }

    await markVerificationConsumed(verification.id);

    const rows = await listMatchingBookingRowsByPhone(phoneDigits);
    if (rows.length === 0) {
      return {
        success: false,
        error: "已完成驗證，但這個電話號碼目前沒有可管理的未來預約。",
      };
    }

    const bookings = rows.map(toManagedBooking);

    return {
      success: true,
      message:
        bookings.length === 1
          ? "已完成驗證，請繼續管理你的預約。"
          : `已完成驗證，找到 ${bookings.length} 個可管理預約。`,
      maskedPhone: maskPhoneForDisplay(phoneDigits),
      bookings,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "驗證預約時發生錯誤。",
    };
  }
}

export async function lookupWidgetBooking(
  bookingId: string,
  phone: string,
): Promise<WidgetBookingLookupResult> {
  try {
    const row = await findMatchingBookingRow(bookingId, phone);
    if (!row) {
      return {
        success: false,
        error: "找不到預約，請確認預約編號及電話號碼是否正確。",
      };
    }

    const managedBooking = toManagedBooking(row);

    return {
      success: true,
      booking: toWidgetBookingSummary(row),
      canSelfManage: managedBooking.canSelfManage,
      message: managedBooking.message,
      ...(managedBooking.manageToken ? { manageToken: managedBooking.manageToken } : {}),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "查詢預約時發生錯誤。",
    };
  }
}

export async function cancelWidgetBooking(
  manageToken: string,
): Promise<WidgetBookingActionResult> {
  const rowResult = await getBookingRowByManageToken(manageToken);
  if (!rowResult.success) {
    return { success: false, error: rowResult.error };
  }

  const { row } = rowResult;
  const clinicWhatsappUrl = getClinicWhatsappUrl(row.clinic_id);
  const blockedMessage = getSelfManageBlockMessage(row);
  if (blockedMessage) {
    return {
      success: false,
      error: blockedMessage,
      clinicWhatsappUrl,
    };
  }

  if (!row.google_event_id || !row.calendar_id) {
    return {
      success: false,
      error: "這個預約暫時未能自助取消，請直接 WhatsApp 聯絡姑娘。",
      clinicWhatsappUrl,
    };
  }

  const cancelResult = await deleteEvent(row.calendar_id, row.google_event_id);
  if (!cancelResult.success) {
    return {
      success: false,
      error: cancelResult.error || "取消預約失敗，請稍後再試。",
      clinicWhatsappUrl,
    };
  }

  const intakeSync = await markBookingIntakeCancelledByEvent({
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
  });
  if (!intakeSync.success) {
    console.warn(`[widget-booking-management] cancel sync warning: ${intakeSync.error}`);
  }

  // Fire-and-forget WhatsApp cancellation notification
  sendBookingCancellationWhatsapp({
    bookingId: row.google_event_id || row.id,
    patientName: row.patient_name,
    doctorNameZh: row.doctor_name_zh,
    clinicNameZh: row.clinic_name_zh,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    phone: row.phone,
    email: row.email,
    clinicWhatsappPhone: getClinicWhatsappPhone(row.clinic_id),
  }).catch((error) => {
    console.warn(`[widget-booking-management] cancel WhatsApp notification failed: ${error}`);
  });

  return {
    success: true,
    booking: {
      bookingId: row.google_event_id,
      doctorId: row.doctor_id,
      doctorNameZh: row.doctor_name_zh,
      clinicId: row.clinic_id,
      clinicNameZh: row.clinic_name_zh,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      clinicWhatsappUrl,
    },
    message: "預約已取消。如需重新安排，可以重新開始預約流程。",
  };
}

export async function rescheduleWidgetBooking(params: {
  manageToken: string;
  date: string;
  time: string;
}): Promise<WidgetBookingActionResult> {
  const rowResult = await getBookingRowByManageToken(params.manageToken);
  if (!rowResult.success) {
    return { success: false, error: rowResult.error };
  }

  const { row } = rowResult;
  const clinicWhatsappUrl = getClinicWhatsappUrl(row.clinic_id);
  const blockedMessage = getSelfManageBlockMessage(row);
  if (blockedMessage) {
    return {
      success: false,
      error: blockedMessage,
      clinicWhatsappUrl,
    };
  }

  if (!row.google_event_id || !row.calendar_id) {
    return {
      success: false,
      error: "這個預約暫時未能自助改期，請直接 WhatsApp 聯絡姑娘。",
      clinicWhatsappUrl,
    };
  }

  const startDate = fromZonedTime(
    `${params.date}T${params.time}:00`,
    HONG_KONG_TIMEZONE,
  );
  if (Number.isNaN(startDate.getTime())) {
    return { success: false, error: "日期或時間格式不正確。" };
  }
  const endDate = new Date(startDate.getTime() + row.duration_minutes * 60000);

  const sameAsCurrentSlot =
    row.appointment_date === params.date && row.appointment_time === params.time;

  let nextEventId = row.google_event_id;
  let nextCalendarId = row.calendar_id;
  let result:
    | { success: true; eventId?: string }
    | { success: false; error?: string };

  if (row.clinic_id === "online") {
    const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
      doctorId: row.doctor_id,
      requestedDate: params.date,
      time: params.time,
      durationMinutes: row.duration_minutes,
      preferredCalendarId: row.calendar_id,
    });

    if (resolvedOnlineMapping.errorCode === "CALENDAR_UNAVAILABLE") {
      return {
        success: false,
        error: "暫時未能讀取預約日曆，請稍後再試或直接 WhatsApp 聯絡姑娘。",
        clinicWhatsappUrl,
      };
    }

    if (!resolvedOnlineMapping.mapping) {
      return {
        success: false,
        error: "這個時段剛剛已滿，請選擇其他時段。",
      };
    }

    const targetCalendarId = resolvedOnlineMapping.mapping.calendarId;
    if (targetCalendarId === row.calendar_id) {
      result = await updateEvent(row.calendar_id, row.google_event_id, {
        startTime: startDate,
        endTime: endDate,
      });
    } else {
      result = await moveEventToCalendar(row.calendar_id, targetCalendarId, row.google_event_id, {
        startTime: startDate,
        endTime: endDate,
      });
      if (result.success) {
        nextEventId = result.eventId || row.google_event_id;
        nextCalendarId = targetCalendarId;
      }
    }
  } else {
    if (!sameAsCurrentSlot) {
      try {
        const requestedDayUtc = fromZonedTime(
          `${params.date}T00:00:00`,
          HONG_KONG_TIMEZONE,
        );
        const busySlots = await getFreeBusy(row.calendar_id, requestedDayUtc);
        const isStillAvailable = isSlotAvailableUtc(startDate, endDate, busySlots);
        if (!isStillAvailable) {
          return {
            success: false,
            error: "這個時段剛剛已滿，請選擇其他時段。",
          };
        }
      } catch {
        return {
          success: false,
          error: "暫時未能讀取預約日曆，請稍後再試或直接 WhatsApp 聯絡姑娘。",
          clinicWhatsappUrl,
        };
      }
    }

    result = await updateEvent(row.calendar_id, row.google_event_id, {
      startTime: startDate,
      endTime: endDate,
    });
  }

  if (!result.success) {
    return {
      success: false,
      error: result.error || "改期失敗，請稍後再試。",
      clinicWhatsappUrl,
    };
  }

  const intakeSync = await markBookingIntakeRescheduledByEvent({
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
    appointmentDate: params.date,
    appointmentTime: params.time,
    durationMinutes: row.duration_minutes,
    nextGoogleEventId: nextEventId !== row.google_event_id ? nextEventId : undefined,
    nextCalendarId: nextCalendarId !== row.calendar_id ? nextCalendarId : undefined,
  });
  if (!intakeSync.success) {
    console.warn(`[widget-booking-management] reschedule sync warning: ${intakeSync.error}`);
  }

  // Fire-and-forget WhatsApp reschedule notification
  sendBookingRescheduleWhatsapp({
    bookingId: nextEventId || row.id,
    patientName: row.patient_name,
    doctorNameZh: row.doctor_name_zh,
    clinicNameZh: row.clinic_name_zh,
    oldDate: row.appointment_date,
    oldTime: row.appointment_time,
    newDate: params.date,
    newTime: params.time,
    phone: row.phone,
    email: row.email,
    clinicWhatsappPhone: getClinicWhatsappPhone(row.clinic_id),
  }).catch((error) => {
    console.warn(`[widget-booking-management] reschedule WhatsApp notification failed: ${error}`);
  });

  return {
    success: true,
    booking: {
      bookingId: nextEventId,
      doctorId: row.doctor_id,
      doctorNameZh: row.doctor_name_zh,
      clinicId: row.clinic_id,
      clinicNameZh: row.clinic_name_zh,
      appointmentDate: params.date,
      appointmentTime: params.time,
      clinicWhatsappUrl,
    },
    message: "預約已更改成功。",
  };
}
