# 🎨 SOUL JOURNEY UI/UX 重塑計劃
## 完整的設計智慧與實施策略（2026-03）

---

## 一、設計系統基礎

### 1.1 設計哲學
**核心理念：** 用**視覺、互動、敘事**三個層面貫穿整個用戶旅程，讓每一次互動都推進故事發展。

**目標：**
- 🎭 **大器感**：從色彩、間距到動畫，都要有**呼吸感**和**重量感**
- 📖 **故事感**：使用 scroll-triggered storytelling，每個板塊都是故事的一章
- 🌊 **沉浸感**：讓用戶感受到風、水、雷三勢的力量流動
- 🎮 **遊戲化**：進度、成就感、日常抉擇，讓用戶有回歸的動機

### 1.2 色彩系統
根據設計系統和風水雷元素的融合：

```
【主色系】
- Primary (紫):    #8B5CF6 (calm, wellness, mystical)
- Secondary:       #C4B5FD (light purple, soft background)

【元素色（風水雷）】
- 風勢 (Wind):     #4e8a96 (teal blue, fluid)
- 水勢 (Water):    #4a5278 (deep blue, stillness)
- 雷勢 (Thunder):  #b89a2c (golden amber, action)

【輔助色】
- CTA/Action:      #10B981 (wellness green, hope)
- Background:      #FAF5FF (soft lavender, serene)
- Text Primary:    #4C1D95 (deep purple, readable)
- Text Secondary:  #6B7280 (medium gray)
- Border:          #E9D5FF (light purple, soft divide)

【中性色】
- White:           #FFFFFF (clean)
- Gray-50:         #F9FAFB (very light)
- Gray-100:        #F3F4F6 (light)
- Gray-600:        #4B5563 (text secondary)
- Gray-900:        #111827 (text primary dark)
```

### 1.3 字體配對
**Heading Font:** Lora (serif, elegant, calm)
- Font Weight: 400 (normal), 500 (semibold), 600 (bold), 700 (extra bold)
- Usage: 頁面標題、section headings、重點文案

**Body Font:** Raleway (sans-serif, modern, light)
- Font Weight: 300 (light), 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- Usage: 正文、按鈕、標籤、說明文字

**Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Raleway:wght@300;400;500;600;700&display=swap');
```

---

## 二、首頁（根源頁）改良方案

### 2.1 現狀分析
✅ **現有優勢：**
- 清晰的信息層級（最新文章 → 課程 → AI諮詢 → 預約）
- 簡潔的導航和視覺美感

❌ **待改進：**
- 缺乏視覺敘事感，內容之間沒有「流動感」
- 風水雷元素沒有視覺呈現
- 用戶進入時沒有「故事開場」的感覺
- 色彩系統與風水雷無關

### 2.2 改良策略：Scroll-Triggered Storytelling

#### 第一幕：英雄開場（Hero Section）
**視覺層面：**
- 背景：漸變 (FAF5FF → E9D5FF)，加入 subtle 動畫背景（風、水、雷的流動暗示）
- 主文案用 Lora 48px 黑體（#4C1D95），強有力但不咄咄逼人
- 副文案用 Raleway 18px 淺灰色（#6B7280）

**互動層面：**
- 加入 scroll hint「向下探索更多」動畫
- 按鈕 hover 時用 Soft UI 陰影效果（不是scale變大）

**HTML 結構示意：**
```html
<section class="hero min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FAF5FF] to-[#E9D5FF]">
  <div class="text-center max-w-3xl px-6">
    <h1 class="font-lora text-5xl font-bold text-[#4C1D95] leading-tight">
      每一個選擇，都在調動你的原力
    </h1>
    <p class="mt-6 font-raleway text-lg text-[#6B7280] leading-relaxed">
      歡迎來到醫天圓。在這裡，你不只是病人，你是一位原力戰士。用日常抉擇調動風、水、雷三勢，找回身體最穩定的狀態。
    </p>
    <div class="mt-10 flex gap-4 justify-center">
      <button class="bg-[#8B5CF6] text-white px-8 py-3 rounded-full font-raleway font-semibold hover:shadow-lg transition-shadow">
        開始我的原力之旅
      </button>
      <button class="border-2 border-[#8B5CF6] text-[#8B5CF6] px-8 py-3 rounded-full font-raleway font-semibold hover:bg-[#FAF5FF] transition-colors">
        瞭解風水雷
      </button>
    </div>
  </div>
