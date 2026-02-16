# MASTER Design System - EdenChatbotBooking (醫天圓預約系統)

這份文件係「唯一」UI/UX 規範來源，用嚟確保任何人或其他 AI 擴展網站時，都保持同一套視覺語言、排版與互動一致性。

---

## 目標與非目標

### 目標
- **品牌一致性**：全站統一使用醫天圓品牌色 `#2d5016`
- **專業醫療形象**：清晰、可信、易用的醫療預約體驗
- **Accessibility**：符合 WCAG 2.1 AA 標準，色彩對比度足夠
- **跨設備體驗**：手機、平板、桌面版本一致

### 非目標
- 暫時唔做多品牌色系或彩色主題
- 暫時唔做重裝飾（大型插畫、動態背景）
- 保持專業醫療風格，避免過度活潑

---

## Source of Truth（改風格先改邊度）

| 元素 | 文件位置 |
|------|----------|
| **CSS 變數** | `app/globals.css` |
| **品牌色常數** | `components/chat/constants.ts` (PRIMARY) |
| **首頁** | `app/page.tsx` |
| **登入頁** | `app/login/page.tsx` |
| **醫生列表** | `app/doctor/page.tsx` |
| **聊天室** | `app/chat/page.tsx` |
| **取消預約** | `app/cancel/page.tsx` |
| **改期預約** | `app/reschedule/page.tsx` |
| **ChatWidget** | `components/ChatWidget.tsx` |

---

## 品牌色規則（最重要）

### 主品牌色

```css
--primary: #2d5016;         /* 醫天圓深綠色 */
--primary-hover: #1f3810;   /* Hover 狀態 */
--primary-light: #e8f5e0;   /* 淺綠背景 */
--primary-pale: #f5f9f2;    /* 極淺綠背景 */
```

### 使用規範

**✅ 允許使用**：
- 主要按鈕：`bg-primary hover:bg-primary-hover`
- 主標題：`text-primary`
- Loading Spinner：`text-primary`
- 品牌 Badge：`bg-primary-light text-primary`
- 邊框：`border-primary` 或 `border-primary-light`
- 焦點狀態：`focus:ring-primary`

**⚠️ 使用 Tailwind 變數，唔好 hardcode `#2d5016`**

**❌ 禁止使用**：
- 唔好用 `emerald-*` 系列（已統一改為品牌色）
- 唔好自創其他綠色（除語義色）
- 唔好用第二主色做主要 CTA

### 語義色（只用於特定場景）

```css
--success: #10b981;  /* 綠色 - 成功狀態 */
--error: #ef4444;    /* 紅色 - 錯誤/取消 */
--warning: #f59e0b;  /* 琥珀色 - 警告 */
```

**使用場景**：
- Success：成功提交、改期成功（用 `green-*` 系列）
- Error：錯誤訊息、刪除確認
- Warning：注意事項、提醒

---

## 元件規範

### 按鈕

| 類型 | Tailwind Class | 用途 |
|------|----------------|------|
| **主要 CTA** | `bg-primary hover:bg-primary-hover text-white rounded-xl px-4 py-3` | 主要操作：預約、確認、提交 |
| **次要按鈕** | `border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-3` | 次要操作：取消、返回 |
| **危險按鈕** | `bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-3` | 刪除、取消預約 |
| **文字按鈕** | `text-primary hover:underline` | 內聯連結 |

### 卡片

| 類型 | Tailwind Class |
|------|----------------|
| **主卡片** | `rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8` |
| **資訊卡片** | `rounded-xl bg-slate-50 p-5` |
| **玻璃卡片** | `rounded-2xl border border-[#e8f5e0] bg-white/80 backdrop-blur p-4 shadow-sm` |

### Badge / Tag

| 類型 | Tailwind Class |
|------|----------------|
| **品牌 Badge** | `bg-primary-light text-primary rounded-full px-3 py-1 text-xs font-semibold` |
| **狀態 Badge** | `bg-green-100 text-green-800 rounded-full px-2 py-0.5 text-xs font-medium` |
| **Chat Mode Badge** | `bg-primary-light text-primary` (G1), `bg-primary-light/60 text-primary/80` (G2) |

### 輸入框

```tsx
className="w-full rounded-lg border border-gray-300 bg-white py-3 px-4 text-sm
transition-colors focus:border-[#2d5016] focus:outline-none focus:ring-1
focus:ring-[#2d5016]"
```

---

## 圓角規範

| 元素 | 圓角大小 | Tailwind Class |
|------|----------|----------------|
| **大卡片/容器** | 16px | `rounded-2xl` |
| **一般卡片** | 12px | `rounded-xl` |
| **按鈕** | 12px | `rounded-xl` |
| **輸入框** | 8px | `rounded-lg` |
| **小 Badge** | 完全圓角 | `rounded-full` |

