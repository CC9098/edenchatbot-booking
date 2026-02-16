import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLines } from '@/shared/clinic-schedule-data';
import { getCurrentUser } from '@/lib/auth-helpers';
import { gatherUserContext, buildIntelligentPrompt, getDaysUntilFollowUp } from '@/lib/user-context';

/**
 * Unified Chat API - Intelligent router for both WordPress embed and logged-in users
 *
 * Accepts two request formats:
 * 1. Legacy (WordPress): { message: string }
 * 2. New (multi-turn): { sessionId: string, messages: [{role, content}] }
 *
 * Auto-detects user authentication and provides:
 * - Anonymous visitors: General TCM knowledge
 * - Logged-in users: Personalized guidance based on care context + booking history
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Auto-detect request format
    const isLegacyFormat = 'message' in body && typeof body.message === 'string';
    const isNewFormat = 'messages' in body && Array.isArray(body.messages);

    let userMessage: string;
    let conversationHistory: string = '';

    if (isLegacyFormat) {
      // WordPress embed format: { message: string }
      userMessage = body.message;
    } else if (isNewFormat) {
      // New format: { sessionId, messages }
      const messages = body.messages as Array<{ role: string; content: string }>;
      const latestUserMsg = [...messages].reverse().find((m) => m.role === 'user');

      if (!latestUserMsg) {
        return NextResponse.json(
          { error: 'No user message found in messages array' },
          { status: 400 }
        );
      }

      userMessage = latestUserMsg.content;
      conversationHistory = messages
        .map((m) => `${m.role === 'user' ? '用戶' : 'AI助手'}：${m.content}`)
        .join('\n\n');
    } else {
      return NextResponse.json(
        { error: 'Invalid request format. Expected { message: string } or { messages: [...] }' },
        { status: 400 }
      );
    }

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Gather user context (if authenticated)
    let userContext = null;
    let daysUntilFollowUp: number | null = null;

    try {
      const user = await getCurrentUser();
      if (user) {
        userContext = await gatherUserContext(user.id);
        daysUntilFollowUp = getDaysUntilFollowUp(userContext);
      }
    } catch {
      // Not authenticated — continue with anonymous mode
    }

    // Build base prompt
    const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
    const doctorInfo = getPromptDoctorInfoLines().map((line) => `- ${line}`).join('\n');
    const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

    const basePrompt = `你係醫天圓中醫診所的 AI 助手，角色設定係親切、專業、有溫度的中醫健康顧問。請用繁體中文（廣東話口語）回答用戶問題。

【診所資訊】
${clinicInfo}

【醫師資訊】
${doctorInfo}

【收費參考】
診金 $100/次，基本藥費 $80 起/劑，針灸 $300-500/次，正骨手法 $350-700/次，拔罐 $350/次

【預約與聯絡】
- 網上預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/
${whatsappInfo}

【地址與地圖回覆規則】
- 當用戶要求診所地址或地圖時，只可使用「診所資訊」段落內提供的地址與 Google 地圖連結。
- 必須直接提供完整可點擊 URL。
- 禁止提供示意連結、臨時編造連結，或叫用戶自行搜尋作為主要答案。

重要提示：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。`;

    // Inject intelligent guidance based on user context
    const intelligentPrompt = buildIntelligentPrompt(basePrompt, userContext);

    // Add follow-up urgency hint (if applicable)
    let urgencyHint = '';
    if (daysUntilFollowUp !== null && daysUntilFollowUp <= 14 && daysUntilFollowUp >= 0) {
      urgencyHint = `\n\n⏰ 提示：距離醫師建議的覆診日期只剩 ${daysUntilFollowUp} 天，如對話涉及症狀或調理，適時溫和提醒用戶預約。`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const fullPrompt = conversationHistory
      ? `${intelligentPrompt}${urgencyHint}\n\n【對話記錄】\n${conversationHistory}\n\nAI助手：`
      : `${intelligentPrompt}${urgencyHint}\n\n用戶問題：${userMessage}\n\nAI助手：`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    // Return format based on request type
    if (isLegacyFormat) {
      // WordPress embed expects: { response: string }
      return NextResponse.json({ response: text });
    } else {
      // New format expects: { reply: string, mode?: string, type?: string }
      return NextResponse.json({
        reply: text,
        userContext: userContext ? {
          isNewPatient: userContext.isNewPatient,
          hasActiveInstructions: userContext.activeInstructions.length > 0,
          hasFollowUp: !!userContext.nextFollowUp,
          daysUntilFollowUp,
        } : null,
      });
    }
  } catch (error) {
    console.error('[chat] AI API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate AI response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
