import { createServiceClient } from "@/lib/supabase";

export type BookingVisitType = "first" | "followup";
export type BookingReceiptType = "no" | "yes_insurance" | "yes_not_insurance";
export type BookingPickupType =
  | "none"
  | "lalamove"
  | "sfexpress"
  | "clinic_pickup";
export type BookingGender = "male" | "female" | "other";
export type BookingIntakeStatus = "pending" | "confirmed" | "cancelled" | "failed";

export interface BookingIntakeCreateInput {
  source?: string;
  userId?: string;
  sessionId?: string;
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
    };

    const { data, error } = await supabase
      .from("booking_intake")
      .insert(payload)
      .select("id")
      .single();

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
