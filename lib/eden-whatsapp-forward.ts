import { DOCTORS } from "@/shared/clinic-data";

export type WhatsappForwardDoctor = { id: string; name: string; phone: string };
export type WhatsappForwardPreview = {
  doctor: WhatsappForwardDoctor;
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

// Phone numbers are private deployment configuration, never part of the public bundle.
export function getWhatsappForwardDoctors(
  env: Record<string, string | undefined> = process.env,
): WhatsappForwardDoctor[] {
  return DOCTORS.flatMap((doctor) => {
    const phone =
      env[`DOCTOR_FORWARD_WHATSAPP_${doctor.id.toUpperCase()}`]?.trim();
    return phone && /^\+[1-9]\d{7,14}$/.test(phone)
      ? [{ id: doctor.id, name: doctor.nameZh, phone }]
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
  if (status === "read") return "醫師已讀";
  if (status === "delivered") return "已送達醫師 WhatsApp";
  if (status === "partial")
    return "只確認到部分訊息，請查看醫師對話及附件，唔好重複轉寄。";
  if (status === "failed") return "WhatsApp 未能送出，請查看醫師對話。";
  return "已提交，等候 WhatsApp 送達。";
}
