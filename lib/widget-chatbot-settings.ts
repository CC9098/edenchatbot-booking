import type { Option } from "@/components/chat/types";

export type WidgetChatbotMenuId =
  | "fees"
  | "clinic"
  | "booking"
  | "timetable"
  | "other"
  | "consult";

export type WidgetChatbotNodeId =
  | "welcome"
  | "mainMenu"
  | "fees"
  | "clinic"
  | "clinicHours"
  | "clinicAddresses"
  | "booking"
  | "timetable"
  | "other"
  | "consult"
  | "common";

export interface WidgetChatbotMenuItem {
  id: WidgetChatbotMenuId;
  target: WidgetChatbotMenuId;
  label: string;
  visible: boolean;
}

export interface WidgetChatbotSettings {
  header: {
    title: string;
    subtitle: string;
    launcherClosedLabel: string;
    launcherOpenLabel: string;
    restartButtonLabel: string;
  };
  greeting: {
    title: string;
    body: string;
    contactTitle: string;
  };
  menu: {
    items: WidgetChatbotMenuItem[];
  };
  flows: {
    fees: {
      reply: string;
      endButtonLabel: string;
      mainButtonLabel: string;
    };
    clinic: {
      prompt: string;
      hoursButtonLabel: string;
      addressesButtonLabel: string;
      backButtonLabel: string;
      hoursClosingText: string;
      addressesPrompt: string;
    };
    booking: {
      prompt: string;
    };
    timetable: {
      reply: string;
    };
    other: {
      prompt: string;
      aiLoadingText: string;
      aiErrorLead: string;
    };
    consultation: {
      prompts: {
        reason: string;
        name: string;
        email: string;
        phone: string;
      };
      placeholders: {
        reason: string;
        name: string;
        email: string;
        phone: string;
      };
      submittingText: string;
      successText: string;
      errorText: string;
    };
    common: {
      returnToMainText: string;
      endText: string;
      returnMainButtonLabel: string;
      bookingBackButtonLabel: string;
      bookingCancelButtonLabel: string;
    };
  };
}

export interface WidgetChatbotFlowNode {
  id: WidgetChatbotNodeId;
  title: string;
  trigger: string;
  description: string;
  nextSteps: string[];
  editScope: string;
}

const MENU_ORDER: WidgetChatbotMenuId[] = [
  "fees",
  "clinic",
  "booking",
  "timetable",
  "other",
  "consult",
];

const DEFAULT_MENU_LABELS: Record<WidgetChatbotMenuId, string> = {
  fees: "收費",
  clinic: "診所資訊",
  booking: "預約",
  timetable: "醫師時間表",
  other: "其他問題",
  consult: "諮詢醫師",
};

export const WIDGET_CHATBOT_MENU_TARGET_OPTIONS = MENU_ORDER.map((id) => ({
  value: id,
  label: DEFAULT_MENU_LABELS[id],
}));

