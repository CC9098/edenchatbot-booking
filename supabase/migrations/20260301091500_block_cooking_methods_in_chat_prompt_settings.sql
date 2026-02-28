-- Block all cooking-method guidance in DB-driven chat prompts.
-- Idempotent: only append once when marker is missing.
update public.chat_prompt_settings
set extra_instructions_md = concat_ws(E'\n\n',
  nullif(trim(coalesce(extra_instructions_md, '')), ''),
  E'【煮食方法限制】\n- 一律不要提供任何煮食/烹調方法（包括但不限於：蒸、白灼、煎、炒、焗、燉、氣炸、煲湯步驟、食譜做法）。\n- 若用戶追問煮食法，請禮貌拒絕，改為提供非烹調形式建議（例如食材方向、份量原則、進食時段），或建議預約醫師作個人化飲食評估。'
)
where is_active = true
  and position('【煮食方法限制】' in coalesce(extra_instructions_md, '')) = 0;
