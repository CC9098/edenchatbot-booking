import { DOCTORS } from "@/shared/clinic-data";

export type WhatsappForwardRecipientKind = "doctor" | "branch" | "staff";
export type WhatsappForwardRecipient = {
  id: string;
  name: string;
  kind: WhatsappForwardRecipientKind;
  phone: string;
};

// Kept as an alias while the server request/ledger still uses the original
// doctorId/doctor_id names. New UI copy should call these recipients.
export type WhatsappForwardDoctor = WhatsappForwardRecipient;
export type WhatsappForwardPreview = {
  doctor: WhatsappForwardRecipient;
  sourceMessageId: number;
  destinationId: number;
  content: string;
  attachments: { id: number; url: string; label: string; fileType: string }[];
  mode: "text" | "template" | "blocked";
  reason: string | null;
  token: string;
};
export type WhatsappForwardResult = {
  conversationId: number;
  messageId: number;
  status: string;
};

// Legacy environment-only doctor configuration. The operational recipient
// allowlist, including the six staff/branch entries, lives in the server-only
// config module so these phone numbers can never enter the browser bundle.
export function getWhatsappForwardDoctors(
  env: Record<string, string | undefined> = process.env,
): WhatsappForwardDoctor[] {
  return DOCTORS.flatMap((doctor) => {
    const phone =
      env[`DOCTOR_FORWARD_WHATSAPP_${doctor.id.toUpperCase()}`]?.trim();
    return phone && /^\+[1-9]\d{7,14}$/.test(phone)
      ? [{ id: doctor.id, name: doctor.nameZh, kind: "doctor", phone }]
      : [];
  });
}

export function forwardMessageText(
  patientName: string,
  patientPhone: string,
  content: string,
): string {
  return [
    "【轉寄病人訊息】",
    `${patientName} · ${patientPhone}`,
    "",
    content.trim(),
  ]
    .join("\n")
    .trim();
}

export function templateForwardText(content: string) {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ｜ ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

export function forwardDeliveryLabel(status: string) {
  if (status === "read") return "收件人已讀";
  if (status === "delivered") return "已送達收件人 WhatsApp";
  if (status === "partial")
    return "只確認到部分訊息，請查看收件人對話及附件，唔好重複轉寄。";
  if (status === "failed") return "WhatsApp 未能送出，請查看收件人對話。";
  return "已提交，等候 WhatsApp 送達。";
}
