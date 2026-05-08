import "server-only";

import { fromZonedTime } from "date-fns-tz";

import { sendBookingCancellationWhatsapp, sendBookingRescheduleWhatsapp } from "@/lib/chatwoot-whatsapp";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import { sendBookingCancellationEmail } from "@/lib/gmail";
import { deleteEvent, getFreeBusy, moveEventToCalendar, updateEvent } from "@/lib/google-calendar";
import { buildManageBookingUrl } from "@/lib/public-url";
import { createServiceClient } from "@/lib/supabase";
import { getMappingWithFallback } from "@/lib/storage-helpers";
import { resolveOnlineSourceMappingForSlot } from "@/lib/virtual-online-booking";
import { createManageAccessToken } from "@/lib/widget-manage-token";
import { getClinicWhatsappPhone } from "@/lib/whatsapp-booking";
import {
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotAvailableUtc,
  isSlotBlockedBySameDayEveningCutoffUtc,
} from "@/lib/booking-helpers";
import {
  CLINIC_BY_ID,
  DOCTOR_BY_ID,
  getClinicAddress,
  isClinicId,
} from "@/shared/clinic-data";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

export type StaffBookingStatus = "pending" | "confirmed" | "cancelled" | "failed";

type BookingIntakeRow = {
  id: string;
  source: string;
  status: StaffBookingStatus;
  failure_reason: string | null;
  user_id: string | null;
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
  need_receipt: string;
  medication_pickup: string;
  id_card: string | null;
  dob: string | null;
  gender: string | null;
  allergies: string | null;
  medications: string | null;
  symptoms: string | null;
  referral_source: string | null;
  notes: string | null;
  booking_payload: Record<string, unknown> | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  last_rescheduled_at: string | null;
  reschedule_count: number | null;
  created_at: string;
  updated_at: string;
};

const BOOKING_SELECT_FIELDS = [
  "id",
  "source",
  "status",
  "failure_reason",
  "user_id",
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
  "need_receipt",
  "medication_pickup",
  "id_card",
  "dob",
  "gender",
  "allergies",
  "medications",
  "symptoms",
  "referral_source",
  "notes",
  "booking_payload",
  "confirmed_at",
  "cancelled_at",
  "last_rescheduled_at",
  "reschedule_count",
  "created_at",
  "updated_at",
].join(", ");

export type StaffBookingListItem = {
  id: string;
  source: string;
  status: StaffBookingStatus;
  patientUserId: string | null;
  patientName: string;
  phone: string;
  email: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  visitType: "first" | "followup";
  needReceipt: string;
  medicationPickup: string;
  failureReason: string | null;
  notes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  lastRescheduledAt: string | null;
  rescheduleCount: number;
  createdAt: string;
  updatedAt: string;
  canStaffCancel: boolean;
  canStaffReschedule: boolean;
};

export type StaffBookingDetail = StaffBookingListItem & {
  googleEventId: string | null;
  calendarId: string | null;
  idCard: string | null;
  dob: string | null;
  gender: string | null;
  allergies: string | null;
  medications: string | null;
  symptoms: string | null;
  referralSource: string | null;
  bookingPayload: Record<string, unknown> | null;
  manageUrl: string;
  manageRescheduleUrl: string;
  manageCancelUrl: string;
  clinicWhatsappPhone: string | null;
};

export type StaffBookingListStats = {
  total: number;
  today: number;
  upcoming: number;
  attention: number;
  rescheduled: number;
};

export type StaffBookingListResult = {
  items: StaffBookingListItem[];
  stats: StaffBookingListStats;
};

