import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import type { BookingPickupType } from "@/shared/booking-pickup";
export type { BookingPickupType } from "@/shared/booking-pickup";

export type BookingVisitType = "first" | "followup";
export type BookingReceiptType = "no" | "yes_insurance" | "yes_not_insurance";
export type BookingGender = "male" | "female" | "other";
export type BookingIntakeStatus = "pending" | "confirmed" | "cancelled" | "failed";

export interface BookingIntakeCreateInput {
  source?: string;
  userId?: string;
  sessionId?: string;
  patientProfileId?: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  patientName: string;
  phone: string;
  email: string;
  visitType: BookingVisitType;
  needReceipt: BookingReceiptType;
  medicationPickup: BookingPickupType;
  idCard?: string;
  dob?: string;
  gender?: BookingGender;
  allergies?: string;
  medications?: string;
  symptoms?: string;
  referralSource?: string;
  notes?: string;
  bookingPayload?: Record<string, unknown>;
}

export interface BookingReminderIntakeCandidate {
  intakeId: string;
  googleEventId: string;
  calendarId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  visitType: BookingVisitType;
  appointmentDate: string;
  appointmentTime: string;
  notificationClinicId?: string;
}

export interface GroupBookingIntakeCandidate {
  intakeId: string;
  googleEventId: string;
  calendarId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorId: string;
  doctorNameZh: string;
  clinicId: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  visitType: BookingVisitType;
}

function parseNotificationClinicId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const payload = raw as Record<string, unknown>;
  const value = payload["notificationClinicId"];
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function isMissingPatientProfileColumnError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

  return message.includes("patient_profile_id") && message.includes("schema cache");
}

