/**
 * Test script for intelligent chat fusion
 * Simulates conversations for:
 * 1. Anonymous visitor (no auth)
 * 2. New patient (logged in but no history)
 * 3. Existing patient (logged in with care context + booking history)
 */

import { gatherUserContext, buildIntelligentPrompt, getDaysUntilFollowUp } from '../lib/user-context';

const BASE_PROMPT = `你係醫天圓中醫診所的 AI 助手。`;

async function testAnonymousVisitor() {
  console.log('\n========================================');
  console.log('🔍 測試 1: 匿名訪客（未登入）');
  console.log('========================================\n');

  const userContext = null;
  const prompt = buildIntelligentPrompt(BASE_PROMPT, userContext);

  console.log('生成的 System Prompt:');
  console.log(prompt);
  console.log('\n預期行為：');
  console.log('- ✅ 提供通用中醫知識');
  console.log('- ✅ 引導用戶預約');
  console.log('- ✅ 不假設體質類型');
}

async function testNewPatient() {
  console.log('\n========================================');
  console.log('🆕 測試 2: 新用戶（已登入但未就診）');
  console.log('========================================\n');

  const userContext = {
    userId: 'test-new-user',
    isNewPatient: true,
    constitution: null,
    constitutionNote: null,
    activeInstructions: [],
    nextFollowUp: null,
    lastBooking: null,
    totalVisits: 0,
  };

  const prompt = buildIntelligentPrompt(BASE_PROMPT, userContext);

  console.log('生成的 System Prompt:');
  console.log(prompt);
  console.log('\n預期行為：');
  console.log('- ✅ 歡迎新用戶');
  console.log('- ✅ 不假設體質');
  console.log('- ✅ 溫和引導預約');
}

async function testExistingPatient() {
  console.log('\n========================================');
  console.log('👤 測試 3: 舊客戶（有護理記錄 + 覆診建議）');
  console.log('========================================\n');

  const userContext = {
    userId: 'test-existing-user',
    isNewPatient: false,
    constitution: 'depleting',
    constitutionNote: '氣血不足，容易疲勞',
    activeInstructions: [
      { title: '避免生冷', content: '不宜食雪糕、凍飲、沙律' },
      { title: '早睡早起', content: '晚上 11 點前就寢' },
    ],
    nextFollowUp: {
      date: '2026-03-01',
      reason: '複診評估療效',
    },
    lastBooking: {
      doctorName: '陳家富醫師 (Dr. Chan)',
      doctorId: 'chan',
      date: '2026-02-01',
      clinicName: '中環診所',
    },
    totalVisits: 3,
  };

  const daysUntil = getDaysUntilFollowUp(userContext);

  console.log('用戶背景：');
  console.log(`- 體質：${userContext.constitution}`);
  console.log(`- 就診次數：${userContext.totalVisits}`);
  console.log(`- 上次就診：${userContext.lastBooking?.date}（${userContext.lastBooking?.doctorName}）`);
  console.log(`- 下次覆診：${userContext.nextFollowUp?.date}（距離 ${daysUntil} 天）`);
  console.log(`- 活躍介口：${userContext.activeInstructions.length} 項`);

  const prompt = buildIntelligentPrompt(BASE_PROMPT, userContext);

  console.log('\n生成的 System Prompt:');
  console.log(prompt);

  console.log('\n預期行為：');
  console.log('- ✅ 不再問「是否第一次診症」');
  console.log('- ✅ 提及醫師介口（避免生冷、早睡早起）');
  console.log('- ✅ 提醒覆診日期接近');
  console.log('- ✅ 主動詢問是否需要預約');
  console.log('- ✅ 推薦上次看過的醫師（陳家富醫師）');
}

async function testRealUserContext() {
  console.log('\n========================================');
  console.log('🔌 測試 4: 查詢真實用戶數據（需 Supabase 連線）');
  console.log('========================================\n');

  const testUserId = '9d37a816-708b-4fb6-9b67-48146db55eba'; // chetleung@gmail.com

  try {
    const userContext = await gatherUserContext(testUserId);
    const daysUntil = getDaysUntilFollowUp(userContext);

    console.log('查詢結果：');
    console.log(JSON.stringify(userContext, null, 2));
    console.log(`\n距離覆診日期：${daysUntil !== null ? `${daysUntil} 天` : '無'}`);

    const prompt = buildIntelligentPrompt(BASE_PROMPT, userContext);
    console.log('\n生成的 System Prompt (前 500 字):');
    console.log(prompt.slice(0, 500) + '...');
  } catch (error) {
    console.error('❌ 查詢失敗:', error);
    console.log('（這是正常的，如果在本地環境未設定 Supabase credentials）');
  }
}

// Run all tests
async function main() {
  console.log('\n🧪 智能融合 Chatbot 測試');
  console.log('===================================');

  await testAnonymousVisitor();
  await testNewPatient();
  await testExistingPatient();
  await testRealUserContext();

  console.log('\n✅ 測試完成！');
  console.log('\n下一步：');
  console.log('1. 啟動本地 server: npm run dev');
  console.log('2. 測試 API: curl -X POST http://localhost:3000/api/chat \\');
  console.log('   -H "Content-Type: application/json" \\');
  console.log('   -d \'{"message": "我最近又失眠了"}\'');
  console.log('3. 比較未登入 vs 登入用戶的回覆差異');
}

main();