type ListFilters = {
  q?: string;
  status?: string;
  doctorId?: string;
  clinicId?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type RescheduleInput = {
  date: string;
  time: string;
  clinicId?: string;
};

type StaffBookingMutationResult = {
  booking: StaffBookingDetail;
  warnings: string[];
};

function getRowPhoneDigits(row: BookingIntakeRow): string {
  return row.phone_digits || normalizePhoneForSearch(row.phone);
}

function canManageRow(row: BookingIntakeRow): boolean {
  return Boolean(row.google_event_id && row.calendar_id) && row.status !== "cancelled" && row.status !== "failed";
}

function mapListItem(row: BookingIntakeRow): StaffBookingListItem {
  const manageable = canManageRow(row);

  return {
    id: row.id,
    source: row.source,
    status: row.status,
    patientUserId: row.user_id,
    patientName: row.patient_name,
    phone: row.phone,
    email: row.email,
    doctorId: row.doctor_id,
    doctorNameZh: row.doctor_name_zh,
    clinicId: row.clinic_id,
    clinicNameZh: row.clinic_name_zh,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    durationMinutes: row.duration_minutes,
    visitType: row.visit_type,
    needReceipt: row.need_receipt,
    medicationPickup: row.medication_pickup,
    failureReason: row.failure_reason,
    notes: row.notes,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    lastRescheduledAt: row.last_rescheduled_at,
    rescheduleCount: typeof row.reschedule_count === "number" ? row.reschedule_count : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canStaffCancel: manageable,
    canStaffReschedule: manageable,
  };
}

function mapDetail(row: BookingIntakeRow): StaffBookingDetail {
  const phoneDigits = getRowPhoneDigits(row);
  const manageToken = phoneDigits ? createManageAccessToken(phoneDigits) : null;
  const listItem = mapListItem(row);

  return {
    ...listItem,
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
    idCard: row.id_card,
    dob: row.dob,
    gender: row.gender,
    allergies: row.allergies,
    medications: row.medications,
    symptoms: row.symptoms,
    referralSource: row.referral_source,
    bookingPayload: row.booking_payload,
    manageUrl: manageToken ? buildManageBookingUrl({ token: manageToken }) : buildManageBookingUrl(),
    manageRescheduleUrl: manageToken
      ? buildManageBookingUrl({ action: "reschedule", token: manageToken })
      : buildManageBookingUrl({ action: "reschedule" }),
    manageCancelUrl: manageToken
      ? buildManageBookingUrl({ action: "cancel", token: manageToken })
      : buildManageBookingUrl({ action: "cancel" }),
    clinicWhatsappPhone: getClinicWhatsappPhone(row.clinic_id),
  };
}

function matchesSearch(row: BookingIntakeRow, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const digits = normalizePhoneForSearch(query);
  const haystacks = [
    row.id,
    row.patient_name,
    row.phone,
    row.email,
    row.doctor_name_zh,
    row.clinic_name_zh,
    row.source,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (haystacks.some((value) => value.includes(normalized))) {
    return true;
  }

  return digits.length >= 4 && getRowPhoneDigits(row).includes(digits);
}

function buildStats(rows: BookingIntakeRow[]): StaffBookingListStats {
  const today = new Date().toISOString().slice(0, 10);

  return {
    total: rows.length,
    today: rows.filter((row) => row.appointment_date === today).length,
    upcoming: rows.filter((row) => row.status === "confirmed" && row.appointment_date >= today).length,
    attention: rows.filter((row) => row.status === "failed" || row.status === "pending" || (row.reschedule_count || 0) >= 2).length,
    rescheduled: rows.filter((row) => (row.reschedule_count || 0) > 0).length,
  };
}

async function fetchBookingRowById(bookingId: string): Promise<BookingIntakeRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("booking_intake")
    .select(BOOKING_SELECT_FIELDS)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as BookingIntakeRow | null) ?? null;
}

async function writeBookingAuditLog(params: {
  actorUserId: string;
  bookingId: string;
  patientUserId: string | null;
  action: string;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
}): Promise<string | null> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: params.actorUserId,
    patient_user_id: params.patientUserId,
    entity: "booking_intake",
    entity_id: params.bookingId,
    action: params.action,
    before_json: params.beforeJson,
    after_json: params.afterJson,
  });

  return error ? error.message : null;
}

function validateStaffBookingRow(row: BookingIntakeRow) {
  if (!row.google_event_id || !row.calendar_id) {
    throw new Error("這個預約未有完整日曆資料，暫時未能在營運台改期或取消。");
  }
}

export async function listStaffOperationBookings(filters: ListFilters): Promise<StaffBookingListResult> {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(Number(filters.limit) || 120, 1), 250);

  let query = supabase
    .from("booking_intake")
    .select(BOOKING_SELECT_FIELDS)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
    .limit(limit);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.doctorId) {
    query = query.eq("doctor_id", filters.doctorId);
  }
  if (filters.clinicId) {
    query = query.eq("clinic_id", filters.clinicId);
  }
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.dateFrom) {
    query = query.gte("appointment_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("appointment_date", filters.dateTo);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (((data as unknown) as BookingIntakeRow[] | null) ?? []).filter((row) =>
    matchesSearch(row, filters.q || ""),
  );

  return {
    items: rows.map(mapListItem),
    stats: buildStats(rows),
  };
}

export async function getStaffOperationBooking(bookingId: string): Promise<StaffBookingDetail | null> {
  const row = await fetchBookingRowById(bookingId);
  return row ? mapDetail(row) : null;
}