export const DEFAULT_WIDGET_CHATBOT_SETTINGS: WidgetChatbotSettings = {
  header: {
    title: "醫天圓小助手",
    subtitle: "EDEN TCM CLINIC",
    launcherClosedLabel: "立即諮詢",
    launcherOpenLabel: "收起對話",
    restartButtonLabel: "重新開始",
  },
  greeting: {
    title: "你好，我係醫天圓小助手，請問有咩幫到你😊",
    body: "會為你提供即時資訊和更多幫助。如有需要直接 Whatsapp 聯繫，請與我們姑娘真人聯絡。",
    contactTitle: "真人聯絡通道：",
  },
  menu: {
    items: MENU_ORDER.map((id) => ({
      id,
      target: id,
      label: DEFAULT_MENU_LABELS[id],
      visible: true,
    })),
  },
  flows: {
    fees: {
      reply:
        "**醫天圓基本收費詳情**\n診金：$100 / 次\n基本藥費：$80 起 / 劑 (按藥量調整收費，每次最少3天)\n針灸：$300 – 500 / 次\n正骨手法：$350 – 700 / 次\n拔罐：$350 / 次\n\n👴 合資格長者可使用醫療券。\n📄 可提供處方及收據以辦理保險索償。",
      endButtonLabel: "無問題了",
      mainButtonLabel: "還有問題 (返回主選單)",
    },
    clinic: {
      prompt: "請問你想查詢邊方面？",
      hoursButtonLabel: "營業時間",
      addressesButtonLabel: "地址",
      backButtonLabel: "返回主選單",
      hoursClosingText:
        "⚠️ **重要提示**：以上時間僅供參考，具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。\n\n🔗 詳情請參考： https://www.edenclinic.hk/timetable/\n🔗 立即預約及查看最新時間表： https://edentcm.as.me/schedule.php",
      addressesPrompt: "請問你想查詢邊間診所呢？",
    },
    booking: {
      prompt: "請問你想預約邊位醫師呢？😊",
    },
    timetable: {
      reply:
        "以下係幾位醫師的時間表參考。\n\n⚠️ **重要提示**：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。\n\n🔗 立即預約及查看最新時間表：https://edentcm.as.me/schedule.php\n🔗 查看診所時間表網頁：https://www.edenclinic.hk/timetable/",
    },
    other: {
      prompt: "請問你有無咩問題，我會儘量以我所知為你解答。😊\n如有需要，請與我們姑娘真人聯絡：",
      aiLoadingText: "Connecting to AI... 正在為你連接Gemini，稍後回覆。",
      aiErrorLead: "抱歉，AI 服務暫時無法使用。",
    },
    consultation: {
      prompts: {
        reason: "我地好樂意為你介紹合適的醫師。請問你有邊方面問題想搵醫師幫手？",
        name: "請問你的姓名係？",
        email: "想請問你的電郵地址 😊 讓我地醫師可以回覆你",
        phone: "然後係你的電話號碼? (請確保輸入正確，讓同事Whatsapp或電話回覆)",
      },
      placeholders: {
        reason: "描述你的症狀或想諮詢的問題",
        name: "輸入姓名",
        email: "your@email.com",
        phone: "852XXXXXXX",
      },
      submittingText: "正在提交諮詢資料... ⏳",
      successText: "資料已提交，我們會盡快以電話或電郵聯絡你。",
      errorText: "抱歉，提交諮詢時發生錯誤。請稍後再試，或直接 WhatsApp 聯絡診所姑娘。",
    },
    common: {
      returnToMainText: "返回主選單，仲有咩可以幫到你？",
      endText: "好的，希望能幫到你！祝你身體健康，生活愉快！🌿",
      returnMainButtonLabel: "返回主選單",
      bookingBackButtonLabel: "⬅️ 上一步",
      bookingCancelButtonLabel: "取消預約",
    },
  },
};

