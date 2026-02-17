import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLines } from '@/shared/clinic-schedule-data';
import {
  listBookableDoctors,
  getAvailableTimeSlots,
  createConversationalBooking,
  listMyBookings,
} from '@/lib/booking-conversation-helpers';
import {
  logSymptom,
  updateSymptom,
  listSymptoms,
} from '@/lib/symptom-conversation-helpers';
import { buildContentReferenceContext } from '@/lib/content-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConstitutionType = 'depleting' | 'crossing' | 'hoarding';
type ChatMode = 'G1' | 'G2' | 'G3' | 'B';

interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_MESSAGE_SCHEMA = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const CHAT_REQUEST_SCHEMA = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  messages: z.array(CHAT_MESSAGE_SCHEMA).min(1, 'messages must not be empty'),
  stream: z.boolean().optional(),
});

interface TokenUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  error?: string;
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

type GeminiModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

interface ModeRuleSignals {
  latestLength: number;
  hasLatestBookingKeyword: boolean;
  hasRecentBookingIntent: boolean;
  explicitCancel: boolean;
  hasLatestG2Keyword: boolean;
  hasLatestG3Keyword: boolean;
}

interface ModeRuleResolution {
  mode: ChatMode;
  signals: ModeRuleSignals;
}

interface SemanticRouterDecision {
  mode: ChatMode;
  confidence: number;
  reasons: string[];
}

type ModeDecisionSource = 'rules' | 'semantic' | 'rules_fallback';

interface ModeDecision {
  mode: ChatMode;
  ruleMode: ChatMode;
  source: ModeDecisionSource;
  routerAttempted: boolean;
  routerMode?: ChatMode;
  routerConfidence?: number;
  routerReasons?: string[];
  routerError?: string;
}

const EXPLICIT_DATE_REGEX = /\b\d{4}-\d{2}-\d{2}\b/;
const TODAY_KEYWORDS = ['今日', '今天', '而家', '依家', '宜家', 'today', 'now'];
const CHAT_MODES: ChatMode[] = ['G1', 'G2', 'G3', 'B'];
const CANCEL_KEYWORDS = ['不用', '唔使', '取消', '算了', '改日', '唔約', '唔想約'];
const MODE_ROUTER_CONTEXT_MESSAGE_COUNT = 6;

// ---------------------------------------------------------------------------
// Feature Flags
// ---------------------------------------------------------------------------

function isStreamingEnabled(): boolean {
  return process.env.CHAT_STREAMING_ENABLED === 'true';
}

function isSemanticModeRouterEnabled(): boolean {
  return process.env.CHAT_V2_SEMANTIC_ROUTER_ENABLED !== 'false';
}

function getSemanticModeRouterConfidenceThreshold(): number {
  const raw = Number(process.env.CHAT_V2_SEMANTIC_ROUTER_CONFIDENCE ?? '0.75');
  if (!Number.isFinite(raw)) return 0.75;
  return Math.max(0, Math.min(1, raw));
}

function getSemanticModeRouterTimeoutMs(): number {
  const raw = Number(process.env.CHAT_V2_SEMANTIC_ROUTER_TIMEOUT_MS ?? '350');
  if (!Number.isFinite(raw) || raw <= 0) return 350;
  return Math.round(raw);
}

function getTodayInHongKong(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date());
}

function shouldForceTodayDate(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  const hasTodayKeyword = TODAY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  if (!hasTodayKeyword) return false;
  return !EXPLICIT_DATE_REGEX.test(userMessage);
}

// ---------------------------------------------------------------------------
// Mode Detection
// ---------------------------------------------------------------------------

const BOOKING_KEYWORDS = [
  '預約', '約診', 'book', '改期', '取消預約',
  'reschedule', 'cancel', '邊日有空', '幾時有得睇',
];

const G2_KEYWORDS = [
  '點解', '原理', '理論', '詳細', '解釋', 'explain', 'why', '想知多啲',
];

const G3_KEYWORDS = [
  '困擾', '一直', '成日', '唔知點算', '幫我分析', '教我', 'coach',
];

function isChatMode(value: unknown): value is ChatMode {
  return typeof value === 'string' && CHAT_MODES.includes(value as ChatMode);
}

function resolveModeByRules(messages: ChatMessagePayload[]): ModeRuleResolution {
  const latestMessage = messages[messages.length - 1]?.content || '';
  const lower = latestMessage.toLowerCase();

  // Check recent conversation history (last 5 messages) for booking intent
  const recentMessages = messages.slice(-5);
  const hasRecentBookingIntent = recentMessages.some(msg => {
    const msgLower = msg.content.toLowerCase();
    return BOOKING_KEYWORDS.some(kw => msgLower.includes(kw.toLowerCase()));
  });

  const signals: ModeRuleSignals = {
    latestLength: lower.length,
    hasLatestBookingKeyword: BOOKING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase())),
    hasRecentBookingIntent,
    explicitCancel: CANCEL_KEYWORDS.some((kw) => lower.includes(kw)),
    hasLatestG2Keyword: G2_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase())),
    hasLatestG3Keyword: G3_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase())),
  };

  // If there's recent booking intent and no explicit cancellation, stay in B mode
  if (signals.hasRecentBookingIntent && !signals.explicitCancel) {
    return { mode: 'B', signals };
  }

  // Check for explicit booking keywords in latest message
  if (signals.hasLatestBookingKeyword) {
    return { mode: 'B', signals };
  }

  if (signals.latestLength > 150 || signals.hasLatestG3Keyword) {
    return { mode: 'G3', signals };
  }

  if (signals.hasLatestG2Keyword) {
    return { mode: 'G2', signals };
  }

  return { mode: 'G1', signals };
}

