import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { getPromptClinicInfoLines, getWhatsappContactLines } from '@/shared/clinic-data';
import { getPromptDoctorInfoLines } from '@/shared/clinic-schedule-data';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use current Gemini alias to avoid deprecated model failures.
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const clinicInfo = getPromptClinicInfoLines().map((line) => `- ${line}`).join('\n');
    const doctorInfo = getPromptDoctorInfoLines().map((line) => `- ${line}`).join('\n');
    const whatsappInfo = getWhatsappContactLines().map((line) => `- ${line}`).join('\n');

    const prompt = `你係醫天圓中醫診所的小助手，角色設定係親切、專業的中醫診所助理。請用繁體中文回答用戶問題。

診所資訊：
${clinicInfo}

醫師資訊：
${doctorInfo}

收費：診金 $100/次，基本藥費 $80 起/劑，針灸 $300-500/次，正骨手法 $350-700/次，拔罐 $350/次

如果問題涉及預約、詳細收費、或需要真人協助，請引導用戶：
- 預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/
${whatsappInfo}

重要提示：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。

請用親切、專業的語氣回答，保持簡潔。`;

    const result = await model.generateContent(prompt + '\n\n用戶問題：' + message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('AI API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
