export const STAFF_PATIENT_MESSAGE_PURPOSE_IDS = [
  "intake_link",
  "pre_visit",
  "follow_up",
  "manage_link",
  "online_waiting",
  "payment_notice",
] as const;

export type StaffPatientMessagePurpose = (typeof STAFF_PATIENT_MESSAGE_PURPOSE_IDS)[number];

export const STAFF_PATIENT_FOLLOW_UP_TEMPLATE_NAME = "staff_patient_follow_up";

export type StaffPatientMessagePurposeOption = {
  id: StaffPatientMessagePurpose;
  label: string;
  shortLabel: string;
  description: string;
  requiresLink?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
};

export const STAFF_PATIENT_MESSAGE_PURPOSE_OPTIONS: StaffPatientMessagePurposeOption[] = [
  {
    id: "intake_link",
    label: "補資料連結",
    shortLabel: "補資料",
    description: "傳 approved template，叫病人打開姑娘提供的連結補資料。",
    requiresLink: true,
    noteLabel: "補充說明（選填）",
    notePlaceholder: "例如：請先填好病歷資料，方便姑娘跟進。",
  },
  {
    id: "pre_visit",
    label: "到診前提醒",
    shortLabel: "到診提醒",
    description: "提醒新病人帶齊資料、準時到診，保持診所語氣一致。",
    noteLabel: "提醒內容（選填）",
    notePlaceholder: "例如：請帶身份證、藥物紀錄或相關報告。",
  },
  {
    id: "follow_up",
    label: "一般跟進",
    shortLabel: "跟進",
    description: "傳 approved template，內容由姑娘輸入。",
    noteLabel: "訊息內容",
    notePlaceholder: "例如：你要的收據已準備好，可以到診所領取。",
  },
  {
    id: "manage_link",
    label: "預約管理連結",
    shortLabel: "管理連結",
    description: "用病人電話產生預約管理入口，方便病人更期或取消。",
  },
  {
    id: "online_waiting",
    label: "網上診症候診",
    shortLabel: "網上候診",
    description: "通知病人保持 Google Meet / 網上診症入口開啟等候。",
    noteLabel: "候診說明（選填）",
    notePlaceholder: "例如：醫師即將進入，請保持 Google Meet 開啟。",
  },
  {
    id: "payment_notice",
    label: "收款通知",
    shortLabel: "收款",
    description: "發送已審批收款 template，病人可直接查看金額和付款方法。",
  },
];

export const STAFF_PATIENT_MESSAGE_PURPOSE_BY_ID = Object.fromEntries(
  STAFF_PATIENT_MESSAGE_PURPOSE_OPTIONS.map((option) => [option.id, option]),
) as Record<StaffPatientMessagePurpose, StaffPatientMessagePurposeOption>;

export type BuildStaffPatientMessageTextInput = {
  patientName: string;
  clinicNameZh: string;
  purpose: StaffPatientMessagePurpose;
  note?: string;
  linkUrl?: string;
  manageUrl?: string;
  medicineDays?: string;
  consultationFee?: string;
  treatmentFee?: string;
  extraFee?: string;
  totalAmount?: string;
};

function getStaffPatientMessageNote(input: BuildStaffPatientMessageTextInput): string {
  const note = input.note?.trim();
  if (note) return note;

  switch (input.purpose) {
    case "intake_link":
      return "如已提交，請不用重覆填寫。";
    case "pre_visit":
      return "溫馨提示：到診前請準備相關病歷、藥物紀錄或報告，並按預約時間到達診所。";
    case "follow_up":
      return "診所有事項需要跟進。";
    case "online_waiting":
      return "如醫師仍未進入網上診症，請保持 Google Meet 或網上診症入口開啟，姑娘會盡快跟進。";
    case "manage_link":
    case "payment_notice":
      return "";
  }
}

export function isStaffPatientMessagePurpose(value: string): value is StaffPatientMessagePurpose {
  return STAFF_PATIENT_MESSAGE_PURPOSE_IDS.includes(value as StaffPatientMessagePurpose);
}

export function buildStaffPatientMessageText(input: BuildStaffPatientMessageTextInput): string {
  const note = getStaffPatientMessageNote(input);
  const linkUrl = input.linkUrl?.trim();
  const manageUrl = input.manageUrl?.trim();

  if (input.purpose === "follow_up") {
    return [
      "醫天圓中醫診所通知",
      "",
      "你好，以下是診所給你的跟進訊息：",
      "",
      note,
      "",
      "如有問題，請直接回覆此 WhatsApp。",
    ].filter((line, index, allLines) => line || allLines[index - 1] !== "").join("\n");
  }

  const lines = ["醫天圓中醫診所通知", "", `你好 ${input.patientName}，`];

  switch (input.purpose) {
    case "intake_link":
      lines.push(
        "為方便姑娘跟進，請按以下連結補充資料：",
        linkUrl || "",
        note || "如已提交，請不用重覆填寫。",
      );
      break;
    case "pre_visit":
      lines.push(
        note || "溫馨提示：到診前請準備相關病歷、藥物紀錄或報告，並按預約時間到達診所。",
      );
      break;
    case "manage_link":
      lines.push(
        "請打開以下連結登入並管理你的預約：",
        manageUrl || "",
        "如非你本人操作，請忽略此訊息。",
      );
      break;
    case "online_waiting":
      lines.push(
        note || "如醫師仍未進入網上診症，請保持 Google Meet 或網上診症入口開啟，姑娘會盡快跟進。",
        linkUrl ? `網上診症入口：${linkUrl}` : "",
      );
      break;
    case "payment_notice":
      lines.push(
        `中醫師為你開了 ${input.medicineDays || "＿"} 天藥。`,
        `診金：$${input.consultationFee || "＿"}`,
        `其他收費：$${input.treatmentFee || "＿"} ${input.extraFee || ""}`.trim(),
        `價錢為：$${input.totalAmount || "＿"}`,
        "付款方法會隨 WhatsApp template 一併發送。",
      );
      break;
  }

  lines.push("", `診所：${input.clinicNameZh}`, "如有問題，請直接回覆此 WhatsApp。");

  return lines.filter((line, index, allLines) => line || allLines[index - 1] !== "").join("\n");
}

export function buildStaffPatientTemplateBodyParams(
  input: BuildStaffPatientMessageTextInput,
  templateName?: string,
): Record<string, string> {
  if (input.purpose === "manage_link") {
    return {
      manage_url: input.manageUrl || "",
    };
  }

  if (input.purpose === "payment_notice") {
    return {
      "1": input.patientName,
      "2": input.medicineDays?.trim() || "",
      "3": input.consultationFee?.trim() || "",
      "4": input.treatmentFee?.trim() || "",
      "5": input.extraFee?.trim() || "",
      "6": input.totalAmount?.trim() || "",
    };
  }

  if (input.purpose === "follow_up") {
    return {
      "1": getStaffPatientMessageNote(input),
    };
  }

  return {
    patient_name: input.patientName,
    clinic_name: input.clinicNameZh,
    staff_note: getStaffPatientMessageNote(input),
    action_url: input.linkUrl?.trim() || "",
  };
}
