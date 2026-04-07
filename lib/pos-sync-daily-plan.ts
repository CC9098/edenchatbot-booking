import { formatInTimeZone } from "date-fns-tz";

import type { BookingVisitType } from "@/lib/booking-intake-storage";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import { createServiceClient } from "@/lib/supabase";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const DEFAULT_PLAN_LIMIT = 200;
const MAX_PLAN_LIMIT = 500;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PosSyncRecommendedAction =
  | "search-then-register"
  | "search-or-create-then-register";

type PosSyncReadiness = "ready" | "blocked";

interface BookingIntakePlanRow {
  id: string;
  appointment_date: string;
  appointment_time: string;
  calendar_id: string | null;
  clinic_id: string | null;
  clinic_name_zh: string | null;
  created_at: string | null;
  doctor_id: string | null;
  doctor_name_zh: string | null;
  google_event_id: string | null;
  id_card: string | null;
  patient_name: string | null;
  phone: string | null;
  phone_digits: string | null;
  status: string | null;
  visit_type: BookingVisitType | null;
}

export interface DailyPosSyncCandidate {
  intakeId: string;
  appointmentDate: string;
  appointmentTime: string;
  calendarId: string | null;
  clinicId: string | null;
  clinicNameZh: string | null;
  doctorId: string | null;
  doctorNameZh: string | null;
  googleEventId: string | null;
  patientName: string;
  phone: string | null;
  phoneDigits: string | null;
  idCard: string | null;
  visitType: BookingVisitType;
  primarySearchKey: string | null;
  recommendedAction: PosSyncRecommendedAction;
  readiness: PosSyncReadiness;
  blockingIssues: string[];
  manualReviewReasons: string[];
  notes: string[];
}

export interface DailyPosSyncPlanSummary {
  totalCandidates: number;
  readyCandidates: number;
  blockedCandidates: number;
  candidatesNeedingManualReview: number;
  firstVisitCandidates: number;
  followUpCandidates: number;
  candidatesMissingIdCard: number;
  candidatesMissingPhone: number;
  candidatesMissingCalendarLink: number;
}

export interface DailyPosSyncPlan {
  generatedAt: string;
  requestedDate: string;
  timezone: string;
  source: "booking_intake";
  clinicId: string | null;
  limit: number;
  summary: DailyPosSyncPlanSummary;
  candidates: DailyPosSyncCandidate[];
}

export interface DailyPosSyncPlanOptions {
  date?: string;
  clinicId?: string;
  limit?: number;
}

function resolveRequestedDate(input?: string): string {
  if (!input) {
    return formatInTimeZone(new Date(), HONG_KONG_TIMEZONE, "yyyy-MM-dd");
  }

  const normalized = input.trim();
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  return normalized;
}

