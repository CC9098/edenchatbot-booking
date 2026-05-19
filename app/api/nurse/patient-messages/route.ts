import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { sendStaffPatientWhatsappMessage } from "@/lib/chatwoot-whatsapp";
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
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

    const whatsappResult = await sendStaffPatientWhatsappMessage({
      patientName: messageData.patientName,
      phone: messageData.phone,
      clinicNameZh: clinic.nameZh,
      clinicWhatsappPhone: getClinicWhatsappPhone(messageData.clinicId),
      purpose: messageData.purpose,
      note: messageData.note,
      linkUrl: messageData.linkUrl,
      manageUrl,
    });

    const preview = buildStaffPatientMessageText({
      patientName: messageData.patientName,
      clinicNameZh: clinic.nameZh,
      purpose: messageData.purpose,
      note: messageData.note,
      linkUrl: messageData.linkUrl,
      manageUrl,
    });

    if (!whatsappResult.success) {
      console.warn(
        `[nurse/patient-messages] WhatsApp send failed for staff=${user.id} role=${staffRole.role} purpose=${messageData.purpose}: ${whatsappResult.error}`,
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
      `[nurse/patient-messages] staff=${user.id} role=${staffRole.role} sent purpose=${messageData.purpose} to phoneLast4=${phoneDigits ? phoneDigits.slice(-4) : "unknown"} conversation=${whatsappResult.conversationId || "unknown"}`,
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