</section>
```

#### 第二幕：風水雷故事展開（Three-Force Section）
**視覺結構：**
- 三個 card，排成網格或斜排，分別代表風、水、雷
- 每個 card 用對應的元素色為主色
- 加入簡單的 icon（Wind, Droplet, Zap）

**卡片設計：**
```
【風勢 - 流動的力量】
色：#4e8a96
Icon: Wind (Lucide)
描述：調頻、回氣、適應變化
狀態：主要用於「調整」

【水勢 - 沉靜的滋養】
色：#4a5278
Icon: Droplet (Lucide)
描述：沉穩、聚養、長期修復
狀態：主要用於「滋補」

【雷勢 - 決斷的行動】
色：#b89a2c
Icon: Zap (Lucide)
描述：決斷、突破、立即行動
狀態：主要用於「啟動」
```

#### 第三幕：內容樞紐（Content Hub）
**視覺層面：**
- 文章、課程、AI諮詢三個區塊改成「章節」形式
- 每個區塊前加入 divider line（漸變色，象徵力量流動）
- 卡片採用 Soft UI（subtle shadows, rounded corners, semi-transparent borders）

#### 第四幕：預約與 CTA（Final Call-to-Action）
**視覺層面：**
- 這是故事的「高潮」，用最醒目的配色（#10B981 綠色）
- 按鈕加入 pulse animation（象徵心跳、生命力）

### 2.3 動畫方案

| 互動 | 效果 | 持續時間 | 目的 |
|------|------|---------|------|
| Page Load | Fade in + subtle scale up | 600ms | 優雅的進場 |
| Scroll | Hero text parallax effect | continuous | 沉浸感 |
| Card Hover | Subtle shadow elevation + border highlight | 200ms | 可互動性提示 |
| Button Hover | Box shadow expansion + background subtle change | 150ms | 按鈕互動反饋 |
| Progress Bar | Fill animation when scrolling | 300ms | 進度感 |
| Daily Checkin | Pulse effect on submit button | 800ms (repeating) | 生命力暗示 |

### 2.4 關鍵的 UX 改進點

1. **進度指示**：頁面頂部加入隱式 progress bar（用元素色三色條）
2. **故事感文案**：每個 section 的標題改成敘事式
3. **互動深度**：卡片加入 tooltip 或 expandable 功能，點擊可深入瞭解
4. **移動端適配**：簡化動畫，保持故事層級感

---

## 三、SOUL JOURNEY 頁面（TendencyQuizPanel）改良方案

### 3.1 現狀
✅ **現有優勢：**
- 完整的功能（基礎測驗 → 原力盤 → 日常事件卡）
- 清晰的視覺層級（三個選擇題）
- 遊戲化的敘述語氣（「啟動原力盤」、「提交今日抉擇」）

❌ **待改進：**
- 原力盤的視覺還不夠「大器」（進度條太簡單）
- 缺乏 **narrative depth**（沒有講述用戶的故事變化）
- 日常事件卡的視覺反饋不夠沉浸
- 缺乏「力量流動」的感受（三色條太靜態）

### 3.2 重點改良：原力盤變成「力量景觀」

#### 原來：簡單進度條
```html
<div class="overflow-hidden rounded-full bg-slate-200">
  <div class="flex h-3 w-full">
    <!-- 三色條 -->
  </div>