function normalizeLimit(input?: number): number {
  if (!Number.isFinite(input)) {
    return DEFAULT_PLAN_LIMIT;
  }

  const next = Math.trunc(input as number);
  if (next < 1) {
    return DEFAULT_PLAN_LIMIT;
  }

  return Math.min(next, MAX_PLAN_LIMIT);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildCandidate(row: BookingIntakePlanRow): DailyPosSyncCandidate {
  const visitType: BookingVisitType = row.visit_type === "first" ? "first" : "followup";
  const patientName = normalizeOptionalText(row.patient_name) ?? "";
  const phone = normalizeOptionalText(row.phone);
  const phoneDigits =
    normalizeOptionalText(row.phone_digits) ?? normalizePhoneForSearch(phone);
  const idCard = normalizeOptionalText(row.id_card);
  const primarySearchKey = idCard || phoneDigits || patientName || null;

  const blockingIssues: string[] = [];
  const manualReviewReasons: string[] = [];
  const notes: string[] = [];

  if (!primarySearchKey) {
    blockingIssues.push("missing-search-key");
  }

  if (!patientName) {
    manualReviewReasons.push("missing-patient-name");
  }

  if (!phoneDigits) {
    manualReviewReasons.push("missing-phone");
  }

  if (!idCard) {
    manualReviewReasons.push("missing-id-card");
    if (visitType === "first") {
      notes.push("First-visit candidate may need POS customer creation before registration.");
    } else {
      notes.push("Follow-up candidate is missing an ID card, so POS search may rely on phone.");
    }
  }

  if (!normalizeOptionalText(row.google_event_id) || !normalizeOptionalText(row.calendar_id)) {
    manualReviewReasons.push("missing-calendar-link");
  }

  if (!normalizeOptionalText(row.clinic_id) || !normalizeOptionalText(row.clinic_name_zh)) {
    manualReviewReasons.push("missing-clinic-context");
  }

  if (!normalizeOptionalText(row.doctor_name_zh)) {
    manualReviewReasons.push("missing-doctor-context");
  }

  return {
    intakeId: row.id,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    calendarId: normalizeOptionalText(row.calendar_id),
    clinicId: normalizeOptionalText(row.clinic_id),
    clinicNameZh: normalizeOptionalText(row.clinic_name_zh),
    doctorId: normalizeOptionalText(row.doctor_id),
    doctorNameZh: normalizeOptionalText(row.doctor_name_zh),
    googleEventId: normalizeOptionalText(row.google_event_id),
    patientName,
    phone,
    phoneDigits: phoneDigits || null,
    idCard,
    visitType,
    primarySearchKey,
    recommendedAction:
      visitType === "first" ? "search-or-create-then-register" : "search-then-register",
    readiness: blockingIssues.length > 0 ? "blocked" : "ready",
    blockingIssues,
    manualReviewReasons,
    notes,
  };
}

function buildSummary(candidates: DailyPosSyncCandidate[]): DailyPosSyncPlanSummary {
  return candidates.reduce<DailyPosSyncPlanSummary>(
    (summary, candidate) => {
      summary.totalCandidates += 1;

      if (candidate.readiness === "ready") {
        summary.readyCandidates += 1;
      } else {
        summary.blockedCandidates += 1;
      }

      if (candidate.manualReviewReasons.length > 0) {
        summary.candidatesNeedingManualReview += 1;
      }

      if (candidate.visitType === "first") {
        summary.firstVisitCandidates += 1;
      } else {
        summary.followUpCandidates += 1;
      }

      if (!candidate.idCard) {
        summary.candidatesMissingIdCard += 1;
      }

      if (!candidate.phoneDigits) {
        summary.candidatesMissingPhone += 1;
      }

      if (!candidate.calendarId || !candidate.googleEventId) {
        summary.candidatesMissingCalendarLink += 1;
      }

      return summary;
    },
    {
      totalCandidates: 0,
      readyCandidates: 0,
      blockedCandidates: 0,
      candidatesNeedingManualReview: 0,
      firstVisitCandidates: 0,
      followUpCandidates: 0,
      candidatesMissingIdCard: 0,
      candidatesMissingPhone: 0,
      candidatesMissingCalendarLink: 0,
    },
  );
}

export async function getDailyPosSyncPlan(
  options: DailyPosSyncPlanOptions = {},
): Promise<DailyPosSyncPlan> {
  const requestedDate = resolveRequestedDate(options.date);
  const clinicId = normalizeOptionalText(options.clinicId);
  const limit = normalizeLimit(options.limit);

  const supabase = createServiceClient();

  let query = supabase
    .from("booking_intake")
    .select(
      [
        "id",
        "appointment_date",
        "appointment_time",
        "calendar_id",
        "clinic_id",
        "clinic_name_zh",
        "created_at",
        "doctor_id",
        "doctor_name_zh",
        "google_event_id",
        "id_card",
        "patient_name",
        "phone",
        "phone_digits",
        "status",
        "visit_type",
      ].join(", "),
    )
    .eq("status", "confirmed")
    .eq("appointment_date", requestedDate)
    .order("appointment_time", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (clinicId) {
    query = query.eq("clinic_id", clinicId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data || []) as unknown as BookingIntakePlanRow[]).filter((row) => row?.id);
  const candidates = rows.map(buildCandidate);

  return {
    generatedAt: new Date().toISOString(),
    requestedDate,
    timezone: HONG_KONG_TIMEZONE,
    source: "booking_intake",
    clinicId,
    limit,
    summary: buildSummary(candidates),
    candidates,
  };
}
