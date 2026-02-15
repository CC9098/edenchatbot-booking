/**
 * Chat Quality Manual Test - 15 Questions
 *
 * 測試 MVP v1 Chatbot 的：
 * - 模式自動判斷 (G1/G2/G3/B)
 * - 體質個人化
 * - 知識庫引用
 * - 預約流程
 */

import { test, expect, type Page } from '@playwright/test';
import { createAuthenticatedContext } from './helpers/auth';

interface TestQuestion {
  id: number;
  question: string;
  expectedMode: 'G1' | 'G2' | 'G3' | 'B';
  category: string;
  checkConstitution?: boolean;
  checkKnowledge?: boolean;
  checkInstructions?: boolean;
}

const TEST_QUESTIONS: TestQuestion[] = [
  // A. 模式判斷測試 (5題)
  {
    id: 1,
    question: '我想預約下星期睇醫師',
    expectedMode: 'B',
    category: '模式判斷',
  },
  {
    id: 2,
    question: '最近好攰，點算好？',
    expectedMode: 'G1',
    category: '模式判斷',
  },
  {
    id: 3,
    question: '點解我成日覺得好凍？中醫理論係點解釋？',
    expectedMode: 'G2',
    category: '模式判斷',
  },
  {
    id: 4,
    question: '我呢幾個月一直都失眠，食咗好多藥都無效，唔知點算好，可唔可以幫我分析下係咪體質問題？',
    expectedMode: 'G3',
    category: '模式判斷',
  },
  {
    id: 5,
    question: '我想改期預約',
    expectedMode: 'B',
    category: '模式判斷',
  },

  // B. 體質個人化測試 (3題)
  {
    id: 6,
    question: '我可以食生冷嘢嗎？',
    expectedMode: 'G1',
    category: '體質個人化',
    checkConstitution: true,
  },
  {
    id: 7,
    question: '我最近好燥熱，飲咩好？',
    expectedMode: 'G1',
    category: '體質個人化',
    checkConstitution: true,
  },
  {
    id: 8,
    question: '醫師有無介口我要避免咩食物？',
    expectedMode: 'G1',
    category: '體質個人化',
    checkInstructions: true,
  },

  // C. 知識庫引用測試 (3題)
  {
    id: 9,
    question: '脾虛有咩症狀？',
    expectedMode: 'G2',
    category: '知識庫引用',
    checkKnowledge: true,
  },
  {
    id: 10,
    question: '艾灸有咩好處？',
    expectedMode: 'G1',
    category: '知識庫引用',
    checkKnowledge: true,
  },
  {
    id: 11,
    question: '補腎同補脾有咩分別？',
    expectedMode: 'G2',
    category: '知識庫引用',
    checkKnowledge: true,
  },

  // D. 預約流程測試 (4題)
  {
    id: 12,
    question: '我想約診，幾時有得睇？',
    expectedMode: 'B',
    category: '預約流程',
  },
  {
    id: 13,
    question: '我想 book 下星期三下午',
    expectedMode: 'B',
    category: '預約流程',
  },
  {
    id: 14,
    question: '我想改期我嘅預約',
    expectedMode: 'B',
    category: '預約流程',
  },
  {
    id: 15,
    question: '取消預約',
    expectedMode: 'B',
    category: '預約流程',
  },
];

interface TestResult {
  id: number;
  question: string;
  expectedMode: string;
  actualMode: string | null;
  constitutionType: string | null;
  reply: string;
  replyLength: number;
  quality: number; // 1-5
  notes: string;
  category: string;
}

const results: TestResult[] = [];