</div>
```

#### 改良後：沉浸式力量圖景
```html
<!-- 原力盤（力量景觀版） -->
<div class="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#FAF5FF] to-[#E9D5FF] p-8 overflow-hidden">
  <!-- 背景動畫層 -->
  <div class="absolute inset-0 opacity-20">
    <!-- 風、水、雷的流動背景（CSS animation） -->
  </div>

  <!-- 標題 + 副標 -->
  <div class="relative z-10">
    <p class="text-xs font-semibold tracking-widest text-primary uppercase">原力版圖 · 今日平衡</p>
    <h2 class="mt-2 font-lora text-2xl font-bold text-[#4C1D95]">你的三勢力量</h2>
  </div>

  <!-- 力量進度環（改為圓形或放射狀設計） -->
  <div class="mt-6 relative h-64">
    <!-- 用 SVG 或 CSS 繪製三色扇形圖，每個象限代表一勢 -->
    <!-- 加入動畫：數字逐漸增長，圓環漸變填充 -->
  </div>

  <!-- 力量等級文案 -->
  <div class="mt-8 grid gap-4 sm:grid-cols-3">
    {/* 三個力量卡片，改用更大的視覺層級 */}
  </div>

  <!-- 敘事化的力量解讀 -->
  <div class="mt-6 rounded-2xl border border-primary/20 bg-white/80 p-4">
    <p class="font-lora text-lg font-semibold text-[#4C1D95]">你現在的原力狀態</p>
    <p class="mt-2 font-raleway text-sm leading-relaxed text-[#6B7280]">
      {/* 根據用戶的三勢組合生成故事化的描述 */}
      「你的風勢流動，帶動了內在的調頻能力。水勢雖穩，但需要更多的養分。
       雷勢初醒，預示著近期會有突破的機會……」
    </p>
  </div>
</div>
```

### 3.3 原力盤的視覺升級清單

- [ ] **進度環改為 SVG 放射圖**：用扇形設計，每個象限填充相應顏色，更 immersive
- [ ] **數字動畫**：百分比從 0% 逐漸增長到實際值（duration 1s）
- [ ] **力量卡片升級**：
  - 加入更大的 icon（h-10 w-10）
  - 背景用淡化的元素色（opacity 10-15%）
  - 加入 border 用同色系（opacity 30%）
  - Hover 時加入 lift effect（box shadow expansion）
- [ ] **敘事化解讀**：根據三勢的組合，生成不同的故事文案
- [ ] **今日戰報升級**：改成「戰績 badge」設計，更遊戲化

### 3.4 日常事件卡的改良

#### 現況
```
【今日事件卡】
你今日的抉擇：[選項1] [選項2] [選項3]
提交今日抉擇
```

#### 改良後
```
【第 X 天的考驗】
「背景故事 + 情境描述」
[選項A - 風勢應對] [選項B - 水勢應對] [選項C - 雷勢應對]
「戰績預示：若選A，風勢 +15，預示流動的改變……」
```

**視覺改進：**
1. 每個選項加入「力量預示」（小字，淺色）
2. 選項 hover 時顯示該選項對應的力量變化
3. 提交後的動畫：三色條漸進式填充，伴隨音效暗示（可選）
4. 每日戰報用 badge 形式展示力量變化

---

## 四、整體設計令牌（Design Tokens）

### 4.1 Spacing
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
3xl: 64px
```

### 4.2 Border Radius
```
sm: 8px
md: 12px
lg: 16px
xl: 20px
2xl: 24px
full: 9999px
```

### 4.3 Shadows
```
sm: 0 1px 2px 0 rgba(0,0,0,0.05)
md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)
lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)
xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)
（注意：用 soft shadows，避免太深邃）
```

### 4.4 Typography
```
Display (Hero):  Lora 48px font-bold leading-tight
H1 (Page Title): Lora 36px font-bold leading-snug
H2 (Section):    Lora 28px font-semibold leading-snug
H3 (Subsection): Lora 22px font-semibold leading-normal
Body (Large):    Raleway 18px font-normal leading-relaxed
Body (Normal):   Raleway 16px font-normal leading-relaxed
Body (Small):    Raleway 14px font-normal leading-relaxed
Label (UI):      Raleway 12px font-semibold tracking-widest
```

