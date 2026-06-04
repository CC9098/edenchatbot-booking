import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createOverseasConsultationSubmission } from "@/lib/overseas-consultation";
import { createServiceClient } from "@/lib/supabase";
import { sendOverseasConsultationNotificationEmails } from "@/lib/gmail";

export const dynamic = "force-dynamic";

const MAX_PAYMENT_PROOF_SIZE = 10 * 1024 * 1024;
const ALLOWED_PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const REQUIRED_CONSENT_COUNT = 8;

const stringField = z.string().trim().min(1);
const optionalStringField = z.string().trim().optional();

const submissionSchema = z.object({
  patientChineseName: stringField,
  patientEnglishName: optionalStringField,
  whatsapp: stringField,
  email: z.string().trim().email(),
  country: stringField,
  city: stringField,
  timezone: stringField,
  preferredDate: stringField,
  preferredTime: stringField,
  alternateTimes: optionalStringField,
  recipientName: stringField,
  recipientPhone: stringField,
  addressLine1: stringField,
  addressLine2: optionalStringField,
  shippingCity: stringField,
  shippingRegion: optionalStringField,
  postalCode: optionalStringField,
  shippingCountry: stringField,
  healthData: z.record(z.unknown()),
  emergencyFlags: z.array(z.string()),
  paymentPayerName: stringField,
  paymentTime: stringField,
  paymentNotes: optionalStringField,
  consentConfirmations: z.array(z.string()).min(REQUIRED_CONSENT_COUNT),
});

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormJson<T>(formData: FormData, key: string, fallback: T): T {
  const value = getFormString(formData, key);
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Form data is required" }, { status: 400 });
    }

    const formData = await request.formData();
    const proof = formData.get("paymentProof");
    let paymentProof:
      | {
          path: string;
          name: string;
          mime: string;
          size: number;
        }
      | undefined;

    if (!(proof instanceof File) || proof.size === 0) {
      return NextResponse.json({ error: "Payment proof is required" }, { status: 400 });
    }

    if (proof.size > MAX_PAYMENT_PROOF_SIZE) {
      return NextResponse.json({ error: "Payment proof must be 10MB or smaller" }, { status: 400 });
    }

    if (!ALLOWED_PAYMENT_PROOF_TYPES.has(proof.type)) {
      return NextResponse.json({ error: "Payment proof must be jpg, png, or pdf" }, { status: 400 });
    }

    const parsed = submissionSchema.parse({
      patientChineseName: getFormString(formData, "patientChineseName"),
      patientEnglishName: getFormString(formData, "patientEnglishName"),
      whatsapp: getFormString(formData, "whatsapp"),
      email: getFormString(formData, "email"),
      country: getFormString(formData, "country"),
      city: getFormString(formData, "city"),
      timezone: getFormString(formData, "timezone"),
      preferredDate: getFormString(formData, "preferredDate"),
      preferredTime: getFormString(formData, "preferredTime"),
      alternateTimes: getFormString(formData, "alternateTimes"),
      recipientName: getFormString(formData, "recipientName"),
      recipientPhone: getFormString(formData, "recipientPhone"),
      addressLine1: getFormString(formData, "addressLine1"),
      addressLine2: getFormString(formData, "addressLine2"),
      shippingCity: getFormString(formData, "shippingCity"),
      shippingRegion: getFormString(formData, "shippingRegion"),
      postalCode: getFormString(formData, "postalCode"),
      shippingCountry: getFormString(formData, "shippingCountry"),
      healthData: getFormJson(formData, "healthData", {}),
      emergencyFlags: getFormJson(formData, "emergencyFlags", []),
      paymentPayerName: getFormString(formData, "paymentPayerName"),
      paymentTime: getFormString(formData, "paymentTime"),
      paymentNotes: getFormString(formData, "paymentNotes"),
      consentConfirmations: getFormJson(formData, "consentConfirmations", []),
    });

    const supabase = createServiceClient();
    const extension = proof.type === "application/pdf" ? "pdf" : proof.type === "image/png" ? "png" : "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const proofBuffer = Buffer.from(await proof.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("overseas-consultation-proofs")
      .upload(path, proofBuffer, {
        contentType: proof.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[overseas-consultation] payment proof upload failed:", uploadError.message);
      return NextResponse.json({ error: "Payment proof upload failed" }, { status: 500 });
    }

    paymentProof = {
      path,
      name: proof.name || `payment-proof.${extension}`,
      mime: proof.type,
      size: proof.size,
    };

    const submission = await createOverseasConsultationSubmission({
      ...parsed,
      paymentProof,
    });

    const mainConcern =
      typeof parsed.healthData.mainConcern === "string"
        ? parsed.healthData.mainConcern
        : "";
    const emailResult = await sendOverseasConsultationNotificationEmails({
      submissionId: submission.id,
      patientChineseName: submission.patient_chinese_name,
      patientEnglishName: submission.patient_english_name,
      patientEmail: submission.email,
      whatsapp: submission.whatsapp,
      country: submission.country,
      city: submission.city,
      timezone: submission.timezone,
      preferredDate: submission.preferred_date,
      preferredTime: submission.preferred_time,
      alternateTimes: submission.alternate_times,
      emergencyFlags: submission.emergency_flags,
      mainConcern,
      paymentPayerName: submission.payment_payer_name,
      paymentTime: submission.payment_time,
      paymentProofUploaded: submission.payment_proof_uploaded,
    });

    if (!emailResult.clinic.success || !emailResult.patient.success) {
      console.warn("[overseas-consultation] email notification partial failure:", emailResult);
    }

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      clinicEmailSent: emailResult.clinic.success,
      patientEmailSent: emailResult.patient.success,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    console.error("[POST /api/overseas-consultation] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
