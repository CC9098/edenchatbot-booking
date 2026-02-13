import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

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
    // 使用 gemini-pro 模型（稳定版本）
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `你係醫天圓中醫診所的小助手，角色設定係親切、專業的中醫診所助理。請用繁體中文回答用戶問題。

診所資訊：
- 中環診所：電話：3575 9733, 6733 3234 | 週一至五 11:00-14:00, 15:30-19:30；週六日及公眾假期休息 | 詳情請參考中環街景路線圖
- 佐敦診所：地址：九龍佐敦寶靈街6號 佐敦中心7樓全層 | 電話：3105 0733, 6733 3801 | 週一至五 11:00-14:00, 15:30-19:30；週六 11:00-14:00, 15:30-18:30；週日及公眾假期休息
- 荃灣診所：地址：荃灣富麗花園商場A座地下20號 | 電話：2698 5422, 6097 7363 | 週一、二、四至日 10:30-14:00，15:30-19:00；週三及公眾假期休息

醫師資訊：
- 陳家富醫師：中環（週一、四 11am-2pm），佐敦（週一、四 3:30pm-7:30pm），荃灣（週二、五、六 10:30am-2pm, 3:30pm-7pm）
- 李芊霖醫師：中環（週一、二 3:30pm-7:30pm，週三 11am-2pm, 3:30pm-7:30pm），佐敦（週一、二 11am-2pm，週五 3:30pm-7:30pm，週六 11am-2pm, 3:30pm-6:30pm），荃灣（週四 10:30am-2pm, 3:30pm-7pm）
- 韓曉恩醫師：中環（週四、五 3:30pm-7:30pm），佐敦（週三 11am-2pm, 3:30pm-7:30pm，週五 11am-2pm），荃灣（週一、日 10:30am-2pm, 3:30pm-7pm）
- 周德健醫師：中環（週二、五 11am-2pm），佐敦（週二 3:30pm-7:30pm）

收費：診金 $100/次，基本藥費 $80 起/劑，針灸 $300-500/次，正骨手法 $350-700/次，拔罐 $350/次

如果問題涉及預約、詳細收費、或需要真人協助，請引導用戶：
- 預約：https://edentcm.as.me/schedule.php
- 時間表網頁：https://www.edenclinic.hk/timetable/
- 中環診所 WhatsApp: https://wa.me/+85267333234 | 電話：3575 9733, 6733 3234
- 佐敦診所 WhatsApp: https://wa.me/+85267333801 | 電話：3105 0733, 6733 3801
- 荃灣診所 WhatsApp: https://wa.me/+85260977363 | 電話：2698 5422, 6097 7363

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