export const WIDGET_CHATBOT_FLOW_NODES: WidgetChatbotFlowNode[] = [
  {
    id: "welcome",
    title: "開場白",
    trigger: "用戶第一次打開 widget，而且未有任何訊息。",
    description: "顯示歡迎文字、補充說明，再列出真人聯絡通道。",
    nextSteps: ["主選單"],
    editScope: "可改開場三句、聯絡標題。",
  },
  {
    id: "mainMenu",
    title: "主選單",
    trigger: "開場白之後，或者任何流程按「返回主選單」之後。",
    description: "列出主選項；姑娘可改顯示名稱、排序、顯示/隱藏，同埋每個 button 對應去邊條 flow。",
    nextSteps: ["收費", "診所資訊", "預約", "醫師時間表", "其他問題", "諮詢醫師"],
    editScope: "可改 button 名稱、排序、顯示/隱藏，以及 button 去向。",
  },
  {
    id: "fees",
    title: "收費",
    trigger: "主選單按「收費」。",
    description: "顯示收費內容，再畀用戶決定結束或者返回主選單。",
    nextSteps: ["結束對話", "返回主選單"],
    editScope: "可改回覆內容及兩個後續 button 字眼。",
  },
  {
    id: "clinic",
    title: "診所資訊入口",
    trigger: "主選單按「診所資訊」。",
    description: "先問用戶想查營業時間定地址，再分流。",
    nextSteps: ["營業時間", "地址", "返回主選單"],
    editScope: "可改入口句與三個 button 字眼。",
  },
  {
    id: "clinicHours",
    title: "營業時間",
    trigger: "診所資訊內按「營業時間」。",
    description: "系統會自動插入最新營業時間，再接你設定的提醒與官方連結。",
    nextSteps: ["返回主選單"],
    editScope: "可改尾段提醒文案；實際營業時間資料仍由系統提供。",
  },
  {
    id: "clinicAddresses",
    title: "地址",
    trigger: "診所資訊內按「地址」。",
    description: "系統會自動插入診所地址和地圖連結，前面先顯示提示句。",
    nextSteps: ["返回主選單"],
    editScope: "可改提示句；地址與地圖連結由系統提供。",
  },
  {
    id: "booking",
    title: "預約入口",
    trigger: "主選單按「預約」。",
    description: "先問想預約哪位醫師，再進入系統預約流程。",
    nextSteps: ["醫師清單", "返回主選單"],
    editScope: "現階段可改入口句；之後的日期/時間/表單流程仍由系統控制。",
  },
  {
    id: "timetable",
    title: "醫師時間表",
    trigger: "主選單按「醫師時間表」。",
    description: "顯示時間表說明與官方連結。",
    nextSteps: ["返回主選單"],
    editScope: "可改整段說明。",
  },
  {
    id: "other",
    title: "其他問題",
    trigger: "主選單按「其他問題」。",
    description: "先出一段 AI 交接提示，再開文字輸入畀用戶自由發問。",
    nextSteps: ["AI 對答"],
    editScope: "可改交接提示、AI 連線中訊息、AI 出錯時開頭句。",
  },
  {
    id: "consult",
    title: "諮詢醫師表單",
    trigger: "主選單按「諮詢醫師」。",
    description: "按次序收集問題、姓名、電郵、電話，提交俾姑娘/醫師跟進。",
    nextSteps: ["提交成功", "提交失敗"],
    editScope: "可改四條提問、placeholder、提交中/成功/失敗文案。",
  },
  {
    id: "common",
    title: "共用按鈕與結尾",
    trigger: "多個流程都會重用。",
    description: "包括返回主選單回覆、結束句、預約 flow 上一步 / 取消按鈕。",
    nextSteps: ["主選單", "結束對話"],
    editScope: "可改常用共用字眼。",
  },
];

function toNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized || fallback;
}

function isMenuId(value: unknown): value is WidgetChatbotMenuId {
  return typeof value === "string" && MENU_ORDER.includes(value as WidgetChatbotMenuId);
}

function normalizeMenuItems(value: unknown): WidgetChatbotMenuItem[] {
  const input = Array.isArray(value) ? value : [];
  const byId = new Map<WidgetChatbotMenuId, WidgetChatbotMenuItem>();

  for (const item of input) {
    if (!item || typeof item !== "object") continue;

    const candidate = item as Record<string, unknown>;
    if (!isMenuId(candidate.id)) continue;
    const target = isMenuId(candidate.target) ? candidate.target : candidate.id;

    byId.set(candidate.id, {
      id: candidate.id,
      target,
      label: toNonEmptyString(candidate.label, DEFAULT_MENU_LABELS[target]),
      visible: candidate.visible !== false,
    });
  }

  return MENU_ORDER.map((id) => {
    return (
      byId.get(id) ?? {
        id,
        target: id,
        label: DEFAULT_MENU_LABELS[id],
        visible: true,
      }
    );
  });
}

