-- ============================================================
-- message_feedback: store thumbs up/down feedback with context
-- ============================================================

create table if not exists message_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feedback_type text not null check (feedback_type in ('up', 'down')),
  source text not null check (source in ('widget_v1', 'chat_v2')),
  message_text text not null,
  message_index integer,
  message_mode text,
  context_messages jsonb not null default '[]'::jsonb,
  session_id text,
  user_id uuid references auth.users(id) on delete set null
);

create index if not exists message_feedback_type_date_idx
  on message_feedback (feedback_type, created_at desc);

create index if not exists message_feedback_source_date_idx
  on message_feedback (source, created_at desc);

create index if not exists message_feedback_created_at_idx
  on message_feedback (created_at desc);

alter table message_feedback enable row level security;

do $$ begin
  create policy "message_feedback_insert_anyone"
    on message_feedback for insert
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "message_feedback_select_admin"
    on message_feedback for select
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
