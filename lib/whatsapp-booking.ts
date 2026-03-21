import type {
  BookingGender,
  BookingPickupType,
  BookingReceiptType,
  BookingVisitType,
} from "@/lib/booking-intake-storage";
import { CLINIC_BY_ID, type ClinicId } from "@/shared/clinic-data";

const VISIT_TYPE_LABELS: Record<BookingVisitType, string> = {
  first: "首診",
  followup: "覆診",
};

const RECEIPT_LABELS: Record<BookingReceiptType, string> = {
  no: "不需要",
  yes_insurance: "需要，用作保險索償",
  yes_not_insurance: "需要，非保險用途",
};

const PICKUP_LABELS: Record<BookingPickupType, string> = {
  none: "不需要",
  lalamove: "即日配送（Lalamove）",
  sfexpress: "順豐速運",
  clinic_pickup: "診所自取",
};

const GENDER_LABELS: Record<BookingGender, string> = {
  male: "男",
  female: "女",
  other: "其他",
};

const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  google: "Google 搜尋",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  friend: "朋友介紹",
  doctor: "醫師介紹",
  walk_in: "路過",
  other: "其他",
};

function formatDateForWhatsapp(dateIso: string): string {
  if (!dateIso) return "";

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatOptionalValue(value: string | undefined, fallback = "未提供"): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

export function getWhatsappClinicTarget(clinicId: string): {
  clinicId: ClinicId;
  clinicNameZh: string;
  whatsappUrl: string;
} | null {
  const clinic = CLINIC_BY_ID[clinicId as ClinicId];
  if (!clinic?.whatsappUrl) {
    return null;
  }

  return {
    clinicId: clinic.id,
    clinicNameZh: clinic.nameZh,
    whatsappUrl: clinic.whatsappUrl,
  };
}

export function buildWhatsappPrefillUrl(baseUrl: string, text: string): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("text", text);
    return url.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}text=${encodeURIComponent(text)}`;
  }
}

export function buildWhatsappBookingMessage(input: {
  intakeId?: string;
  doctorNameZh: string;
  clinicNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  visitType: BookingVisitType;
  patientName: string;
  phone: string;
  email: string;
  needReceipt: BookingReceiptType;
  medicationPickup: BookingPickupType;
  idCard?: string;
  dateOfBirth?: string;
  gender?: BookingGender;
  allergies?: string;
  medications?: string;
  symptoms?: string;
  referralSource?: string;
  notes?: string;
}): string {
  const lines = [
    "你好，我想預約，請姑娘協助確認。",
    "",
    "【預約資料】",
    `醫師：${input.doctorNameZh}`,
    `診所：${input.clinicNameZh}`,
    `日期：${formatDateForWhatsapp(input.appointmentDate)}`,
    `時間：${input.appointmentTime}`,
    `診症類型：${VISIT_TYPE_LABELS[input.visitType]}`,
    "",
    "【聯絡資料】",
    `姓名：${input.patientName}`,
    `電話：${input.phone}`,
    `電郵：${input.email}`,
    "",
    "【其他資料】",
    `收據需求：${RECEIPT_LABELS[input.needReceipt]}`,
    `取藥方法：${PICKUP_LABELS[input.medicationPickup]}`,
  ];

  if (input.visitType === "first") {
    lines.push(
      `身份證號碼：${formatOptionalValue(input.idCard)}`,
      `出生日期：${formatOptionalValue(input.dateOfBirth)}`,
      `性別：${input.gender ? GENDER_LABELS[input.gender] : "未提供"}`,
      `過敏史：${formatOptionalValue(input.allergies, "沒有")}`,
      `正服用藥物／保健品：${formatOptionalValue(input.medications, "沒有")}`,
      `主要症狀：${formatOptionalValue(input.symptoms)}`,
      `得知來源：${REFERRAL_SOURCE_LABELS[input.referralSource || ""] || "未提供"}`,
    );
  }

  if (input.notes?.trim()) {
    lines.push("", `備註：${input.notes.trim()}`);
  }

  lines.push("", "這個時段在提交時顯示可預約，最終以姑娘確認為準。");

  if (input.intakeId) {
    lines.push(`查詢編號：${input.intakeId}`);
  }

  return lines.join("\n");
}
