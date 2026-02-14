import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLines } from '@/shared/clinic-schedule-data';

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

function resolveMode(latestUserMessage: string): ChatMode {
  const lower = latestUserMessage.toLowerCase();

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
  B: '你係預約助手。幫助用戶查詢及安排診所預約。引導用戶到預約系統：https://edentcm.as.me/schedule.php 或 WhatsApp: +852 2338 2028',
};

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
// Chat Logging
// ---------------------------------------------------------------------------

async function logChatMessages(
  sessionId: string,
  userContent: string,
  assistantContent: string,
  mode: ChatMode,
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

    const estimatedPromptTokens = Math.ceil(userContent.length / 2);
    const estimatedCompletionTokens = Math.ceil(assistantContent.length / 2);

    await supabase.from('chat_request_logs').insert({
      session_id: sessionId,
      model_id: 'gemini-flash-latest',
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
    });
  } catch (error) {
    console.error('[chat/v2] Failed to log chat messages:', error);
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

如果問題涉及預約、詳細收費、或需要真人協助，請引導用戶：
- 預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/

重要提示：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。`;
}

async function buildSystemPrompt(
  type: ConstitutionType,
  mode: ChatMode,
  careContext: string,
): Promise<string> {
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

  if (mode !== 'B' && gearMap[mode]) {
    systemPrompt += '\n\n【當前回覆檔位】\n' + gearMap[mode];
  }

  if (mode === 'B') {
    const clinicInfo = getPromptClinicInfoLines().map((l) => `- ${l}`).join('\n');
    const whatsappInfo = getWhatsappContactLines().map((l) => `- ${l}`).join('\n');
    systemPrompt += `\n\n【預約模式】\n你係預約助手。幫助用戶查詢及安排診所預約。\n\n診所資訊：\n${clinicInfo}\n\n${whatsappInfo}\n\n引導用戶到預約系統：https://edentcm.as.me/schedule.php`;
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
  try {
    const body = (await request.json()) as RequestBody;
    const { sessionId, messages } = body;

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
    const mode = resolveMode(latestUserMessage.content);

    // Resolve constitution type from user profile (auto-detect)
    let type: ConstitutionType = 'depleting'; // default for unauthenticated
    let careContext = '';

    try {
      const user = await getCurrentUser();
      if (user) {
        type = await resolveConstitution(user.id);
        careContext = await fetchCareContext(user.id);
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

    const fullPrompt = `${systemPrompt}\n\n【對話記錄】\n${conversationHistory}\n\nAI助手：`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const reply = response.text();

    // Log messages (fire-and-forget)
    logChatMessages(sessionId, latestUserMessage.content, reply, mode);

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
