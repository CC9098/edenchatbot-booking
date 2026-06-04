import { createServiceClient } from "@/lib/supabase";

export const OVERSEAS_CONSULTATION_STATUSES = [
  "new_submission",
  "payment_proof_uploaded",
  "basic_fee_confirmed",
  "appointment_confirmed",
  "consultation_completed",
  "herbal_fee_quoted",
  "herbal_fee_paid",
  "dispensing_in_progress",
  "posted",
  "postage_reimbursement_pending",
  "completed",
] as const;

export type OverseasConsultationStatus = (typeof OVERSEAS_CONSULTATION_STATUSES)[number];

export const OVERSEAS_CONSULTATION_STATUS_LABELS: Record<OverseasConsultationStatus, string> = {
  new_submission: "New submission",
  payment_proof_uploaded: "Payment proof uploaded",
  basic_fee_confirmed: "Basic fee confirmed",
  appointment_confirmed: "Appointment confirmed",
  consultation_completed: "Consultation completed",
  herbal_fee_quoted: "Herbal fee quoted",
  herbal_fee_paid: "Herbal fee paid",
  dispensing_in_progress: "Dispensing in progress",
  posted: "Posted",
  postage_reimbursement_pending: "Postage pending",
  completed: "Completed",
};

export type OverseasConsultationSubmission = {
  id: string;
  created_at: string;
  updated_at: string;
  status: OverseasConsultationStatus;
  basic_fee_status: "pending" | "uploaded" | "confirmed";
  basic_fee_amount: number;
  patient_chinese_name: string;
  patient_english_name: string | null;
  whatsapp: string;
  email: string;
  country: string;
  city: string;
  timezone: string;
  preferred_date: string;
  preferred_time: string;
  alternate_times: string | null;
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2: string | null;
  shipping_city: string;
  shipping_region: string | null;
  postal_code: string | null;
  shipping_country: string;
  health_data: Record<string, unknown>;
  emergency_flags: string[];
  payment_payer_name: string;
  payment_time: string;
  payment_notes: string | null;
  payment_proof_path: string | null;
  payment_proof_name: string | null;
  payment_proof_mime: string | null;
  payment_proof_size: number | null;
  payment_proof_uploaded: boolean;
  consent_confirmations: string[];
  staff_notes: string | null;
  suggested_herbal_days: number | null;
  quoted_herbal_fee: number | null;
  herbal_fee_paid: boolean;
  admin_fee_paid: boolean;
  dispensing_completed: boolean;
  actual_postage: number | null;
  tracking_number: string | null;
  postage_reimbursed: boolean;
};

export type OverseasConsultationCreateInput = {
  patientChineseName: string;
  patientEnglishName?: string;
  whatsapp: string;
  email: string;
  country: string;
  city: string;
  timezone: string;
  preferredDate: string;
  preferredTime: string;
  alternateTimes?: string;
  recipientName: string;
  recipientPhone: string;
  addressLine1: string;
  addressLine2?: string;
  shippingCity: string;
  shippingRegion?: string;
  postalCode?: string;
  shippingCountry: string;
  healthData: Record<string, unknown>;
  emergencyFlags: string[];
  paymentPayerName: string;
  paymentTime: string;
  paymentNotes?: string;
  paymentProof?: {
    path: string;
    name: string;
    mime: string;
    size: number;
  };
  consentConfirmations: string[];
};

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createOverseasConsultationSubmission(input: OverseasConsultationCreateInput) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const payload = {
    status: input.paymentProof ? "payment_proof_uploaded" : "new_submission",
    basic_fee_status: input.paymentProof ? "uploaded" : "pending",
    basic_fee_amount: 400,
    patient_chinese_name: input.patientChineseName.trim(),
    patient_english_name: normalizeOptional(input.patientEnglishName),
    whatsapp: input.whatsapp.trim(),
    email: input.email.trim().toLowerCase(),
    country: input.country.trim(),
    city: input.city.trim(),
    timezone: input.timezone.trim(),
    preferred_date: input.preferredDate,
    preferred_time: input.preferredTime.trim(),
    alternate_times: normalizeOptional(input.alternateTimes),
    recipient_name: input.recipientName.trim(),
    recipient_phone: input.recipientPhone.trim(),
    address_line1: input.addressLine1.trim(),
    address_line2: normalizeOptional(input.addressLine2),
    shipping_city: input.shippingCity.trim(),
    shipping_region: normalizeOptional(input.shippingRegion),
    postal_code: normalizeOptional(input.postalCode),
    shipping_country: input.shippingCountry.trim(),
    health_data: input.healthData,
    emergency_flags: input.emergencyFlags,
    payment_payer_name: input.paymentPayerName.trim(),
    payment_time: input.paymentTime.trim(),
    payment_notes: normalizeOptional(input.paymentNotes),
    payment_proof_path: input.paymentProof?.path ?? null,
    payment_proof_name: input.paymentProof?.name ?? null,
    payment_proof_mime: input.paymentProof?.mime ?? null,
    payment_proof_size: input.paymentProof?.size ?? null,
    payment_proof_uploaded: Boolean(input.paymentProof),
    consent_confirmations: input.consentConfirmations,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("overseas_consultation_submissions")
    .insert(payload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create overseas consultation submission");
  }

  return data as OverseasConsultationSubmission;
}

export async function listOverseasConsultationSubmissions(params?: {
  q?: string;
  status?: string;
  limit?: number;
}) {
  const supabase = createServiceClient();
  const limit = Math.min(Math.max(params?.limit || 80, 1), 200);
  let query = supabase
    .from("overseas_consultation_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const q = params?.q?.trim();
  if (q) {
    query = query.or(
      [
        `patient_chinese_name.ilike.%${q}%`,
        `patient_english_name.ilike.%${q}%`,
        `whatsapp.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `country.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as OverseasConsultationSubmission[];
  const signedUrls = new Map<string, string>();
  await Promise.all(
    rows
      .filter((row) => row.payment_proof_path)
      .map(async (row) => {
        const path = row.payment_proof_path;
        if (!path) return;
        const { data: signed, error: signedError } = await supabase.storage
          .from("overseas-consultation-proofs")
          .createSignedUrl(path, 60 * 60);
        if (!signedError && signed?.signedUrl) {
          signedUrls.set(row.id, signed.signedUrl);
        }
      }),
  );

  return rows.map((row) => ({
    ...row,
    payment_proof_url: signedUrls.get(row.id) || null,
  }));
}

export async function updateOverseasConsultationSubmission(
  id: string,
  patch: Partial<Pick<
    OverseasConsultationSubmission,
    | "status"
    | "basic_fee_status"
    | "staff_notes"
    | "suggested_herbal_days"
    | "quoted_herbal_fee"
    | "herbal_fee_paid"
    | "admin_fee_paid"
    | "dispensing_completed"
    | "actual_postage"
    | "tracking_number"
    | "postage_reimbursed"
  >>,
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("overseas_consultation_submissions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update overseas consultation submission");
  }

  return data as OverseasConsultationSubmission;
}
