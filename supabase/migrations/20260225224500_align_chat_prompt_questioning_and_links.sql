-- Align chat prompt behavior:
-- 1) Resolve "3 questions vs 1 question" conflicts
-- 2) Make G1 default to direct answer, optional single key clarification only
-- 3) Disable unsolicited links / citation label output unless user asks explicitly

begin;

update public.chat_prompt_settings
set gear_g1_md = $$共同規則：只輸出最終回覆；禁止輸出「根據規則／知識庫檢查／回應策略／檢查紅旗／問：答：」等 meta 內容。
共同規則：禁止提出純聊天式問題（例如「你通常揀咩牌子」）；除非用戶主動提出品牌。
G1 硬規則：回覆 3-6 句。先答結論（可以／可少量／不建議）+ 1-2 句理由 + 1 個可執行做法（份量/時段/溫度）。
G1 硬規則：預設唔提問；優先用「如果…就…」分流句。只有缺少關鍵資料先最多問 1 條會改變建議嘅澄清問題（份量/時段/溫度/禁忌）。
G1 硬規則：除非用戶主動要求文章/連結/資料來源，否則不得主動貼連結。
G1 硬規則：除非用戶主動提出想預約/想睇醫師，否則不得主動預約引流。$$
where type in ('crossing', 'depleting', 'hoarding');

update public.chat_prompt_settings
set prompt_md = replace(
  prompt_md,
  '1) 「澄清追問」優先指：用 1 條自然問題確認用戶係唔係想升級到 G2（想聽更多相關理論、機制、完整調理邏輯）。',
  '1) 「澄清追問」優先指：只問 1 條會直接改變建議嘅問題（例如份量、時段、溫度、食後反應、重要病史）。'
)
where type in ('crossing', 'depleting', 'hoarding');

update public.chat_prompt_settings
set prompt_md = replace(
  prompt_md,
  '若資訊不足，先問最多 3 條澄清問題。',
  '若資訊不足，最多問 1 條會改變建議嘅澄清問題。'
)
where type in ('crossing', 'depleting');

update public.chat_prompt_settings
set prompt_md = replace(
  prompt_md,
  '結論 + 1–2 句理由 +提供3條澄清問題。',
  '結論 + 1–2 句理由 + 最多 1 條澄清問題（只限會改變建議嘅）。'
)
where type = 'hoarding';

update public.chat_prompt_settings
set prompt_md = replace(
  prompt_md,
  '先轉為先問最多3 條澄清問題，再提供「偏保守」嘅一般建議。',
  '先轉為最多問 1 條會改變建議嘅澄清問題，再提供「偏保守」嘅一般建議。'
)
where type = 'hoarding';

update public.chat_prompt_settings
set prompt_md = replace(
  replace(
    prompt_md,
    '1) 若你有使用上方「站內知識庫」作答，請在回覆最後加一行：引用：<你實際引用到的 Source 標題/檔名，用『、』分隔>。',
    '1) 除非用戶主動要求文章/連結/資料來源，否則不得主動貼連結。'
  ),
  '2) 若沒有使用任何站內知識庫內容，請在回覆最後加一行：引用：無',
  '2) 不得輸出「引用：」或「引用：無」等機械標籤。'
)
where type in ('crossing', 'depleting');

update public.chat_prompt_settings
set prompt_md = regexp_replace(
  prompt_md,
  '只有當你「逐字引用」站內文章內容（原文句子）先可以改成：引用：<實際用到嘅檔名/標題，用『' || '、' || '』分隔>',
  '除非用戶主動要求文章/連結/資料來源，否則不得主動貼連結，亦不得輸出「引用：」標籤。',
  'g'
)
where type = 'hoarding';

commit;
