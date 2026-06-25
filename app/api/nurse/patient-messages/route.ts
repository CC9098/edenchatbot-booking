import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError } from "@/lib/auth-helpers";
import { requireStaffRoleWithChatwootEdenToolsToken } from "@/lib/chatwoot-eden-tools-session";
import { sendBookingConfirmationWhatsapp, sendStaffPatientWhatsappMessage } from "@/lib/chatwoot-whatsapp";
import { normalizePhoneForSearch } from "@/lib/contact-utils";
import {
  STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID,
  STAFF_PATIENT_MESSAGE_PURPOSE_IDS,
  buildStaffPatientMessageText,
} from "@/lib/staff-patient-messages";
import { buildManageBookingUrl } from "@/lib/public-url";
import { createManageAccessToken } from "@/lib/widget-booking-management";
import { CLINIC_BY_ID, CLINIC_IDS } from "@/shared/clinic-data";
import { getClinicWhatsappPhone } from "@/lib/whatsapp-booking";

export const dynamic = "force-dynamic";

const nursePatientMessageSchema = z.object({
  patientName: z.string().trim().min(1, "請輸入病人姓名").max(80, "病人姓名太長"),
  phone: z.string().trim().min(6, "請輸入 WhatsApp 電話號碼").max(32, "電話號碼太長"),
  clinicId: z.enum(CLINIC_IDS),
  purpose: z.enum(STAFF_PATIENT_MESSAGE_PURPOSE_IDS),
  linkUrl: z.string().trim().max(1200, "連結太長").optional().default(""),
  note: z.string().trim().max(240, "內容太長").optional().default(""),
  manageAction: z.enum(["reschedule", "cancel"]).optional(),
  bookingId: z.string().trim().max(120).optional().default(""),
  doctorNameZh: z.string().trim().max(80).optional().default(""),
  appointmentDate: z.string().trim().max(20).optional().default(""),
  appointmentTime: z.string().trim().max(20).optional().default(""),
  meetLink: z.string().trim().max(500).optional().default(""),
  visitType: z.enum(["first", "followup"]).optional().default("followup"),
  medicineDays: z.string().trim().max(20, "藥物日數太長").optional().default(""),
  consultationFee: z.string().trim().max(40, "診金太長").optional().default(""),
  treatmentFee: z.string().trim().max(40, "其他收費太長").optional().default(""),
  extraFee: z.string().trim().max(80, "收費說明太長").optional().default(""),
  totalAmount: z.string().trim().max(40, "總額太長").optional().default(""),
});

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    code: issue.code,
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, staffRole } = await requireStaffRoleWithChatwootEdenToolsToken(request);
    const body = await request.json();
    const parsed = nursePatientMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: formatZodIssues(parsed.error) },
        { status: 400 },
      );
    }

    const messageData = parsed.data;
    const purposeConfig = STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID[messageData.purpose];
    if (purposeConfig.requiresLink && !messageData.linkUrl) {
      return NextResponse.json(
        { error: "請先貼上要傳給病人的連結。" },
        { status: 400 },
      );
    }

    if (messageData.linkUrl && !isHttpUrl(messageData.linkUrl)) {
      return NextResponse.json(
        { error: "連結必須以 http:// 或 https:// 開頭。" },
        { status: 400 },
      );
    }

    if (messageData.purpose === "payment_notice") {
      const missingPaymentFields = [
        ["medicineDays", messageData.medicineDays],
        ["consultationFee", messageData.consultationFee],
        ["treatmentFee", messageData.treatmentFee],
        ["extraFee", messageData.extraFee],
        ["totalAmount", messageData.totalAmount],
      ].filter(([, value]) => !value);

      if (missingPaymentFields.length > 0) {
        return NextResponse.json(
          { error: "請填齊收款通知欄位。" },
          { status: 400 },
        );
      }
    }

    const clinic = CLINIC_BY_ID[messageData.clinicId];
    const phoneDigits = normalizePhoneForSearch(messageData.phone);
    let manageUrl = "";

    if (messageData.purpose === "manage_link") {
      if (!phoneDigits) {
        return NextResponse.json(
          { error: "未能識別 WhatsApp 電話號碼，不能產生管理連結。" },
          { status: 400 },
        );
      }

      manageUrl = buildManageBookingUrl({
        token: createManageAccessToken(phoneDigits),
        action: messageData.manageAction,
      });
    }

    const clinicWhatsappPhone = getClinicWhatsappPhone(messageData.clinicId);
    const canSendOnlineConfirmationTemplate =
      messageData.purpose === "online_waiting" &&
      Boolean(
        messageData.linkUrl &&
          messageData.bookingId &&
          messageData.doctorNameZh &&
          messageData.appointmentDate &&
          messageData.appointmentTime,
      );

    const whatsappResult = canSendOnlineConfirmationTemplate
      ? await sendBookingConfirmationWhatsapp({
          bookingId: messageData.bookingId,
          patientName: messageData.patientName,
          phone: messageData.phone,
          email: "",
          doctorNameZh: messageData.doctorNameZh,
          clinicNameZh: clinic.nameZh,
          appointmentDate: messageData.appointmentDate,
          appointmentTime: messageData.appointmentTime,
          visitType: messageData.visitType,
          meetLink: messageData.meetLink,
          onlineConsultUrl: messageData.linkUrl,
          clinicWhatsappPhone,
        })
      : await sendStaffPatientWhatsappMessage({
          patientName: messageData.patientName,
          phone: messageData.phone,
          clinicNameZh: clinic.nameZh,
          clinicWhatsappPhone,
          purpose: messageData.purpose,
          note: messageData.note,
          linkUrl: messageData.linkUrl,
          manageUrl,
          medicineDays: messageData.medicineDays,
          consultationFee: messageData.consultationFee,
          treatmentFee: messageData.treatmentFee,
          extraFee: messageData.extraFee,
          totalAmount: messageData.totalAmount,
        });

    const preview = buildStaffPatientMessageText({
      patientName: messageData.patientName,
      clinicNameZh: clinic.nameZh,
      purpose: messageData.purpose,
      note: messageData.note,
      linkUrl: messageData.linkUrl,
      manageUrl,
      medicineDays: messageData.medicineDays,
      consultationFee: messageData.consultationFee,
      treatmentFee: messageData.treatmentFee,
      extraFee: messageData.extraFee,
      totalAmount: messageData.totalAmount,
    });

    if (!whatsappResult.success) {
      console.warn(
        `[nurse/patient-messages] WhatsApp send failed for staff=${userId} role=${staffRole.role} purpose=${messageData.purpose}: ${whatsappResult.error}`,
      );
      return NextResponse.json(
        {
          success: false,
          whatsappSent: false,
          error: whatsappResult.error || "未能發送 WhatsApp 訊息。",
          messagePreview: preview,
        },
        { status: 502 },
      );
    }

    console.info(
      `[nurse/patient-messages] staff=${userId} role=${staffRole.role} sent purpose=${messageData.purpose} to phoneLast4=${phoneDigits ? phoneDigits.slice(-4) : "unknown"} conversation=${whatsappResult.conversationId || "unknown"}`,
    );

    return NextResponse.json({
      success: true,
      whatsappSent: true,
      conversationId: whatsappResult.conversationId,
      deliveryStatus: whatsappResult.deliveryStatus,
      messagePreview: preview,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[nurse/patient-messages] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