async function askQuestion(
  page: Page,
  question: string
): Promise<{ reply: string; mode: string | null; constitutionType: string | null }> {
  // 找到輸入框（placeholder: "輸入你的健康問題..." 或 "請輸入你的問題..."）
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });

  // 記錄送出前的訊息數量
  const messagesBefore = await page.locator('.whitespace-pre-wrap').count();

  // 輸入問題並送出
  await textarea.fill(question);
  await textarea.press('Enter');

  // 等待新訊息出現（AI 回覆）
  await page.waitForFunction(
    (beforeCount) => {
      const messages = document.querySelectorAll('.whitespace-pre-wrap');
      return messages.length > beforeCount + 1; // user message + assistant message
    },
    messagesBefore,
    { timeout: 45000 } // 最多等 45 秒
  );

  // 等待 loading indicator 消失
  await page.locator('text=正在思考').waitFor({ state: 'hidden', timeout: 45000 }).catch(() => {});

  // 取得所有訊息
  const allMessages = page.locator('.whitespace-pre-wrap');
  const count = await allMessages.count();

  // 最後一個訊息應該是 AI 回覆
  const lastMessage = allMessages.nth(count - 1);
  const reply = (await lastMessage.textContent()) || '';

  // 檢查模式徽章（在 AI 訊息上方）
  let mode: string | null = null;
  const modeBadges = page.locator('span.inline-block.rounded.px-1\\.5.py-0\\.5');
  const badgeCount = await modeBadges.count();

  if (badgeCount > 0) {
    const lastBadge = modeBadges.last();
    const badgeText = await lastBadge.textContent();

    // 根據徽章文字判斷模式
    if (badgeText?.includes('簡答')) mode = 'G1';
    else if (badgeText?.includes('詳答')) mode = 'G2';
    else if (badgeText?.includes('教練')) mode = 'G3';
    else if (badgeText?.includes('預約')) mode = 'B';
  }

  return { reply, mode, constitutionType: null };
}

function evaluateQuality(
  question: TestQuestion,
  reply: string,
  actualMode: string | null
): number {
  let score = 3; // 預設可接受

  // 1. 模式是否正確 (+2 or -1)
  if (actualMode === question.expectedMode) {
    score += 1;
  } else {
    score -= 1;
  }

  // 2. 回覆長度合理性
  if (question.expectedMode === 'G1' && reply.length > 50) {
    score += 0.5;
  }
  if (question.expectedMode === 'G2' && reply.length > 150) {
    score += 0.5;
  }
  if (question.expectedMode === 'G3' && reply.length > 300) {
    score += 0.5;
  }

  // 3. 是否有實質內容（非空或錯誤訊息）
  if (reply.includes('錯誤') || reply.includes('error') || reply.length < 10) {
    score -= 2;
  }

  return Math.max(1, Math.min(5, Math.round(score)));
}

test.describe('Chat Quality Manual Test - 15 Questions', () => {
  test('測試 15 題並記錄結果', async ({ browser }) => {
    test.setTimeout(600000); // 10 分鐘 timeout
    // 使用 patient 帳號登入
    const context = await createAuthenticatedContext(browser, 'patient');
    const page = await context.newPage();

    try {
      // 前往聊天室
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      console.log('\n🚀 開始測試 15 題...\n');

      // 逐題測試
      for (const question of TEST_QUESTIONS) {
        console.log(`\n📝 Q${question.id}: ${question.question}`);
        console.log(`   預期模式: ${question.expectedMode}`);

        const { reply, mode, constitutionType } = await askQuestion(page, question.question);

        console.log(`   實際模式: ${mode || '未偵測到'}`);
        console.log(`   回覆長度: ${reply.length} 字`);
        console.log(`   回覆預覽: ${reply.slice(0, 100)}...`);

        const quality = evaluateQuality(question, reply, mode);

        results.push({
          id: question.id,
          question: question.question,
          expectedMode: question.expectedMode,
          actualMode: mode,
          constitutionType,
          reply,
          replyLength: reply.length,
          quality,
          notes: mode === question.expectedMode ? '✅ 模式正確' : '❌ 模式不符',
          category: question.category,
        });

        console.log(`   品質評分: ${quality}/5`);

        // 每題之間等待 1 秒
        await page.waitForTimeout(1000);
      }

      // 輸出結果摘要
      console.log('\n\n📊 測試結果摘要\n');
      console.log('='.repeat(80));

      const modeAccuracy = results.filter(r => r.actualMode === r.expectedMode).length / results.length * 100;
      const avgQuality = results.reduce((sum, r) => sum + r.quality, 0) / results.length;

      console.log(`模式判斷準確度: ${modeAccuracy.toFixed(1)}%`);
      console.log(`平均品質評分: ${avgQuality.toFixed(2)}/5`);
      console.log('='.repeat(80));

      // 輸出詳細表格
      console.log('\n| # | 問題 | 預期 | 實際 | 品質 | 備註 |');
      console.log('|---|------|------|------|------|------|');

      results.forEach(r => {
        console.log(`| ${r.id} | ${r.question.slice(0, 20)}... | ${r.expectedMode} | ${r.actualMode || 'N/A'} | ${r.quality}/5 | ${r.notes} |`);
      });

      // 儲存詳細結果到 JSON
      const fs = require('fs');
      const outputPath = `./test-results/chat-quality-${Date.now()}.json`;
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`\n✅ 詳細結果已儲存至: ${outputPath}`);

    } finally {
      await context.close();
    }
  });
});