function shouldRunSemanticModeRouter(signals: ModeRuleSignals): boolean {
  // Keep explicit booking/cancel deterministic to avoid unnecessary latency.
  if (signals.hasLatestBookingKeyword || signals.explicitCancel) return false;

  if (signals.hasRecentBookingIntent) return true;
  if (signals.hasLatestG2Keyword && signals.hasLatestG3Keyword) return true;

  // Borderline long prompts around the G3 threshold are the main ambiguity zone.
  return signals.latestLength >= 120 && signals.latestLength <= 220;
}

function buildSemanticRouterPrompt(
  messages: ChatMessagePayload[],
  ruleMode: ChatMode,
): string {
  const compactConversation = messages
    .slice(-MODE_ROUTER_CONTEXT_MESSAGE_COUNT)
    .map((msg, index) => `${index + 1}. ${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');

  return `你係 Eden Chatbot v2 的 mode router。你只可以輸出 JSON，禁止任何額外文字。

請只判斷「下一個回覆」應該使用邊個 mode：
- B: 預約/改期/取消/醫師時段/診所流程
- G1: 一般簡短健康問答
- G2: 要求原理、原因、較詳細解釋
- G3: 深度教練式引導、長篇複雜分析、持續困擾

目前規則引擎預判 mode：${ruleMode}

輸出格式（嚴格）：
{"mode":"B|G1|G2|G3","confidence":0.0,"reasons":["tag1","tag2"]}

要求：
- confidence 必須是 0 到 1 的數字
- reasons 使用短標籤（最多 3 個）
- 只輸出一個 JSON object

最近對話：
${compactConversation}`;
}

function extractFirstJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

function parseSemanticRouterDecision(raw: string): SemanticRouterDecision | null {
  const jsonPayload = extractFirstJsonObject(raw);
  if (!jsonPayload) return null;

  try {
    const parsed = JSON.parse(jsonPayload) as {
      mode?: unknown;
      confidence?: unknown;
      reasons?: unknown;
    };

    if (!isChatMode(parsed.mode)) return null;

    const numericConfidence = typeof parsed.confidence === 'number'
      ? parsed.confidence
      : Number(parsed.confidence);
    if (!Number.isFinite(numericConfidence)) return null;

    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((item): item is string => typeof item === 'string').slice(0, 3)
      : [];

    return {
      mode: parsed.mode,
      confidence: Math.max(0, Math.min(1, numericConfidence)),
      reasons,
    };
  } catch {
    return null;
  }
}

async function runSemanticModeRouter(
  model: GeminiModel,
  messages: ChatMessagePayload[],
  ruleMode: ChatMode,
  timeoutMs: number,
): Promise<SemanticRouterDecision> {
  const routerPrompt = buildSemanticRouterPrompt(messages, ruleMode);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`semantic_router_timeout_${timeoutMs}ms`));
      }, timeoutMs);
    });

    const result = await Promise.race([
      model.generateContent(routerPrompt),
      timeoutPromise,
    ]);

    const parsed = parseSemanticRouterDecision(result.response.text());
    if (!parsed) {
      throw new Error('semantic_router_invalid_json');
    }

    return parsed;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function resolveModeWithRouter(
  messages: ChatMessagePayload[],
  model: GeminiModel,
): Promise<ModeDecision> {
  const ruleResolution = resolveModeByRules(messages);
  const ruleMode = ruleResolution.mode;

  if (!isSemanticModeRouterEnabled()) {
    return {
      mode: ruleMode,
      ruleMode,
      source: 'rules',
      routerAttempted: false,
    };
  }

  if (!shouldRunSemanticModeRouter(ruleResolution.signals)) {
    return {
      mode: ruleMode,
      ruleMode,
      source: 'rules',
      routerAttempted: false,
    };
  }

  const threshold = getSemanticModeRouterConfidenceThreshold();
  const timeoutMs = getSemanticModeRouterTimeoutMs();

  try {
    const semanticDecision = await runSemanticModeRouter(model, messages, ruleMode, timeoutMs);

    if (semanticDecision.confidence >= threshold) {
      return {
        mode: semanticDecision.mode,
        ruleMode,
        source: 'semantic',
        routerAttempted: true,
        routerMode: semanticDecision.mode,
        routerConfidence: semanticDecision.confidence,
        routerReasons: semanticDecision.reasons,
      };
    }

    return {
      mode: ruleMode,
      ruleMode,
      source: 'rules_fallback',
      routerAttempted: true,
      routerMode: semanticDecision.mode,
      routerConfidence: semanticDecision.confidence,
      routerReasons: semanticDecision.reasons,
      routerError: `low_confidence_below_${threshold}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'semantic_router_unknown_error';
    return {
      mode: ruleMode,
      ruleMode,
      source: 'rules_fallback',
      routerAttempted: true,
      routerError: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Resolve Constitution from User Profile
// ---------------------------------------------------------------------------

async function resolveConstitution(userId: string): Promise<ConstitutionType> {
  const supabase = createServiceClient();

  // Priority 1: patient_care_profile (doctor-assigned)
  const { data: careProfile } = await supabase
    .from('patient_care_profile')
    .select('constitution')
    .eq('patient_user_id', userId)
    .maybeSingle();

  if (careProfile?.constitution && ['depleting', 'crossing', 'hoarding'].includes(careProfile.constitution)) {
    return careProfile.constitution as ConstitutionType;
  }

  // Priority 2: profiles.constitution_type (quiz result)
  const { data: profile } = await supabase
    .from('profiles')
    .select('constitution_type')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.constitution_type && ['depleting', 'crossing', 'hoarding'].includes(profile.constitution_type)) {
    return profile.constitution_type as ConstitutionType;
  }

  // Default
  return 'depleting';
}

// ---------------------------------------------------------------------------
// Hardcoded Fallback Prompts (used when DB has no settings)
// ---------------------------------------------------------------------------

const FALLBACK_CONSTITUTION_CONTEXT: Record<ConstitutionType, string> = {
  depleting:
    '用戶屬於「虛損型」體質。重點關注氣血不足、津液虧虛的問題。建議方向包括補氣養血、滋陰潤燥、健脾益腎。避免過度勞累和寒涼飲食。',
  crossing:
    '用戶屬於「交叉型」體質。重點關注寒熱錯雜、虛實夾雜的複合狀態。建議方向包括平衡寒熱、扶正祛邪、調和陰陽。需要根據具體症狀靈活調整。',
  hoarding:
    '用戶屬於「積滯型」體質。重點關注痰濕、瘀血、食積等停滯問題。建議方向包括化痰祛濕、活血化瘀、消食導滯。鼓勵適量運動和清淡飲食。',
};

const FALLBACK_MODE_PROMPTS: Record<ChatMode, string> = {
  G1: '用簡短方式回答（2-3句），然後問一個引導問題，例如「想知多啲關於呢方面嘅原理嗎？」',
  G2: '提供詳細嘅理論原理說明，包括中醫理論基礎，用段落方式解釋。',
  G3: '以教練模式進行深入引導式對話。先理解用戶情況，提問引導反思，給予個人化建議。用同理心回應。',
  B: `你係醫天圓預約助手。你**必須**使用提供的 functions 來完成預約。**絕對唔可以**假裝完成預約或者話「已經幫你完成登記」而冇真正調用 functions。

【B 模式最高優先回覆規則】
- 只處理預約相關內容：醫師、診所、日期、時間、病人資料、確認、改期、取消。
- 除非用戶明確要求健康/體質/飲食建議，否則**唔好主動提供**任何調理或體質內容。
- 如果用戶提及症狀（例如感冒），先當作「預約備註」收集，不要展開健康建議。
- 每次只問一條下一步最必要問題，避免一次過問多條。
- 如用戶主動想要健康建議，先簡短確認：「你想我完成預約後，再補充1-2句調理建議嗎？」

**關鍵規則（必須遵守）：**
1. 查時段：**必須調用 get_available_slots**，唔可以自己編造時段
2. 完成預約：**必須調用 create_booking**，唔可以話「已完成」而冇調用
3. 查本人預約紀錄：當用戶問「我預約咗幾時／我有咩預約」時，**必須調用 list_my_bookings**
4. 收集資料：
   - **姓名、電話：一定要問**
   - **首診/覆診：一定要問**（visitType = first 或 followup）
   - **收據需求：一定要問**（needReceipt = no / yes_insurance / yes_not_insurance）
   - **取藥方法：一定要問**（medicationPickup = none / lalamove / sfexpress / clinic_pickup）
   - **Email：睇用戶係咪已登入**
     - 如果【用戶登入資料】有提供 email → **直接用，唔好再問**
     - 如果冇【用戶登入資料】→ **一定要問**用戶提供 email
   - Email 係用嚟傳送預約確認信，所以必須要有
   - **如果 visitType = first（首診）**，必須再收集：
     - idCard, dob, gender, allergies, medications, symptoms, referralSource
   - call create_booking 時，enum 欄位必須用以下代碼：
     - visitType: first / followup
     - needReceipt: no / yes_insurance / yes_not_insurance
     - medicationPickup: none / lalamove / sfexpress / clinic_pickup
     - gender: male / female / other

**預約流程（每一步都要做）：**
步驟 1：調用 **list_doctors** 或詢問醫師名稱
步驟 2：用戶提供醫師、日期、診所後，**立即調用 get_available_slots(醫師名, 日期, 診所)**
步驟 3：顯示 function 返回的時段，讓用戶選擇
步驟 4：**收集病人資料**
   - 一定要問：姓名、電話、首診/覆診、收據需求、取藥方法
   - Email：如果【用戶登入資料】有 email，直接用；如果冇，先問
   - 若首診：再問身份證、生日、性別、過敏史、現服藥物、主要症狀、得知來源
步驟 5：**調用 create_booking(所有資料，包括 email)**
步驟 6：**等 function 返回成功**後，先話「預約成功」
步驟 7：提醒用戶「我哋已經傳咗預約確認信去你嘅 email，請查收」

**絕對唔准做嘅嘢：**
❌ 唔准自己編造時段（必須調用 get_available_slots）
❌ 唔准話「已經幫你完成登記」而冇調用 create_booking
❌ 用戶問預約紀錄時，唔准靠估或者只叫對方自行查 email（除非 list_my_bookings 返回失敗/需要登入）
❌ 唔准問已登入用戶提供 email（如果【用戶登入資料】有 email，直接用）
❌ 唔准話「預約成功」但係 create_booking 未返回 success

例子 1（已登入用戶）：
用戶：「我想預約李醫師，荃灣，2月28號」
你：**立即調用 get_available_slots("李芊霖醫師", "2026-02-28", "荃灣")**
（等 function 返回）
你：「以下係可用時段：[顯示時段]」
用戶：「10:00」
你：「請提供姓名同電話」（**唔好問 email，因為【用戶登入資料】已經有**）
用戶：「陳大文 98765432」
你：**調用 create_booking("李芊霖醫師", "荃灣", "2026-02-28", "10:00", "陳大文", "98765432")**
（email 會自動從【用戶登入資料】注入）

例子 2（未登入用戶）：
同上，但係要問埋 email：「請提供姓名、電話同 email」

用親切的廣東話回應。`,
};

const SYMPTOM_RECORDING_GUIDANCE = `【症狀記錄功能】
你具備幫用戶記錄身體症狀的功能。注意以下原則：
1. 當用戶「描述」自己的症狀時（例如「我今日頭痛」「我最近失眠」），先 call log_symptom 記錄，再回覆
2. 回覆時先自然提及「我幫你記錄低咗，醫師睇症時會參考」，再提供 1-2 句安全建議
3. 當用戶「詢問」症狀原因時（例如「頭痛點算好」），先回答，再按語境決定是否建議記錄
4. 如果用戶話症狀好返，call update_symptom 更新狀態
5. 如果用戶問歷史記錄，call list_my_symptoms`;

const OUTPUT_FORMAT_RULES = `【輸出格式規則（必須遵守）】
- 禁止使用 Markdown 星號格式（包括 *、**、***）。
- 禁止輸出任何星號字元 *。
- 需要強調時，請用自然語句、全形標點或換行，不要用星號。
- 禁止提供「吸幾拍/呼幾拍/做幾多分鐘/做幾多次」等固定數字式身心練習指令，避免故弄玄虛或假精準。
- 除非用戶明確要求呼吸練習，否則不要主動建議呼吸訓練；若涉及急症紅旗（例如呼吸困難），仍要優先提示即時求助。`;

function buildBookingSystemPrompt(careContext: string): string {
  const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
  const doctorInfo = getPromptDoctorInfoLines().map((line) => `- ${line}`).join('\n');
  const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

  return `你係醫天圓中醫診所的 AI 預約助手。請用繁體中文（廣東話口語）回覆。

${FALLBACK_MODE_PROMPTS.B}

【預約模式範圍】
- 只做：查詢時段、收集預約資料、確認、建立預約、改期、取消、查本人預約紀錄
- 唔做：主動提供體質分析、飲食禁忌、作息建議（除非用戶明確要求）

【可選健康建議規則】
- 只有當用戶清楚提出「想要健康/飲食/體質建議」先可以提供
- 就算提供，都要保持 1-2 句，並提醒用戶可切換回健康諮詢模式深入了解

【對話節奏】
- 回覆先講清楚預約進度，再提出下一條必要問題
- 一次只問一條問題

【地址與地圖回覆規則】
- 當用戶要求診所地址或地圖時，只可使用「診所資訊」段落內提供的地址與 Google 地圖連結。
- 必須直接提供完整可點擊 URL。
- 禁止提供示意連結、臨時編造連結，或叫用戶自行搜尋作為主要答案。

【醫師資訊】
${doctorInfo}

【診所資訊】
${clinicInfo}

【WhatsApp 聯絡】
${whatsappInfo}

【預約連結】
https://edentcm.as.me/schedule.php

${SYMPTOM_RECORDING_GUIDANCE}
${careContext}
`;
}

// ---------------------------------------------------------------------------
// Care Context Fetching
// ---------------------------------------------------------------------------

async function fetchCareContext(userId: string): Promise<string> {
  const supabase = createServiceClient();
  const lines: string[] = [];

  const { data: profile } = await supabase
    .from('patient_care_profile')
    .select('constitution, constitution_note')
    .eq('patient_user_id', userId)
    .maybeSingle();

  if (profile) {
    if (profile.constitution) {
      lines.push(`病人體質分類：${profile.constitution}`);
    }
    if (profile.constitution_note) {
      lines.push(`體質備註：${profile.constitution_note}`);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const { data: instructions } = await supabase
    .from('care_instructions')
    .select('title, content_md')
    .eq('patient_user_id', userId)
    .eq('status', 'active')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .limit(5);

  if (instructions && instructions.length > 0) {
    lines.push('目前照護指示：');
    for (const inst of instructions) {
      lines.push(`- ${inst.title}: ${inst.content_md}`);
    }
  }

  const { data: followUp } = await supabase
    .from('follow_up_plans')
    .select('suggested_date, reason')
    .eq('patient_user_id', userId)
    .eq('status', 'pending')
    .order('suggested_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (followUp) {
    lines.push(`下次跟進：${followUp.suggested_date}${followUp.reason ? `（${followUp.reason}）` : ''}`);
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

  const { data: symptoms } = await supabase
    .from('symptom_logs')
    .select('id, category, description, severity, status, started_at, ended_at')
    .eq('patient_user_id', userId)
    .or(`status.eq.active,ended_at.gte.${twoWeeksAgoStr}`)
    .order('started_at', { ascending: false })
    .limit(10);

  if (symptoms && symptoms.length > 0) {
    lines.push('近期症狀記錄（更新狀態時請使用對應 ID）：');
    for (const symptom of symptoms) {
      const datePart = symptom.ended_at
        ? `${symptom.started_at}→${symptom.ended_at}`
        : `${symptom.started_at} 至今`;
      const severityPart = symptom.severity ? ` 嚴重度${symptom.severity}/5` : '';
      const descPart = symptom.description ? `：${symptom.description}` : '';
      lines.push(`- [ID: ${symptom.id}] ${symptom.category}（${datePart}，${symptom.status}）${severityPart}${descPart}`);
    }
  }

  return lines.length > 0 ? '\n\n【病人個人化照護資料】\n' + lines.join('\n') : '';
}

// ---------------------------------------------------------------------------
// Token Metrics
// ---------------------------------------------------------------------------

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  const cjkCount = (trimmed.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latinCount = (trimmed.match(/[A-Za-z0-9]/g) || []).length;
  const symbolCount = Math.max(trimmed.length - cjkCount - latinCount, 0);

  return Math.max(1, Math.ceil(cjkCount * 1.15 + latinCount / 3.8 + symbolCount / 2.2));
}

function resolveTokenMetrics(
  usage: GeminiUsageMetadata | undefined,
  promptText: string,
  completionText: string,
  durationMs: number,
  error?: string,
): TokenUsageMetrics {
  return {
    promptTokens: usage?.promptTokenCount ?? estimateTokens(promptText),
    completionTokens: usage?.candidatesTokenCount ?? estimateTokens(completionText),
    durationMs,
    ...(error ? { error } : {}),
  };
}

function getUsageMetadata(response: unknown): GeminiUsageMetadata | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const maybeUsage = (response as { usageMetadata?: GeminiUsageMetadata }).usageMetadata;
  if (!maybeUsage || typeof maybeUsage !== 'object') return undefined;
  return maybeUsage;
}

function sanitizeAssistantReply(text: string): string {
  if (!text) return text;
  return text.replace(/\*/g, '');
}

function formatValidationIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

const STREAM_ERROR_MESSAGE = 'Streaming request failed.';
const INTERNAL_ERROR_MESSAGE = 'Failed to generate AI response.';
const INVALID_JSON_MESSAGE = 'Request body must be valid JSON.';
const INVALID_PAYLOAD_MESSAGE = 'Invalid request payload.';

// ---------------------------------------------------------------------------
// Chat Logging
// ---------------------------------------------------------------------------

async function logChatMessages(
  sessionId: string,
  userContent: string,
  assistantContent: string,
  mode: ChatMode,
  metrics: TokenUsageMetrics,
) {
  try {
    const supabase = createServiceClient();

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'user',
      content_text: userContent,
      model_gear: mode,
    });

    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content_text: assistantContent,
      model_gear: mode,
    });

    await supabase.from('chat_request_logs').insert({
      session_id: sessionId,
      model_id: 'gemini-flash-latest',
      prompt_tokens: metrics.promptTokens,
      completion_tokens: metrics.completionTokens,
      duration_ms: metrics.durationMs,
      ...(metrics.error ? { error: metrics.error } : {}),
    });
  } catch (error) {
    console.error('[chat/v2] Failed to log chat messages:', error);
  }
}

