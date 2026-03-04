-- Ensure active doctor instructions override generic constitution guidance.
-- Idempotent: only append once when marker is missing.
update public.chat_prompt_settings
set extra_instructions_md = concat_ws(E'\n\n',
  nullif(trim(coalesce(extra_instructions_md, '')), ''),
  E'【個人化照護優先規則】\n- 如【病人個人化照護資料】中的醫師有效指示與一般體質建議或站內知識庫內容不一致，必須以醫師有效指示為最高優先。\n- 不要同時輸出互相矛盾的建議。\n- 如醫師指示過於簡短或含糊，先提供保守建議，並建議病人聯絡診所或覆診確認。'
)
where is_active = true
  and position('【個人化照護優先規則】' in coalesce(extra_instructions_md, '')) = 0;
