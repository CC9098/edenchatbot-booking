import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLinesServer } from '@/lib/clinic-schedule-data-server';
import { gatherUserContext, buildIntelligentPrompt, getDaysUntilFollowUp } from '@/lib/user-context';

export interface LegacyChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LegacyChatUserContextSummary {
  isNewPatient: boolean;
  hasActiveInstructions: boolean;
  hasFollowUp: boolean;
  daysUntilFollowUp: number | null;
}

interface GenerateLegacyChatResponseOptions {
  messages?: LegacyChatMessage[];
  userMessage?: string;
  userId?: string;
}

function buildConversationHistory(messages: LegacyChatMessage[]): string {
  return messages
    .map((message) => `${message.role === 'user' ? '用戶' : 'AI助手'}：${message.content}`)
    .join('\n\n');
}

export async function generateLegacyChatResponse(
  options: GenerateLegacyChatResponseOptions,
): Promise<{ reply: string; userContext: LegacyChatUserContextSummary | null }> {
  const messages = Array.isArray(options.messages) ? options.messages : [];
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const userMessage = options.userMessage?.trim() || latestUserMessage?.content?.trim() || '';

  if (!userMessage) {
    throw new Error('Message is required');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let userContext = null;
  let daysUntilFollowUp: number | null = null;

  if (options.userId) {
    userContext = await gatherUserContext(options.userId);
    daysUntilFollowUp = getDaysUntilFollowUp(userContext);
  }

  const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
  const doctorInfo = (await getPromptDoctorInfoLinesServer()).map((line) => `- ${line}`).join('\n');
  const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

  const basePrompt = `你係醫天圓中醫診所的 AI 助手，角色設定係親切、專業、有溫度的中醫健康顧問。請用繁體中文（廣東話口語）回答用戶問題。

【診所資訊】
${clinicInfo}

【醫師每週固定應診參考】
${doctorInfo}

- 以上只供固定應診規律參考，唔等於實時空位，亦唔保證當日冇假期或臨時調更。
- 如果用戶問某日、某時段、今日、下星期等實時可預約情況，唔好當作已確認空位，應明確提醒以預約平台或診所確認為準。

【收費參考】
診金 $100/次，基本藥費 $80 起/劑，針灸 $300-500/次，正骨手法 $350-700/次，拔罐 $350/次

【預約與聯絡】
- 網上預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/
- 回覆診所聯絡資料時，只可使用以上最新聯絡電話與 WhatsApp 連結；荃灣診所必須使用 6097 7363 / https://wa.me/85260977363。
${whatsappInfo}

【地址與地圖回覆規則】
- 當用戶要求診所地址或地圖時，只可使用「診所資訊」段落內提供的地址與 Google 地圖連結。
- 必須直接提供完整可點擊 URL。
- 禁止提供示意連結、臨時編造連結，或叫用戶自行搜尋作為主要答案。

重要提示：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。`;

  const intelligentPrompt = buildIntelligentPrompt(basePrompt, userContext);

  let urgencyHint = '';
  if (daysUntilFollowUp !== null && daysUntilFollowUp <= 14 && daysUntilFollowUp >= 0) {
    urgencyHint = `\n\n⏰ 提示：距離醫師建議的覆診日期只剩 ${daysUntilFollowUp} 天，如對話涉及症狀或調理，適時溫和提醒用戶預約。`;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const conversationHistory = messages.length > 0 ? buildConversationHistory(messages) : '';
  const fullPrompt = conversationHistory
    ? `${intelligentPrompt}${urgencyHint}\n\n【對話記錄】\n${conversationHistory}\n\nAI助手：`
    : `${intelligentPrompt}${urgencyHint}\n\n用戶問題：${userMessage}\n\nAI助手：`;

  const result = await model.generateContent(fullPrompt);
  const response = await result.response;

  return {
    reply: response.text(),
    userContext: userContext
      ? {
          isNewPatient: userContext.isNewPatient,
          hasActiveInstructions: userContext.activeInstructions.length > 0,
          hasFollowUp: !!userContext.nextFollowUp,
          daysUntilFollowUp,
        }
      : null,
  };
}