export async function createPendingBookingIntake(
  input: BookingIntakeCreateInput,
): Promise<{ success: boolean; intakeId?: string; error?: string }> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const normalizedEmail = input.email.trim().toLowerCase();

    const payload = {
      source: input.source ?? "chat_v2",
      status: "pending" as BookingIntakeStatus,
      user_id: input.userId ?? null,
      session_id: input.sessionId ?? null,
      doctor_id: input.doctorId,
      doctor_name_zh: input.doctorNameZh,
      clinic_id: input.clinicId,
      clinic_name_zh: input.clinicNameZh,
      appointment_date: input.appointmentDate,
      appointment_time: input.appointmentTime,
      duration_minutes: input.durationMinutes,
      patient_name: input.patientName,
      phone: input.phone,
      phone_digits: normalizePhoneForSearch(input.phone),
      email: normalizedEmail,
      visit_type: input.visitType,
      need_receipt: input.needReceipt,
      medication_pickup: input.medicationPickup,
      id_card: input.idCard ?? null,
      dob: input.dob ?? null,
      gender: input.gender ?? null,
      allergies: input.allergies ?? null,
      medications: input.medications ?? null,
      symptoms: input.symptoms ?? null,
      referral_source: input.referralSource ?? null,
      notes: input.notes ?? null,
      booking_payload: input.bookingPayload ?? {},
      updated_at: now,
      ...(input.patientProfileId ? { patient_profile_id: input.patientProfileId } : {}),
    };

    let { data, error } = await supabase
      .from("booking_intake")
      .insert(payload)
      .select("id")
      .single();

    if (error && "patient_profile_id" in payload && isMissingPatientProfileColumnError(error)) {
      const { patient_profile_id: _patientProfileId, ...fallbackPayload } = payload;
      const retryResult = await supabase
        .from("booking_intake")
        .insert(fallbackPayload)
        .select("id")
        .single();

      data = retryResult.data;
      error = retryResult.error;
    }

    if (error || !data?.id) {
      return {
        success: false,
        error: error?.message || "Failed to create booking intake record",
      };
    }

    return { success: true, intakeId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function markBookingIntakeConfirmed(params: {
  intakeId: string;
  googleEventId: string;
  calendarId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("booking_intake")
      .update({
        status: "confirmed" as BookingIntakeStatus,
        google_event_id: params.googleEventId,
        calendar_id: params.calendarId,
        confirmed_at: now,
        updated_at: now,
      })
      .eq("id", params.intakeId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function markBookingIntakeFailed(params: {
  intakeId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("booking_intake")
      .update({
        status: "failed" as BookingIntakeStatus,
        failure_reason: params.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.intakeId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function markBookingIntakeCancelledByEvent(params: {
  googleEventId: string;
  calendarId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    let query = supabase
      .from("booking_intake")
      .update({
        status: "cancelled" as BookingIntakeStatus,
        cancelled_at: now,
        updated_at: now,
      })
      .eq("google_event_id", params.googleEventId);

    if (params.calendarId) {
      query = query.eq("calendar_id", params.calendarId);
    }

    const { error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function markBookingIntakeRescheduledByEvent(params: {
  googleEventId: string;
  calendarId?: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  nextGoogleEventId?: string;
  nextCalendarId?: string;
  nextClinicId?: string;
  nextClinicNameZh?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();
    let selectQuery = supabase
      .from("booking_intake")
      .select("id, reschedule_count")
      .eq("google_event_id", params.googleEventId)
      .limit(1);
    if (params.calendarId) {
      selectQuery = selectQuery.eq("calendar_id", params.calendarId);
    }
    const selectResult = selectQuery.maybeSingle();
    const { data: existing, error: existingError } = await selectResult;
    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const nextCount =
      typeof existing?.reschedule_count === "number"
        ? existing.reschedule_count + 1
        : 1;

    let updateQuery = supabase
      .from("booking_intake")
      .update({
        status: "confirmed" as BookingIntakeStatus,
        appointment_date: params.appointmentDate,
        appointment_time: params.appointmentTime,
        duration_minutes: params.durationMinutes,
        last_rescheduled_at: now,
        reschedule_count: nextCount,
        ...(params.nextGoogleEventId
          ? { google_event_id: params.nextGoogleEventId }
          : {}),
        ...(params.nextCalendarId ? { calendar_id: params.nextCalendarId } : {}),
        ...(params.nextClinicId ? { clinic_id: params.nextClinicId } : {}),
        ...(params.nextClinicNameZh ? { clinic_name_zh: params.nextClinicNameZh } : {}),
        updated_at: now,
      })
      .eq("google_event_id", params.googleEventId);
    if (params.calendarId) {
      updateQuery = updateQuery.eq("calendar_id", params.calendarId);
    }
    const { error } = await updateQuery;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function listConfirmedBookingReminderCandidatesByDate(
  targetDate: string,
): Promise<{ success: boolean; items: BookingReminderIntakeCandidate[]; error?: string }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("booking_intake")
      .select(`
        id,
        google_event_id,
        calendar_id,
        patient_name,
        phone,
        email,
        doctor_name_zh,
        clinic_id,
        clinic_name_zh,
        visit_type,
        appointment_date,
        appointment_time,
        booking_payload
      `)
      .eq("status", "confirmed")
      .eq("appointment_date", targetDate)
      .not("google_event_id", "is", null)
      .not("calendar_id", "is", null)
      .order("appointment_time", { ascending: true });

    if (error) {
      return {
        success: false,
        items: [],
        error: error.message,
      };
    }

    const deduped = new Map<string, BookingReminderIntakeCandidate>();

    for (const row of data ?? []) {
      const googleEventId =
        typeof row.google_event_id === "string" ? row.google_event_id.trim() : "";
      const calendarId =
        typeof row.calendar_id === "string" ? row.calendar_id.trim() : "";

      if (!googleEventId || !calendarId) {
        continue;
      }

      const key = `${calendarId}:${googleEventId}`;
      if (deduped.has(key)) {
        continue;
      }

      deduped.set(key, {
        intakeId: String(row.id || ""),
        googleEventId,
        calendarId,
        patientName: typeof row.patient_name === "string" ? row.patient_name.trim() : "",
        patientPhone: typeof row.phone === "string" ? row.phone.trim() : "",
        patientEmail: typeof row.email === "string" ? row.email.trim().toLowerCase() : "",
        doctorNameZh: typeof row.doctor_name_zh === "string" ? row.doctor_name_zh.trim() : "",
        clinicId: typeof row.clinic_id === "string" ? row.clinic_id.trim() : "",
        clinicNameZh: typeof row.clinic_name_zh === "string" ? row.clinic_name_zh.trim() : "",
        visitType: row.visit_type === "first" ? "first" : "followup",
        appointmentDate:
          typeof row.appointment_date === "string" ? row.appointment_date.trim() : "",
        appointmentTime:
          typeof row.appointment_time === "string" ? row.appointment_time.trim() : "",
        notificationClinicId: parseNotificationClinicId(row.booking_payload),
      });
    }

    return {
      success: true,
      items: Array.from(deduped.values()),
    };
  } catch (error) {
    return {
      success: false,
      items: [],
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}

export async function listConfirmedGroupBookingCandidates(params: {
  doctorId: string;
  clinicId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}): Promise<{ success: boolean; items: GroupBookingIntakeCandidate[]; error?: string }> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("booking_intake")
      .select(`
        id,
        google_event_id,
        calendar_id,
        patient_name,
        phone,
        email,
        doctor_id,
        doctor_name_zh,
        clinic_id,
        clinic_name_zh,
        visit_type,
        appointment_date,
        appointment_time
      `)
      .eq("status", "confirmed")
      .eq("doctor_id", params.doctorId)
      .eq("clinic_id", params.clinicId)
      .eq("appointment_date", params.appointmentDate)
      .gte("appointment_time", params.startTime)
      .lt("appointment_time", params.endTime)
      .not("google_event_id", "is", null)
      .not("calendar_id", "is", null)
      .order("appointment_time", { ascending: true });

    if (error) {
      return { success: false, items: [], error: error.message };
    }

    const items: GroupBookingIntakeCandidate[] = [];
    for (const row of data ?? []) {
      const googleEventId = typeof row.google_event_id === "string" ? row.google_event_id.trim() : "";
      const calendarId = typeof row.calendar_id === "string" ? row.calendar_id.trim() : "";
      if (!googleEventId || !calendarId) continue;

      items.push({
        intakeId: String(row.id),
        googleEventId,
        calendarId,
        patientName: typeof row.patient_name === "string" ? row.patient_name : "",
        patientPhone: typeof row.phone === "string" ? row.phone : "",
        patientEmail: typeof row.email === "string" ? row.email : "",
        doctorId: typeof row.doctor_id === "string" ? row.doctor_id : params.doctorId,
        doctorNameZh: typeof row.doctor_name_zh === "string" ? row.doctor_name_zh : "",
        clinicId: typeof row.clinic_id === "string" ? row.clinic_id : params.clinicId,
        clinicNameZh: typeof row.clinic_name_zh === "string" ? row.clinic_name_zh : "",
        appointmentDate: typeof row.appointment_date === "string" ? row.appointment_date : params.appointmentDate,
        appointmentTime: typeof row.appointment_time === "string" ? row.appointment_time : "",
        visitType: row.visit_type === "first" || row.visit_type === "followup" ? row.visit_type : "followup",
      });
    }

    return { success: true, items };
  } catch (error) {
    return {
      success: false,
      items: [],
      error: error instanceof Error ? error.message : "Unknown DB error",
    };
  }
}
