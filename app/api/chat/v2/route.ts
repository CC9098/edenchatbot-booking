import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLines } from '@/shared/clinic-schedule-data';
import {
  listBookableDoctors,
  getAvailableTimeSlots,
  createConversationalBooking,
} from '@/lib/booking-conversation-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConstitutionType = 'depleting' | 'crossing' | 'hoarding';
type ChatMode = 'G1' | 'G2' | 'G3' | 'B';

interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  sessionId: string;
  messages: ChatMessagePayload[];
  stream?: boolean;
}

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

// ---------------------------------------------------------------------------
// Feature Flags
// ---------------------------------------------------------------------------

function isStreamingEnabled(): boolean {
  return process.env.CHAT_STREAMING_ENABLED === 'true';
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

function resolveMode(messages: ChatMessagePayload[]): ChatMode {
  const latestMessage = messages[messages.length - 1]?.content || '';
  const lower = latestMessage.toLowerCase();

  // Check recent conversation history (last 5 messages) for booking intent
  const recentMessages = messages.slice(-5);
  const hasRecentBookingIntent = recentMessages.some(msg => {
    const msgLower = msg.content.toLowerCase();
    return BOOKING_KEYWORDS.some(kw => msgLower.includes(kw.toLowerCase()));
  });

  // Explicit cancellation keywords
  const CANCEL_KEYWORDS = ['不用', '唔使', '取消', '算了', '改日', '唔約', '唔想約'];
  const explicitCancel = CANCEL_KEYWORDS.some(kw => lower.includes(kw));

  // If there's recent booking intent and no explicit cancellation, stay in B mode
  if (hasRecentBookingIntent && !explicitCancel) {
    return 'B';
  }

  // Check for explicit booking keywords in latest message
  if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return 'B';
  }

  if (lower.length > 150 || G3_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return 'G3';
  }

  if (G2_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return 'G2';
  }

  return 'G1';
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
3. 收集資料：
   - **姓名、電話：一定要問**
   - **Email：睇用戶係咪已登入**
     - 如果【用戶登入資料】有提供 email → **直接用，唔好再問**
     - 如果冇【用戶登入資料】→ **一定要問**用戶提供 email
   - Email 係用嚟傳送預約確認信，所以必須要有

**預約流程（每一步都要做）：**
步驟 1：調用 **list_doctors** 或詢問醫師名稱
步驟 2：用戶提供醫師、日期、診所後，**立即調用 get_available_slots(醫師名, 日期, 診所)**
步驟 3：顯示 function 返回的時段，讓用戶選擇
步驟 4：**收集病人資料**
   - 一定要問：姓名、電話
   - Email：如果【用戶登入資料】有 email，直接用；如果冇，先問
步驟 5：**調用 create_booking(所有資料，包括 email)**
步驟 6：**等 function 返回成功**後，先話「預約成功」
步驟 7：提醒用戶「我哋已經傳咗預約確認信去你嘅 email，請查收」

**絕對唔准做嘅嘢：**
❌ 唔准自己編造時段（必須調用 get_available_slots）
❌ 唔准話「已經幫你完成登記」而冇調用 create_booking
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

function buildBookingSystemPrompt(): string {
  const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
  const doctorInfo = getPromptDoctorInfoLines().map((line) => `- ${line}`).join('\n');
  const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

  return `你係醫天圓中醫診所的 AI 預約助手。請用繁體中文（廣東話口語）回覆。

${FALLBACK_MODE_PROMPTS.B}

【預約模式範圍】
- 只做：查詢時段、收集預約資料、確認、建立預約、改期、取消
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
https://edentcm.as.me/schedule.php`;
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
        notes: {
          type: SchemaType.STRING,
          description: '備註（可選）',
        },
      },
      required: ['doctorNameZh', 'clinicNameZh', 'date', 'time', 'patientName', 'phone'],
    },
  },
];

// ---------------------------------------------------------------------------
// Function Call Handler
// ---------------------------------------------------------------------------

async function handleFunctionCall(
  functionName: string,
  functionArgs: object,
  userEmail?: string
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
      const result = await createConversationalBooking(bookingArgs as any);
      return result;
    }

    default:
      return { error: `Unknown function: ${functionName}` };
  }
}

// ---------------------------------------------------------------------------
// Build System Prompt (DB-driven with fallback)
// ---------------------------------------------------------------------------

function buildFallbackPrompt(
  type: ConstitutionType,
  mode: ChatMode,
  careContext: string,
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
): Promise<string> {
  if (mode === 'B') {
    return buildBookingSystemPrompt();
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
    return buildFallbackPrompt(type, mode, careContext);
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

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = (await request.json()) as RequestBody;
    const { sessionId, messages } = body;
    const streamRequested = body.stream === true;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required.' },
        { status: 400 },
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty.' },
        { status: 400 },
      );
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!latestUserMessage) {
      return NextResponse.json(
        { error: 'No user message found in messages array.' },
        { status: 400 },
      );
    }

    // Detect mode from message content
    const mode = resolveMode(messages);

    // Resolve constitution type from user profile (auto-detect)
    let type: ConstitutionType = 'depleting'; // default for unauthenticated
    let careContext = '';
    let userEmail: string | undefined;

    try {
      const user = await getCurrentUser();
      if (user) {
        type = await resolveConstitution(user.id);
        careContext = await fetchCareContext(user.id);
        userEmail = user.email; // Extract user email for booking
      }
    } catch {
      // Not authenticated — continue with defaults
    }

    // Build system prompt (DB-driven with fallback)
    const systemPrompt = await buildSystemPrompt(type, mode, careContext);

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

    const conversationHistory = messages
      .map((m) => `${m.role === 'user' ? '用戶' : 'AI助手'}：${m.content}`)
      .join('\n\n');

    // Add user login info if available (for booking flow)
    let userInfoSection = '';
    if (userEmail) {
      userInfoSection = `\n\n【用戶登入資料】\n用戶已登入系統，電郵地址：${userEmail}\n**重要：預約時直接使用此 email，唔需要再問用戶提供。**\n`;
    }

    const fullPrompt = `${systemPrompt}${userInfoSection}\n\n【對話記錄】\n${conversationHistory}\n\nAI助手：`;

    const streamEnabled = isStreamingEnabled();
    if (streamRequested && streamEnabled) {
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
                push({ type: 'delta', text });
              }

              const finalResponse = await result.response;
              usage = getUsageMetadata(finalResponse);

              if (!finalReply) {
                finalReply = finalResponse.text();
              }

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

              push({ type: 'error', error: message });
              controller.close();
            }
          })().catch((unexpectedError) => {
            const message = unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error';
            push({ type: 'error', error: message });
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

    // For B mode (booking), use chat with function calling
    // For other modes, use simple generateContent
    let reply: string;
    let finalResponse: any;

    if (mode === 'B') {
      // Use chat API for function calling support
      const chat = model.startChat({
        tools: [{ functionDeclarations: BOOKING_FUNCTIONS }],
      });

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
        const functionResult = await handleFunctionCall(functionName, functionArgs, userEmail);

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
      // Simple mode without function calling
      const result = await model.generateContent(fullPrompt);
      finalResponse = result.response;
      reply = finalResponse.text();
    }

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
        error: 'Failed to generate AI response.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