export async function cancelStaffOperationBooking(
  bookingId: string,
  actorUserId: string,
): Promise<StaffBookingMutationResult> {
  const row = await fetchBookingRowById(bookingId);
  if (!row) {
    throw new Error("找不到預約。");
  }
  if (row.status === "cancelled") {
    throw new Error("這個預約已經取消。");
  }

  validateStaffBookingRow(row);

  const cancelResult = await deleteEvent(row.calendar_id!, row.google_event_id!);
  if (!cancelResult.success) {
    throw new Error(cancelResult.error || "取消預約失敗。");
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("booking_intake")
    .update({
      status: "cancelled" as StaffBookingStatus,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const warnings: string[] = [];
  const clinicWhatsappPhone = getClinicWhatsappPhone(row.clinic_id);
  const manageToken = getRowPhoneDigits(row)
    ? createManageAccessToken(getRowPhoneDigits(row))
    : undefined;

  const whatsappResult = await sendBookingCancellationWhatsapp({
    bookingId: row.google_event_id || row.id,
    patientName: row.patient_name,
    doctorNameZh: row.doctor_name_zh,
    clinicNameZh: row.clinic_name_zh,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    phone: row.phone,
    email: row.email,
    clinicWhatsappPhone,
    manageAccessToken: manageToken,
  });

  if (!whatsappResult.success) {
    warnings.push(`WhatsApp 通知未能發送：${whatsappResult.error || "Unknown error"}`);
  }

  if (row.email) {
    const doctorProfile = DOCTOR_BY_ID[row.doctor_id as keyof typeof DOCTOR_BY_ID];
    const clinicProfile = CLINIC_BY_ID[row.clinic_id as keyof typeof CLINIC_BY_ID];
    const emailResult = await sendBookingCancellationEmail({
      patientName: row.patient_name,
      patientEmail: row.email,
      doctorName: doctorProfile?.nameEn || row.doctor_name_zh,
      doctorNameZh: row.doctor_name_zh,
      clinicName: clinicProfile?.nameEn || row.clinic_name_zh,
      clinicNameZh: row.clinic_name_zh,
      clinicAddress: getClinicAddress(row.clinic_id),
      date: row.appointment_date,
      time: row.appointment_time,
    });

    if (!emailResult.success) {
      warnings.push(`取消電郵未能發送：${emailResult.error || "Unknown error"}`);
    }
  }

  const updatedRow = await fetchBookingRowById(bookingId);
  if (!updatedRow) {
    throw new Error("預約已取消，但未能重新載入最新資料。");
  }

  const auditError = await writeBookingAuditLog({
    actorUserId,
    bookingId: row.id,
    patientUserId: row.user_id,
    action: "staff_cancel_booking",
    beforeJson: row as unknown as Record<string, unknown>,
    afterJson: updatedRow as unknown as Record<string, unknown>,
  });
  if (auditError) {
    warnings.push(`Audit log 未能寫入：${auditError}`);
  }

  return {
    booking: mapDetail(updatedRow),
    warnings,
  };
}

export async function rescheduleStaffOperationBooking(
  bookingId: string,
  actorUserId: string,
  params: RescheduleInput,
): Promise<StaffBookingMutationResult> {
  const row = await fetchBookingRowById(bookingId);
  if (!row) {
    throw new Error("找不到預約。");
  }
  if (row.status === "cancelled") {
    throw new Error("已取消預約不可直接改期。");
  }

  validateStaffBookingRow(row);

  const effectiveClinicId = params.clinicId && isClinicId(params.clinicId) ? params.clinicId : row.clinic_id;
  const targetClinic = CLINIC_BY_ID[effectiveClinicId as keyof typeof CLINIC_BY_ID];
  const targetClinicNameZh = targetClinic?.nameZh || row.clinic_name_zh;
  const startDate = fromZonedTime(`${params.date}T${params.time}:00`, HONG_KONG_TIMEZONE);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("日期或時間格式不正確。");
  }

  const endDate = new Date(startDate.getTime() + row.duration_minutes * 60000);
  const sameAsCurrentSlot =
    row.appointment_date === params.date &&
    row.appointment_time === params.time &&
    effectiveClinicId === row.clinic_id;

  if (!sameAsCurrentSlot && isSlotBlockedBySameDayEveningCutoffUtc(startDate)) {
    throw new Error("今日晚上時段已截止預約，請選擇其他日期或較早時段。");
  }

  if (!sameAsCurrentSlot && effectiveClinicId !== "online" && isSlotAfterClinicLastBookingCutoffUtc(startDate, effectiveClinicId)) {
    throw new Error("已超過此分店最後預約時間，請選擇較早時段。");
  }

  const bookingMetadata = {
    doctorId: row.doctor_id,
    doctorName: DOCTOR_BY_ID[row.doctor_id as keyof typeof DOCTOR_BY_ID]?.nameEn,
    doctorNameZh: row.doctor_name_zh,
    clinicId: effectiveClinicId,
    clinicName: targetClinic?.nameEn,
    clinicNameZh: targetClinicNameZh,
  };

  let nextEventId = row.google_event_id!;
  let nextCalendarId = row.calendar_id!;

  if (effectiveClinicId === "online") {
    const resolvedOnlineMapping = await resolveOnlineSourceMappingForSlot({
      doctorId: row.doctor_id,
      requestedDate: params.date,
      time: params.time,
      durationMinutes: row.duration_minutes,
      preferredCalendarId: row.calendar_id!,
    });

    if (resolvedOnlineMapping.errorCode === "CALENDAR_UNAVAILABLE") {
      throw new Error("暫時未能讀取預約日曆，請稍後再試。");
    }
    if (!resolvedOnlineMapping.mapping) {
      throw new Error("這個時段剛剛已滿，請選擇其他時段。");
    }

    const targetCalendarId = resolvedOnlineMapping.mapping.calendarId;
    if (targetCalendarId === row.calendar_id) {
      const updateResult = await updateEvent(row.calendar_id!, row.google_event_id!, {
        startTime: startDate,
        endTime: endDate,
        bookingMetadata,
      });
      if (!updateResult.success) {
        throw new Error(updateResult.error || "改期失敗。");
      }
    } else {
      const moveResult = await moveEventToCalendar(row.calendar_id!, targetCalendarId, row.google_event_id!, {
        startTime: startDate,
        endTime: endDate,
        bookingMetadata,
      });
      if (!moveResult.success || !moveResult.eventId) {
        throw new Error(moveResult.error || "改期失敗。");
      }
      nextEventId = moveResult.eventId;
      nextCalendarId = targetCalendarId;
    }
  } else {
    const mapping = await getMappingWithFallback(row.doctor_id, effectiveClinicId, params.date);
    if (!mapping || !mapping.isActive) {
      throw new Error("所選診所暫時未有此醫師應診。");
    }

    const targetCalendarId = mapping.calendarId;
    const shouldCheckAvailability = targetCalendarId !== row.calendar_id || !sameAsCurrentSlot;

    if (shouldCheckAvailability) {
      const requestedDayUtc = fromZonedTime(`${params.date}T00:00:00`, HONG_KONG_TIMEZONE);
      const busySlots = await getFreeBusy(targetCalendarId, requestedDayUtc);
      const stillAvailable = isSlotAvailableUtc(startDate, endDate, busySlots);
      if (!stillAvailable) {
        throw new Error("這個時段剛剛已滿，請選擇其他時段。");
      }
    }

    if (targetCalendarId === row.calendar_id) {
      const updateResult = await updateEvent(row.calendar_id!, row.google_event_id!, {
        startTime: startDate,
        endTime: endDate,
        bookingMetadata,
      });
      if (!updateResult.success) {
        throw new Error(updateResult.error || "改期失敗。");
      }
    } else {
      const moveResult = await moveEventToCalendar(row.calendar_id!, targetCalendarId, row.google_event_id!, {
        startTime: startDate,
        endTime: endDate,
        bookingMetadata,
      });
      if (!moveResult.success || !moveResult.eventId) {
        throw new Error(moveResult.error || "改期失敗。");
      }
      nextEventId = moveResult.eventId;
      nextCalendarId = targetCalendarId;
    }
  }

  const warnings: string[] = [];
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("booking_intake")
    .update({
      status: "confirmed" as StaffBookingStatus,
      appointment_date: params.date,
      appointment_time: params.time,
      duration_minutes: row.duration_minutes,
      last_rescheduled_at: now,
      reschedule_count: (row.reschedule_count || 0) + 1,
      google_event_id: nextEventId,
      calendar_id: nextCalendarId,
      clinic_id: effectiveClinicId,
      clinic_name_zh: targetClinicNameZh,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const whatsappResult = await sendBookingRescheduleWhatsapp({
    bookingId: nextEventId || row.id,
    patientName: row.patient_name,
    doctorNameZh: row.doctor_name_zh,
    clinicNameZh: targetClinicNameZh,
    oldDate: row.appointment_date,
    oldTime: row.appointment_time,
    newDate: params.date,
    newTime: params.time,
    phone: row.phone,
    email: row.email,
    clinicWhatsappPhone: getClinicWhatsappPhone(effectiveClinicId),
    manageAccessToken: getRowPhoneDigits(row)
      ? createManageAccessToken(getRowPhoneDigits(row))
      : undefined,
  });

  if (!whatsappResult.success) {
    warnings.push(`WhatsApp 通知未能發送：${whatsappResult.error || "Unknown error"}`);
  }

  const updatedRow = await fetchBookingRowById(bookingId);
  if (!updatedRow) {
    throw new Error("預約已改期，但未能重新載入最新資料。");
  }

  const auditError = await writeBookingAuditLog({
    actorUserId,
    bookingId: row.id,
    patientUserId: row.user_id,
    action: "staff_reschedule_booking",
    beforeJson: row as unknown as Record<string, unknown>,
    afterJson: updatedRow as unknown as Record<string, unknown>,
  });
  if (auditError) {
    warnings.push(`Audit log 未能寫入：${auditError}`);
  }

  return {
    booking: mapDetail(updatedRow),
    warnings,
  };
}