export function normalizeWidgetChatbotSettings(input: unknown): WidgetChatbotSettings {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const header = source.header && typeof source.header === "object"
    ? (source.header as Record<string, unknown>)
    : {};
  const greeting = source.greeting && typeof source.greeting === "object"
    ? (source.greeting as Record<string, unknown>)
    : {};
  const menu = source.menu && typeof source.menu === "object"
    ? (source.menu as Record<string, unknown>)
    : {};
  const flows = source.flows && typeof source.flows === "object"
    ? (source.flows as Record<string, unknown>)
    : {};
  const fees = flows.fees && typeof flows.fees === "object"
    ? (flows.fees as Record<string, unknown>)
    : {};
  const clinic = flows.clinic && typeof flows.clinic === "object"
    ? (flows.clinic as Record<string, unknown>)
    : {};
  const booking = flows.booking && typeof flows.booking === "object"
    ? (flows.booking as Record<string, unknown>)
    : {};
  const timetable = flows.timetable && typeof flows.timetable === "object"
    ? (flows.timetable as Record<string, unknown>)
    : {};
  const other = flows.other && typeof flows.other === "object"
    ? (flows.other as Record<string, unknown>)
    : {};
  const consultation = flows.consultation && typeof flows.consultation === "object"
    ? (flows.consultation as Record<string, unknown>)
    : {};
  const consultationPrompts =
    consultation.prompts && typeof consultation.prompts === "object"
      ? (consultation.prompts as Record<string, unknown>)
      : {};
  const consultationPlaceholders =
    consultation.placeholders && typeof consultation.placeholders === "object"
      ? (consultation.placeholders as Record<string, unknown>)
      : {};
  const common = flows.common && typeof flows.common === "object"
    ? (flows.common as Record<string, unknown>)
    : {};

  return {
    header: {
      title: toNonEmptyString(header.title, DEFAULT_WIDGET_CHATBOT_SETTINGS.header.title),
      subtitle: toNonEmptyString(header.subtitle, DEFAULT_WIDGET_CHATBOT_SETTINGS.header.subtitle),
      launcherClosedLabel: toNonEmptyString(
        header.launcherClosedLabel,
        DEFAULT_WIDGET_CHATBOT_SETTINGS.header.launcherClosedLabel
      ),
      launcherOpenLabel: toNonEmptyString(
        header.launcherOpenLabel,
        DEFAULT_WIDGET_CHATBOT_SETTINGS.header.launcherOpenLabel
      ),
      restartButtonLabel: toNonEmptyString(
        header.restartButtonLabel,
        DEFAULT_WIDGET_CHATBOT_SETTINGS.header.restartButtonLabel
      ),
    },
    greeting: {
      title: toNonEmptyString(greeting.title, DEFAULT_WIDGET_CHATBOT_SETTINGS.greeting.title),
      body: toNonEmptyString(greeting.body, DEFAULT_WIDGET_CHATBOT_SETTINGS.greeting.body),
      contactTitle: toNonEmptyString(
        greeting.contactTitle,
        DEFAULT_WIDGET_CHATBOT_SETTINGS.greeting.contactTitle
      ),
    },
    menu: {
      items: normalizeMenuItems(menu.items),
    },
    flows: {
      fees: {
        reply: toNonEmptyString(fees.reply, DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.fees.reply),
        endButtonLabel: toNonEmptyString(
          fees.endButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.fees.endButtonLabel
        ),
        mainButtonLabel: toNonEmptyString(
          fees.mainButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.fees.mainButtonLabel
        ),
      },
      clinic: {
        prompt: toNonEmptyString(clinic.prompt, DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.prompt),
        hoursButtonLabel: toNonEmptyString(
          clinic.hoursButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.hoursButtonLabel
        ),
        addressesButtonLabel: toNonEmptyString(
          clinic.addressesButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.addressesButtonLabel
        ),
        backButtonLabel: toNonEmptyString(
          clinic.backButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.backButtonLabel
        ),
        hoursClosingText: toNonEmptyString(
          clinic.hoursClosingText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.hoursClosingText
        ),
        addressesPrompt: toNonEmptyString(
          clinic.addressesPrompt,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.clinic.addressesPrompt
        ),
      },
      booking: {
        prompt: toNonEmptyString(booking.prompt, DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.booking.prompt),
      },
      timetable: {
        reply: toNonEmptyString(
          timetable.reply,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.timetable.reply
        ),
      },
      other: {
        prompt: toNonEmptyString(other.prompt, DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.other.prompt),
        aiLoadingText: toNonEmptyString(
          other.aiLoadingText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.other.aiLoadingText
        ),
        aiErrorLead: toNonEmptyString(
          other.aiErrorLead,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.other.aiErrorLead
        ),
      },
      consultation: {
        prompts: {
          reason: toNonEmptyString(
            consultationPrompts.reason,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.prompts.reason
          ),
          name: toNonEmptyString(
            consultationPrompts.name,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.prompts.name
          ),
          email: toNonEmptyString(
            consultationPrompts.email,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.prompts.email
          ),
          phone: toNonEmptyString(
            consultationPrompts.phone,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.prompts.phone
          ),
        },
        placeholders: {
          reason: toNonEmptyString(
            consultationPlaceholders.reason,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.placeholders.reason
          ),
          name: toNonEmptyString(
            consultationPlaceholders.name,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.placeholders.name
          ),
          email: toNonEmptyString(
            consultationPlaceholders.email,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.placeholders.email
          ),
          phone: toNonEmptyString(
            consultationPlaceholders.phone,
            DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.placeholders.phone
          ),
        },
        submittingText: toNonEmptyString(
          consultation.submittingText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.submittingText
        ),
        successText: toNonEmptyString(
          consultation.successText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.successText
        ),
        errorText: toNonEmptyString(
          consultation.errorText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.consultation.errorText
        ),
      },
      common: {
        returnToMainText: toNonEmptyString(
          common.returnToMainText,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common.returnToMainText
        ),
        endText: toNonEmptyString(common.endText, DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common.endText),
        returnMainButtonLabel: toNonEmptyString(
          common.returnMainButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common.returnMainButtonLabel
        ),
        bookingBackButtonLabel: toNonEmptyString(
          common.bookingBackButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common.bookingBackButtonLabel
        ),
        bookingCancelButtonLabel: toNonEmptyString(
          common.bookingCancelButtonLabel,
          DEFAULT_WIDGET_CHATBOT_SETTINGS.flows.common.bookingCancelButtonLabel
        ),
      },
    },
  };
}

