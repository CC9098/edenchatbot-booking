create index if not exists idx_symptom_follow_up_answers_recorded_by
  on public.symptom_follow_up_answers (recorded_by, asked_at desc);