---

## 背景系統

| 頁面類型 | 背景色 | 用途 |
|----------|--------|------|
| **公開頁面** | `bg-[#f5f9f2]` | 首頁、登入頁 |
| **功能頁面** | `bg-slate-50` | Cancel、Reschedule |
| **工作區** | `bg-white` | 醫生列表、Chat 聊天室 |

---

## 排版規範

### 字體

使用系統字體（無需額外載入）：
```css
font-family: Arial, Helvetica, sans-serif;
```

### 文字大小

| 元素 | Tailwind Class | 用途 |
|------|----------------|------|
| **頁面標題** | `text-2xl font-semibold` | H1 主標題 |
| **卡片標題** | `text-lg font-semibold` | H2 次標題 |
| **正文** | `text-sm text-gray-600` | 一般內容 |
| **小字** | `text-xs text-gray-500` | 輔助資訊 |

### 顏色

| 用途 | Tailwind Class |
|------|----------------|
| **主要文字** | `text-gray-900` |
| **次要文字** | `text-gray-600` |
| **輔助文字** | `text-gray-500` |
| **品牌文字** | `text-[#2d5016]` |

---

## 間距規範

### 容器

```tsx
<div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
  {/* 內容 */}
</div>
```

### 元素間距

| 場景 | Tailwind Class |
|------|----------------|
| **頁面區塊** | `space-y-6` (desktop), `space-y-4` (mobile) |
| **卡片內部** | `space-y-4` |
| **表單** | `space-y-3` |

---

## 互動與可及性（a11y）

### 必須遵守

✅ **色彩對比**：
- 正常文字：最少 4.5:1
- 大標題：最少 3:1
- 品牌色 `#2d5016` 對白色背景：通過 AA 標準

✅ **Focus 狀態**：
```tsx
focus:border-[#2d5016] focus:ring-1 focus:ring-[#2d5016] focus:outline-none
```

✅ **Touch Target**：
- 最少 44x44px
- 按鈕 `px-4 py-3` 確保足夠大

✅ **Keyboard Navigation**：
- Tab 順序合理
- Enter 可觸發按鈕

---

## 體質顏色規範（醫生列表專用）

| 體質 | 英文 | 顏色 | Tailwind Class |
|------|------|------|----------------|
| **虛損** | depleting | 綠色 | `bg-emerald-100 text-emerald-800` |
| **鬱結** | crossing | 藍色 | `bg-blue-100 text-blue-800` |
| **痰濕** | hoarding | 紫色 | `bg-purple-100 text-purple-800` |
| **混合** | mixed | 橙色 | `bg-orange-100 text-orange-800` |
| **未評估** | unknown | 灰色 | `bg-gray-100 text-gray-600` |

**重要**：體質顏色只用於醫生列表頁面的 Badge，唔可以用於主要 CTA 或大面積背景。

---

## Do / Don't（避免跑偏清單）

### ✅ Do

- 新頁面先參考現有頁面骨架（首頁、登入、醫生列表）
- 所有主要互動都用 `#2d5016`
- 成功狀態用 `green-*` 系列（語義色）
- 錯誤用 `red-*` 系列
- 使用 shadcn/ui 既有元件
- 保持專業醫療形象

### ❌ Don't

- 唔好用 `emerald-*` 系列（已統一）
- 唔好新增第二主色
- 唔好每頁自己設計新 card 規則
- 唔好用超粗字重（`font-black`/`font-extrabold`）
- 唔好用 emoji 做主要圖示（可以用於對話內容）

---

## 擴展網站時的最小步驟（給 AI）

1. **先讀 `app/globals.css`**，確認 CSS 變數
2. **新頁面用相同骨架**：
   - 背景：根據頁面類型選擇（公開/功能/工作區）
   - 容器：`mx-auto max-w-6xl px-6`
   - 標題：`text-2xl font-semibold text-[#2d5016]`
3. **按鈕用統一樣式**：主要 CTA 用 `bg-[#2d5016]`
4. **視覺要改：集中改 `globals.css`**，避免散落各元件

---

## 測試清單（改完必 check）

- [ ] 所有頁面用 `#2d5016` 作主品牌色
- [ ] 無使用 `emerald-*` 系列（除非有特殊原因）
- [ ] 按鈕大小足夠（最少 44x44px）
- [ ] 色彩對比度通過 AA 標準
- [ ] Focus 狀態清晰可見
- [ ] 手機版正常顯示
- [ ] Loading 狀態用品牌色 spinner

---

**最後更新**：2026-02-16
**負責人**：CC9098
**項目**：EdenChatbotBooking（醫天圓預約系統）