### 4.5 Animation Timing
```
fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
normal: 200ms cubic-bezier(0.4, 0, 0.2, 1)
slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
slower: 500ms cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 五、實施路線圖

### Phase 1：設計系統建立（1-2天）
- [ ] 更新 tailwind.config.ts 加入新色彩、字體、shadows
- [ ] 在 globals.css 定義 CSS 變數和 animation keyframes
- [ ] 更新首頁 page.tsx（hero section + story structure）

### Phase 2：首頁改良（2-3天）
- [ ] 建立 scroll-triggered storytelling 結構
- [ ] 加入風水雷三元素視覺區塊
- [ ] 優化按鈕、卡片的 hover 效果

### Phase 3：SOUL JOURNEY 頁面升級（3-4天）
- [ ] 重新設計原力盤（SVG 放射圖或增強的視覺層級）
- [ ] 升級力量卡片的視覺設計
- [ ] 加入敘事化的力量解讀文案
- [ ] 改進日常事件卡的互動設計

### Phase 4：測試與微調（1-2天）
- [ ] 測試響應式設計（mobile, tablet, desktop）
- [ ] 測試動畫性能（prefers-reduced-motion）
- [ ] 使用者測試與反饋調整

---

## 六、前置作業清單（Pre-Delivery）

### 視覺品質
- [ ] 所有 icon 來自 Lucide React（不用 emoji）
- [ ] 色彩對比度達 WCAG AA (4.5:1)
- [ ] 所有可點擊元素有 cursor-pointer
- [ ] Hover 狀態提供清晰視覺反饋

### 互動
- [ ] 動畫持續時間在 150-300ms 間
- [ ] 用 transform/opacity（不用 width/height）
- [ ] 有 loading 狀態指示

### 響應式
- [ ] 測試 375px, 768px, 1024px, 1440px
- [ ] 行動版簡化動畫（prefers-reduced-motion 需尊重）
- [ ] 無水平滾動

### 無障礙
- [ ] 所有圖片有 alt text
- [ ] 表單有 label
- [ ] Focus 狀態可見
- [ ] 色彩不是唯一的訊息方式

---

## 七、設計靈感參考

- **色彩搭配靈感**：Dribbble "wellness app", "health tech"
- **敘事設計靈感**：Figma, Notion（scrollytelling pages）
- **遊戲化靈感**：Duolingo（daily streaks, battle metaphor）
- **字體搭配靈感**：Google Fonts "Lora + Raleway" combo

---

## 八、開發注意事項

### Tailwind 擴展
```javascript
// tailwind.config.ts 新增
theme: {
  extend: {
    colors: {
      force: {
        wind: '#4e8a96',
        water: '#4a5278',
        thunder: '#b89a2c',
      }
    },
    fontFamily: {
      lora: ['Lora', 'serif'],
      raleway: ['Raleway', 'sans-serif'],
    },
    animation: {
      'pulse-gentle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      'float': 'float 6s ease-in-out infinite',
      'shimmer': 'shimmer 2s linear infinite',
    }
  }
}
```

### CSS 動畫示例
```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

/* Soft shadow 變數 */
--shadow-soft: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-medium: 0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-lg: 0 12px 48px rgba(0, 0, 0, 0.15);
```

---

## 九、用詞指南（Narrative Consistency）

在所有文案中保持敘事一致性：

| 情境 | 用詞 |
|------|------|
| 開始 | 「啟動」「開始之旅」「揭開」 |
| 進行中 | 「調動」「流動」「累積」「共鳴」 |
| 選擇 | 「抉擇」「考驗」「應對」「決斷」 |
| 進度 | 「原力盤」「戰報」「狀態」「平衡」 |
| 完成 | 「穩定」「綻放」「達成」「回歸」 |

---

## 十、成功指標

實施完成後，用這些指標檢驗設計品質：

- ⏱️ **Page Load Time**：<3s（首屏）
- 🎯 **Engagement**：平均停留時間 > 2min
- ♿ **Accessibility**：Lighthouse A11y score > 95
- 📱 **Mobile Friendliness**：Lighthouse Mobile score > 90
- 🎨 **Visual Consistency**：所有頁面色彩、字體、間距一致
- 🎮 **Gamification Engagement**：日活躍用戶 daily checkin 完成率 > 40%

---

**版本**：2026-03-01
**設計師心聲**：這不只是改良 UI，而是用**視覺語言**講述一個關於人的原力覺醒的故事。每一個顏色、每一個按鈕、每一次滑動，都在說：「你不只是在預約，你在調動自己內在的力量。」