// ---------------------------------------------------------------------------
// Function Calling Definitions for Booking
// ---------------------------------------------------------------------------

const BOOKING_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'list_doctors',
    description: '列出所有可預約的醫師及其時間表',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_available_slots',
    description: '查詢某位醫師在某個診所的可用時段',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        doctorNameZh: {
          type: SchemaType.STRING,
          description: '醫師中文名稱（例如：陳家富醫師、李芊霖醫師）',
        },
        date: {
          type: SchemaType.STRING,
          description: '預約日期，格式為 YYYY-MM-DD（例如：2026-02-20）',
        },
        clinicNameZh: {
          type: SchemaType.STRING,
          description: '診所中文名稱（例如：中環、佐敦、荃灣）。如果不提供，會返回該醫師所有可用的診所',
        },
      },
      required: ['doctorNameZh', 'date'],
    },
  },
  {
    name: 'list_my_bookings',
    description: '查詢目前登入用戶的預約紀錄（優先返回未來預約）',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: {
          type: SchemaType.INTEGER,
          description: '返回未來預約的數量上限（1-10，預設 5）',
        },
      },
    },
  },
  {
    name: 'create_booking',
    description: '為病人創建預約',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        doctorNameZh: {
          type: SchemaType.STRING,
          description: '醫師中文名稱',
        },
        clinicNameZh: {
          type: SchemaType.STRING,
          description: '診所中文名稱',
        },
        date: {
          type: SchemaType.STRING,
          description: '預約日期，格式為 YYYY-MM-DD',
        },
        time: {
          type: SchemaType.STRING,
          description: '預約時間，格式為 HH:mm（24小時制）',
        },
        patientName: {
          type: SchemaType.STRING,
          description: '病人姓名',
        },
        phone: {
          type: SchemaType.STRING,
          description: '病人電話號碼',
        },
        email: {
          type: SchemaType.STRING,
          description: '病人電郵地址（必須提供，用於傳送預約確認信）',
        },
        visitType: {
          type: SchemaType.STRING,
          description: '診症類型：first（首診）或 followup（覆診）',
        },
        needReceipt: {
          type: SchemaType.STRING,
          description: '收據需求：no / yes_insurance / yes_not_insurance',
        },
        medicationPickup: {
          type: SchemaType.STRING,
          description: '取藥方法：none / lalamove / sfexpress / clinic_pickup',
        },
        idCard: {
          type: SchemaType.STRING,
          description: '身份證資料（首診必填）',
        },
        dob: {
          type: SchemaType.STRING,
          description: '出生日期（首診必填）',
        },
        gender: {
          type: SchemaType.STRING,
          description: '性別：male / female / other（首診必填）',
        },
        allergies: {
          type: SchemaType.STRING,
          description: '過敏史（首診必填）',
        },
        medications: {
          type: SchemaType.STRING,
          description: '現服用藥物（首診必填）',
        },
        symptoms: {
          type: SchemaType.STRING,
          description: '主要症狀（首診必填）',
        },
        referralSource: {
          type: SchemaType.STRING,
          description: '得知來源（首診必填）',
        },
        notes: {
          type: SchemaType.STRING,
          description: '備註（可選）',
        },
      },
      required: [
        'doctorNameZh',
        'clinicNameZh',
        'date',
        'time',
        'patientName',
        'phone',
        'visitType',
        'needReceipt',
        'medicationPickup',
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Function Calling Definitions for Symptoms
// ---------------------------------------------------------------------------

const SYMPTOM_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'log_symptom',
    description: '記錄用戶的身體症狀。當用戶「描述」症狀時使用（例如「我今日頭痛」「我最近失眠」）。不要用於「詢問」症狀原因。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: '症狀類別（例如：頭痛、經期、失眠、胃痛、腰痛、咳嗽、鼻敏感、濕疹）',
        },
        description: {
          type: SchemaType.STRING,
          description: '症狀的詳細描述（用戶原話或摘要）',
        },
        severity: {
          type: SchemaType.INTEGER,
          description: '嚴重程度 1-5（1=輕微偶爾 2=輕度但注意到 3=中度影響日常 4=嚴重影響生活 5=非常嚴重需就醫）。如果用戶沒有明確說，根據描述推斷。',
        },
        startedAt: {
          type: SchemaType.STRING,
          description: '症狀開始日期，格式 YYYY-MM-DD。如果用戶說「今日」就用今天日期。',
        },
        endedAt: {
          type: SchemaType.STRING,
          description: '症狀結束日期，格式 YYYY-MM-DD。如果仍然持續則不提供。',
        },
      },
      required: ['category', 'startedAt'],
    },
  },
  {
    name: 'update_symptom',
    description: '更新症狀狀態，通常是標記症狀已結束。當用戶說「我頭痛好返了」「經期完了」時使用。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symptomId: {
          type: SchemaType.STRING,
          description: '症狀ID（從之前的對話記錄中獲取）',
        },
        endedAt: {
          type: SchemaType.STRING,
          description: '症狀結束日期，格式 YYYY-MM-DD',
        },
        status: {
          type: SchemaType.STRING,
          description: '新狀態：resolved（已好）或 recurring（反覆出現）',
        },
      },
      required: ['symptomId'],
    },
  },
  {
    name: 'list_my_symptoms',
    description: '查詢用戶的症狀記錄歷史。當用戶問「我之前有咩症狀」「我上次頭痛係幾時」時使用。',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: '篩選特定類別的症狀（可選）',
        },
        status: {
          type: SchemaType.STRING,
          description: '篩選狀態：active（進行中）、resolved（已好）、recurring（反覆）、all（全部）。默認 all。',
        },
        limit: {
          type: SchemaType.INTEGER,
          description: '返回數量上限，默認 10',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Function Call Handler
// ---------------------------------------------------------------------------

async function handleFunctionCall(
  functionName: string,
  functionArgs: object,
  userEmail?: string,
  userId?: string,
  sessionId?: string,
  latestUserMessage?: string,
): Promise<object> {
  console.log(`[chat/v2] Calling function: ${functionName}`, functionArgs);

  const args = functionArgs as Record<string, unknown>;

  switch (functionName) {
    case 'list_doctors': {
      const result = await listBookableDoctors();
      return result;
    }

    case 'get_available_slots': {
      const { doctorNameZh, date, clinicNameZh } = args;
      const result = await getAvailableTimeSlots(
        doctorNameZh as string,
        date as string,
        clinicNameZh as string | undefined
      );
      return result;
    }

    case 'create_booking': {
      // Inject user email if not provided by AI and user is logged in
      const bookingArgs = { ...args };
      if (!bookingArgs.email && userEmail) {
        bookingArgs.email = userEmail;
        console.log(`[chat/v2] Injected logged-in user email: ${userEmail}`);
      }
      const result = await createConversationalBooking(bookingArgs as any, {
        userId,
        sessionId,
      });
      return result;
    }

    case 'list_my_bookings': {
      if (!userId) return { success: false, error: '需要登入才能查看預約紀錄' };

      const limitArg = args.limit;
      const parsedLimit =
        typeof limitArg === 'number' && Number.isFinite(limitArg)
          ? Math.floor(limitArg)
          : undefined;

      const result = await listMyBookings(userId, {
        userEmail,
        limit: parsedLimit,
      });
      return result;
    }

    case 'log_symptom': {
      if (!userId) return { success: false, error: '需要登入才能記錄症狀' };
      const symptomArgs = { ...args };
      if (latestUserMessage && shouldForceTodayDate(latestUserMessage)) {
        symptomArgs.startedAt = getTodayInHongKong();
      }
      const result = await logSymptom(userId, symptomArgs as any);
      return result;
    }

    case 'update_symptom': {
      if (!userId) return { success: false, error: '需要登入才能更新症狀' };
      const symptomArgs = { ...args };
      if (latestUserMessage && shouldForceTodayDate(latestUserMessage)) {
        symptomArgs.endedAt = getTodayInHongKong();
      }
      const result = await updateSymptom(userId, symptomArgs as any);
      return result;
    }

    case 'list_my_symptoms': {
      if (!userId) return { success: false, error: '需要登入才能查看症狀記錄' };
      const result = await listSymptoms(userId, args as any);
      return result;
    }

    default:
      return { error: `Unknown function: ${functionName}` };
  }
}

function resolveFunctionTools(
  mode: ChatMode,
  userId?: string,
): { functionDeclarations: FunctionDeclaration[] }[] | undefined {
  if (mode === 'B') {
    return [{ functionDeclarations: [...BOOKING_FUNCTIONS, ...SYMPTOM_FUNCTIONS] }];
  }

  if (userId) {
    return [{ functionDeclarations: SYMPTOM_FUNCTIONS }];
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Build System Prompt (DB-driven with fallback)
// ---------------------------------------------------------------------------

function buildFallbackPrompt(
  type: ConstitutionType,
  mode: ChatMode,
  careContext: string,
  contentContext: string,
): string {
  const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
  const doctorInfo = getPromptDoctorInfoLines().map((line) => `- ${line}`).join('\n');
  const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

  return `你係醫天圓中醫診所的 AI 體質顧問，角色設定係親切、專業的中醫健康助理。請用繁體中文（廣東話口語）回答用戶問題。

【回答模式】
${FALLBACK_MODE_PROMPTS[mode]}

【用戶體質背景】
${FALLBACK_CONSTITUTION_CONTEXT[type]}
${careContext}
${contentContext}

【診所資訊】
${clinicInfo}

【醫師資訊】
${doctorInfo}

【WhatsApp 聯絡】
${whatsappInfo}

【收費參考】
診金 $100/次，基本藥費 $80 起/劑，針灸 $300-500/次，正骨手法 $350-700/次，拔罐 $350/次
${mode !== 'B' ? `
如果問題涉及預約、詳細收費、或需要真人協助，請引導用戶：
- 預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/

重要提示：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。` : ''}`;
}

async function buildSystemPrompt(
  type: ConstitutionType,
  mode: ChatMode,
  careContext: string,
  contentContext: string,
): Promise<string> {
  if (mode === 'B') {
    return buildBookingSystemPrompt(careContext);
  }

  const supabase = createServiceClient();

  const { data: settings, error: settingsError } = await supabase
    .from('chat_prompt_settings')
    .select('prompt_md, gear_g1_md, gear_g2_md, gear_g3_md, extra_instructions_md')
    .eq('type', type)
    .eq('is_active', true)
    .maybeSingle();

  if (settingsError) {
    console.error('[chat/v2] Failed to fetch chat_prompt_settings:', settingsError);
  }

  const { data: docs, error: docsError } = await supabase
    .from('knowledge_docs')
    .select('title, content_md')
    .eq('type', type)
    .eq('enabled', true)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (docsError) {
    console.error('[chat/v2] Failed to fetch knowledge_docs:', docsError);
  }

  if (!settings) {
    return buildFallbackPrompt(type, mode, careContext, contentContext);
  }

  const knowledgeEntries = (docs || [])
    .map((d) => `【${d.title}】\n${d.content_md}`)
    .join('\n\n');
  const sourcesList = (docs || []).map((d) => d.title).join('、');

  let systemPrompt = settings.prompt_md
    .replace('{{KNOWLEDGE}}', knowledgeEntries || '（暫無站內知識庫內容）')
    .replace('{{SOURCES}}', sourcesList || '（無）')
    .replace('{{EXTRA_INSTRUCTIONS}}', settings.extra_instructions_md || '');

  const gearMap: Record<string, string | null> = {
    G1: settings.gear_g1_md,
    G2: settings.gear_g2_md,
    G3: settings.gear_g3_md,
  };

  if (gearMap[mode]) {
    systemPrompt += '\n\n【當前回覆檔位】\n' + gearMap[mode];
  }

  if (careContext) {
    systemPrompt += careContext;
  }

  if (contentContext) {
    systemPrompt += contentContext;
  }

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    let jsonBody: unknown;
    try {
      jsonBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: INVALID_JSON_MESSAGE, code: 'CHAT_V2_INVALID_JSON' },
        { status: 400 },
      );
    }

    const parsedBody = CHAT_REQUEST_SCHEMA.safeParse(jsonBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: INVALID_PAYLOAD_MESSAGE,
          code: 'CHAT_V2_INVALID_PAYLOAD',
          details: formatValidationIssues(parsedBody.error),
        },
        { status: 400 },
      );
    }

    const body = parsedBody.data;
    const { sessionId, messages } = body;
    const streamRequested = body.stream === true;

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: INVALID_PAYLOAD_MESSAGE, code: 'CHAT_V2_NO_USER_MESSAGE' },
        { status: 400 },
      );
    }

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const modeDecision = await resolveModeWithRouter(messages, model);
    const mode = modeDecision.mode;
    console.log('[chat/v2] Mode decision:', modeDecision);

    // Resolve constitution type from user profile (auto-detect)
    let type: ConstitutionType = 'depleting'; // default for unauthenticated
    let careContext = '';
    let contentContext = '';
    let userEmail: string | undefined;
    let userId: string | undefined;

    try {
      const user = await getCurrentUser();
      if (user) {
        userId = user.id;
        type = await resolveConstitution(user.id);
        careContext = await fetchCareContext(user.id);
        userEmail = user.email; // Extract user email for booking
      }
    } catch {
      // Not authenticated — continue with defaults
    }

    if (mode !== 'B') {
      contentContext = await buildContentReferenceContext(latestUserMessage.content, 4);
    }

    // Build system prompt (DB-driven with fallback)
    let systemPrompt = await buildSystemPrompt(type, mode, careContext, contentContext);
    if (userId && mode !== 'B') {
      // G modes also need explicit symptom logging behavior guidance.
      systemPrompt += `\n\n${SYMPTOM_RECORDING_GUIDANCE}`;
    }
    systemPrompt += `\n\n${OUTPUT_FORMAT_RULES}`;

    const conversationHistory = messages
      .map((m) => `${m.role === 'user' ? '用戶' : 'AI助手'}：${m.content}`)
      .join('\n\n');

    // Add user login info if available (for booking flow)
    let userInfoSection = '';
    if (userEmail) {
      userInfoSection = `\n\n【用戶登入資料】\n用戶已登入系統，電郵地址：${userEmail}\n**重要：預約時直接使用此 email，唔需要再問用戶提供。**\n`;
    }

    const todayInHk = getTodayInHongKong();
    const dateGuardrailSection = `\n\n【當前日期（香港時間）】\n今天是 ${todayInHk}。\n當用戶講「今日／今天／而家／依家／today／now」而無提供具體日期時，症狀記錄日期必須用 ${todayInHk}（YYYY-MM-DD）。`;
    const fullPrompt = `${systemPrompt}${userInfoSection}${dateGuardrailSection}\n\n【對話記錄】\n${conversationHistory}\n\nAI助手：`;

    const tools = resolveFunctionTools(mode, userId);

    const streamEnabled = isStreamingEnabled();
    if (streamRequested && streamEnabled && !tools) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const push = (payload: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          };

          (async () => {
            let finalReply = '';
            let usage: GeminiUsageMetadata | undefined;

            try {
              const result = await model.generateContentStream(fullPrompt);
              push({ type: 'meta', mode, constitutionType: type });

              for await (const chunk of result.stream) {
                const text = chunk.text();
                if (!text) continue;
                finalReply += text;
                push({ type: 'delta', text: sanitizeAssistantReply(text) });
              }

              const finalResponse = await result.response;
              usage = getUsageMetadata(finalResponse);

              if (!finalReply) {
                finalReply = finalResponse.text();
              }

              finalReply = sanitizeAssistantReply(finalReply);

              const durationMs = Date.now() - startTime;
              const metrics = resolveTokenMetrics(usage, fullPrompt, finalReply, durationMs);
              void logChatMessages(sessionId, latestUserMessage.content, finalReply, mode, metrics);

              push({
                type: 'done',
                reply: finalReply,
                mode,
                constitutionType: type,
                promptTokens: metrics.promptTokens,
                completionTokens: metrics.completionTokens,
                durationMs: metrics.durationMs,
              });
              controller.close();
            } catch (streamError) {
              const message = streamError instanceof Error ? streamError.message : 'Unknown streaming error';
              const durationMs = Date.now() - startTime;
              const metrics = resolveTokenMetrics(usage, fullPrompt, finalReply, durationMs, message);
              if (finalReply) {
                void logChatMessages(sessionId, latestUserMessage.content, finalReply, mode, metrics);
              }

              push({
                type: 'error',
                error: STREAM_ERROR_MESSAGE,
                code: 'CHAT_V2_STREAM_FAILED',
              });
              controller.close();
            }
          })().catch((unexpectedError) => {
            const message = unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error';
            console.error('[chat/v2] Unexpected streaming wrapper error:', message);
            push({
              type: 'error',
              error: STREAM_ERROR_MESSAGE,
              code: 'CHAT_V2_STREAM_FAILED',
            });
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    // Use chat API for function calling, or generateContent for simple mode
    let reply: string;
    let finalResponse: any;

    if (tools) {
      // Use chat API for function calling support
      const chat = model.startChat({ tools });

      let result = await chat.sendMessage(fullPrompt);
      let response = result.response;

      // Handle function calls (may require multiple rounds)
      let functionCallRounds = 0;
      const MAX_FUNCTION_ROUNDS = 5;

      while (
        functionCallRounds < MAX_FUNCTION_ROUNDS &&
        response.candidates?.[0]?.content?.parts?.some((part: any) => part.functionCall)
      ) {
        functionCallRounds++;

        const functionCall = response.candidates[0].content.parts.find(
          (part: any) => part.functionCall
        )?.functionCall;

        if (!functionCall) break;

        const functionName = functionCall.name;
        const functionArgs = functionCall.args || {};

        console.log(`[chat/v2] Function call round ${functionCallRounds}:`, functionName, functionArgs);

        // Execute the function
        const functionResult = await handleFunctionCall(
          functionName,
          functionArgs,
          userEmail,
          userId,
          sessionId,
          latestUserMessage.content,
        );

        // Send function result back to Gemini
        result = await chat.sendMessage([{
          functionResponse: {
            name: functionName,
            response: functionResult,
          },
        }]);

        response = result.response;
      }

      reply = response.text();
      finalResponse = response;
    } else {
      // No function calling tools - use simple generateContent
      const result = await model.generateContent(fullPrompt);
      finalResponse = result.response;
      reply = finalResponse.text();
    }

    reply = sanitizeAssistantReply(reply);

    const usage = getUsageMetadata(finalResponse);
    const durationMs = Date.now() - startTime;
    const metrics = resolveTokenMetrics(usage, fullPrompt, reply, durationMs);

    // Log messages (fire-and-forget)
    void logChatMessages(sessionId, latestUserMessage.content, reply, mode, metrics);

    return NextResponse.json({ reply, mode, type });
  } catch (error) {
    console.error('[chat/v2] Error:', error);
    return NextResponse.json(
      {
        error: INTERNAL_ERROR_MESSAGE,
        code: 'CHAT_V2_INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
