import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { fromZonedTime } from "date-fns-tz";

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
import { createServiceClient } from "@/lib/supabase";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";
import { CLINIC_BY_ID, isClinicId } from "@/shared/clinic-data";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const MANAGE_TOKEN_TTL_MS = 1000 * 60 * 15;
const SELF_SERVICE_CUTOFF_MS = 1000 * 60 * 60;
const STATIC_WIDGET_MANAGE_SECRET = "eden-widget-booking-manage-sign";

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
  email: string;
  visit_type: "first" | "followup";
};

type ManageTokenPayload = {
  intakeId: string;
  bookingId: string;
  phoneDigits: string;
  expiresAtMs: number;
};

export type WidgetBookingLookupResult =
  | {
      success: true;
      booking: {
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
      canSelfManage: boolean;
      message: string;
      manageToken?: string;
    }
  | {
      success: false;
      error: string;
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

function getWidgetManageSecret() {
  return process.env.WIDGET_BOOKING_MANAGE_SECRET?.trim() || STATIC_WIDGET_MANAGE_SECRET;
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
    return { success: false as const, error: "管理憑證無效，請重新查詢預約。" };
  }

  const expected = signManagePayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureRaw, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return { success: false as const, error: "管理憑證無效，請重新查詢預約。" };
  }

  if (!timingSafeEqual(expectedBuffer, actualBuffer)) {
    return { success: false as const, error: "管理憑證無效，請重新查詢預約。" };
  }

  let parsed: ManageTokenPayload;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload)) as ManageTokenPayload;
  } catch {
    return { success: false as const, error: "管理憑證無效，請重新查詢預約。" };
  }

  if (!parsed?.intakeId || !parsed?.bookingId || !parsed?.phoneDigits) {
    return { success: false as const, error: "管理憑證無效，請重新查詢預約。" };
  }

  if (!Number.isFinite(parsed.expiresAtMs) || parsed.expiresAtMs <= Date.now()) {
    return { success: false as const, error: "管理逾時，請重新查詢預約。" };
  }

  return { success: true as const, payload: parsed };
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
    typeof row.patient_name === "string" &&
    typeof row.phone === "string" &&
    typeof row.email === "string" &&
    typeof row.visit_type === "string"
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

async function findMatchingBookingRow(
  bookingId: string,
  phone: string,
): Promise<WidgetBookingRow | null> {
  const normalizedBookingId = bookingId.trim();
  const phoneDigits = normalizePhoneForSearch(phone);
  if (!normalizedBookingId || !phoneDigits) {
    return null;
  }

  const supabase = createServiceClient();
  const selectFields = [
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
    "email",
    "visit_type",
  ].join(", ");

  const queries = [
    supabase
      .from("booking_intake")
      .select(selectFields)
      .eq("google_event_id", normalizedBookingId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("booking_intake")
      .select(selectFields)
      .eq("id", normalizedBookingId)
      .order("created_at", { ascending: false })
      .limit(1),
  ];

  for (const query of queries) {
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const rows: WidgetBookingRow[] = Array.isArray(data)
      ? (data as unknown[]).filter(isWidgetBookingRow)
      : [];
    const matched = rows.find(
      (row) => normalizePhoneForSearch(row.phone) === phoneDigits,
    );
    if (matched) {
      return matched;
    }
  }

  return null;
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
    .select(
      [
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
        "email",
        "visit_type",
      ].join(", "),
    )
    .eq("id", tokenResult.payload.intakeId)
    .maybeSingle();

  if (error) {
    return { success: false as const, error: error.message };
  }

  if (!isWidgetBookingRow(data)) {
    return { success: false as const, error: "找不到對應預約，請重新查詢。" };
  }

  if (normalizePhoneForSearch(data.phone) !== tokenResult.payload.phoneDigits) {
    return { success: false as const, error: "驗證資料不符，請重新查詢預約。" };
  }

  return { success: true as const, row: data };
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

    const allowed = canSelfManage(row);
    const message = allowed
      ? "已找到你的預約，可以繼續自助處理。"
      : getSelfManageBlockMessage(row);

    return {
      success: true,
      booking: {
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
      },
      canSelfManage: allowed,
      message,
      ...(allowed
        ? {
            manageToken: createManageToken({
              intakeId: row.id,
              bookingId: row.google_event_id || row.id,
              phoneDigits: normalizePhoneForSearch(row.phone),
            }),
          }
        : {}),
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