export function buildWidgetMainMenuOptions(settings: WidgetChatbotSettings): Option[] {
  return settings.menu.items
    .filter((item) => item.visible)
    .map((item) => ({
      label: item.label,
      value: item.target,
    }));
}

export function getWidgetChatbotMenuLabelByTarget(
  settings: WidgetChatbotSettings,
  target: WidgetChatbotMenuId
): string {
  return settings.menu.items.find((item) => item.target === target)?.label ?? DEFAULT_MENU_LABELS[target];
}

export function buildWidgetGreetingMessage(
  settings: WidgetChatbotSettings,
  whatsappLines: string[]
): string {
  return [
    settings.greeting.title,
    settings.greeting.body,
    "",
    settings.greeting.contactTitle,
    ...whatsappLines,
  ].join("\n");
}

export function buildConsultationFormFlow(settings: WidgetChatbotSettings): Array<{
  key: "reason" | "name" | "email" | "phone";
  prompt: string;
  placeholder: string;
}> {
  return [
    {
      key: "reason",
      prompt: settings.flows.consultation.prompts.reason,
      placeholder: settings.flows.consultation.placeholders.reason,
    },
    {
      key: "name",
      prompt: settings.flows.consultation.prompts.name,
      placeholder: settings.flows.consultation.placeholders.name,
    },
    {
      key: "email",
      prompt: settings.flows.consultation.prompts.email,
      placeholder: settings.flows.consultation.placeholders.email,
    },
    {
      key: "phone",
      prompt: settings.flows.consultation.prompts.phone,
      placeholder: settings.flows.consultation.placeholders.phone,
    },
  ];
}
