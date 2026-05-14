export const STAFF_PATIENT_MESSAGE_PURPOSE_IDS = [
  "intake_link",
  "pre_visit",
  "follow_up",
  "manage_link",
  "online_waiting",
] as const;

export type StaffPatientMessagePurpose = (typeof STAFF_PATIENT_MESSAGE_PURPOSE_IDS)[number];

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
    label: "姑娘跟進",
    shortLabel: "跟進",
    description: "通知病人姑娘需要跟進，請病人直接回覆 WhatsApp。",
    noteLabel: "跟進內容（選填）",
    notePlaceholder: "例如：姑娘想確認你的預約資料，請回覆此訊息。",
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
};

export function isStaffPatientMessagePurpose(value: string): value is StaffPatientMessagePurpose {
  return STAFF_PATIENT_MESSAGE_PURPOSE_IDS.includes(value as StaffPatientMessagePurpose);
}

export function buildStaffPatientMessageText(input: BuildStaffPatientMessageTextInput): string {
  const note = input.note?.trim();
  const linkUrl = input.linkUrl?.trim();
  const manageUrl = input.manageUrl?.trim();
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
    case "follow_up":
      lines.push(
        note || "姑娘需要跟進你的查詢，請直接回覆此 WhatsApp 訊息，我們會盡快處理。",
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
      );
      break;
  }

  lines.push("", `診所：${input.clinicNameZh}`, "如有問題，可直接回覆此訊息。");

  return lines.filter((line, index, allLines) => line || allLines[index - 1] !== "").join("\n");
}

export function buildStaffPatientTemplateBodyParams(
  input: BuildStaffPatientMessageTextInput,
): Record<string, string> {
  if (input.purpose === "manage_link") {
    return {
      manage_url: input.manageUrl || "",
    };
  }

  return {
    patient_name: input.patientName,
    clinic_name: input.clinicNameZh,
    staff_note: input.note?.trim() || "",
    action_url: input.linkUrl?.trim() || "",
  };
}
