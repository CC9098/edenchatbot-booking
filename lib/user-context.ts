import { createServiceClient } from './supabase';

export interface UserContext {
  userId: string;
  isNewPatient: boolean;
  constitution: string | null;
  constitutionNote: string | null;
  activeInstructions: Array<{ title: string; content: string }>;
  nextFollowUp: {
    date: string;
    reason: string | null;
  } | null;
  lastBooking: {
    doctorName: string;
    doctorId: string;
    date: string;
    clinicName: string;
  } | null;
  totalVisits: number;
}

function parseDateOnlyToUtc(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Gather complete user context for intelligent conversation
 * Includes: constitution, care instructions, follow-up plans, booking history
 */
export async function gatherUserContext(userId: string): Promise<UserContext> {
  const supabase = createServiceClient();

  // 1. Care profile (constitution + note)
  const { data: careProfile } = await supabase
    .from('patient_care_profile')
    .select('constitution, constitution_note')
    .eq('patient_user_id', userId)
    .maybeSingle();

  // 2. Active care instructions
  const today = new Date().toISOString().split('T')[0];
  const { data: instructions } = await supabase
    .from('care_instructions')
    .select('title, content_md')
    .eq('patient_user_id', userId)
    .eq('status', 'active')
    .or(`start_date.is.null,start_date.lte.${today}`)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .limit(10);

  // 3. Next pending follow-up plan
  const { data: followUp } = await supabase
    .from('follow_up_plans')
    .select('suggested_date, reason')
    .eq('patient_user_id', userId)
    .eq('status', 'pending')
    .order('suggested_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // 4. Booking history (from chat_sessions or a dedicated bookings table)
  // NOTE: This is a simplified version. In production, you'd query actual booking records.
  // For now, we'll check if there's any chat_messages with booking-related content.
  const { data: chatSessions, count: sessionCount } = await supabase
    .from('chat_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const totalVisits = sessionCount || 0;

  // TODO: Replace with actual booking history from Google Calendar or a bookings table
  // For MVP, we'll use a placeholder based on follow_up_plans
  const { data: lastFollowUpDone } = await supabase
    .from('follow_up_plans')
    .select('suggested_date, linked_booking_id')
    .eq('patient_user_id', userId)
    .eq('status', 'done')
    .order('suggested_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Placeholder: extract doctor info from linked_booking_id or fallback
  // In real system, you'd query your bookings table or Google Calendar API
  const lastBooking = lastFollowUpDone
    ? {
        doctorName: '陳家富醫師 (Dr. Chan)', // TODO: Parse from linked_booking_id
        doctorId: 'chan',
        date: lastFollowUpDone.suggested_date,
        clinicName: '中環診所', // TODO: Parse from booking data
      }
    : null;

  return {
    userId,
    isNewPatient: totalVisits === 0 && !lastBooking,
    constitution: careProfile?.constitution || null,
    constitutionNote: careProfile?.constitution_note || null,
    activeInstructions:
      instructions?.map((i) => ({
        title: i.title,
        content: i.content_md,
      })) || [],
    nextFollowUp: followUp
      ? {
          date: followUp.suggested_date,
          reason: followUp.reason,
        }
      : null,
    lastBooking,
    totalVisits,
  };
}

/**
 * Build intelligent system prompt based on user context
 * Adds smart guidance for existing patients vs new visitors
 */
export function buildIntelligentPrompt(
  basePrompt: string,
  userContext: UserContext | null,
): string {
  if (!userContext) {
    // Anonymous visitor: general guidance
    return basePrompt + `

【對話指引】
1. 提供通用中醫知識和診所資訊
2. 如需個人化建議，引導用戶預約醫師
3. 不要猜測用戶體質（需醫師評估）
4. 保持親切、專業的語氣
`;
  }

  // Authenticated user: personalized guidance
  let intelligentPrompt = basePrompt;

  if (userContext.isNewPatient) {
    // New patient: encourage first visit
    intelligentPrompt += `

【對話指引 - 新用戶】
1. 這位用戶是新用戶，尚未就診過
2. 提供通用中醫知識，並溫和引導預約
3. 不要假設體質類型（需醫師面診評估）
4. 語氣：歡迎、親切、專業
`;
  } else {
    // Existing patient: smart guidance based on history
    intelligentPrompt += `

【重要：這位用戶的背景資料】
- 💡 舊客戶（已就診 ${userContext.totalVisits} 次）
${userContext.constitution ? `- 體質類型：${userContext.constitution}` : ''}
${userContext.constitutionNote ? `- 體質備註：${userContext.constitutionNote}` : ''}
${userContext.lastBooking ? `- 上次就診：${userContext.lastBooking.date}，由${userContext.lastBooking.doctorName}診治` : ''}
${userContext.nextFollowUp ? `- 醫師建議覆診：${userContext.nextFollowUp.date}${userContext.nextFollowUp.reason ? `（${userContext.nextFollowUp.reason}）` : ''}` : ''}

${userContext.activeInstructions.length > 0 ? `【醫師設定的護理指引】
${userContext.activeInstructions.map((i) => `- ${i.title}：${i.content}`).join('\n')}` : ''}

【對話指引 - 舊客戶智能引導】
1. ✅ 不要再問「你是第一次診症嗎？」（他是舊客戶）
2. ✅ 當他提到症狀時，自然關聯醫師的護理指引
3. ✅ 如距離覆診日期 < 2 週，溫和提醒並主動詢問是否需要預約
4. ✅ 預約時優先推薦他上次看過的醫師（${userContext.lastBooking?.doctorName || '原本的醫師'}）
5. ✅ 語氣要有溫度，像是「我留意到醫師上次提醒你...」而非機械式問卷
6. ✅ 在合適時機（症狀相關對話後）自然詢問「需要我幫你預約嗎？」

【預約引導時機建議】
- 用戶提及症狀復發/加重 → 關聯醫師介口並提及覆診建議
- 距離建議覆診日期接近 → 主動詢問「要幫你預約嗎？」
- 用戶詢問調理建議 → 溫和提醒「醫師可能需要重新評估，需要預約覆診嗎？」
- 語氣範例：「聽到你又失眠了，我理解這很辛苦。上次${userContext.lastBooking?.doctorName || '醫師'}有提醒你避免...，你試過了嗎？另外，醫師建議你在${userContext.nextFollowUp?.date || '近期'}覆診，需要我幫你預約嗎？」
`;
  }

  return intelligentPrompt;
}

/**
 * Calculate days until next follow-up (for smart reminder timing)
 */
export function getDaysUntilFollowUp(userContext: UserContext | null): number | null {
  if (!userContext?.nextFollowUp) return null;

  const followUpDate = parseDateOnlyToUtc(userContext.nextFollowUp.date);
  if (!followUpDate) return null;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffTime = followUpDate.getTime() - todayUtc.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}
