create table if not exists public.staff_training_results (
  id              uuid primary key default gen_random_uuid(),
  staff_user_id   uuid not null references auth.users(id) on delete cascade,
  staff_email     text,
  module_id       text not null,
  module_title    text not null,
  video_id        text not null,
  video_title     text not null,
  score           integer not null,
  total           integer not null,
  critical_errors integer not null default 0,
  passed          boolean not null default false,
  answers         jsonb not null default '{}'::jsonb,
  completed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint staff_training_results_score_range check (score >= 0 and score <= total),
  constraint staff_training_results_total_positive check (total > 0),
  constraint staff_training_results_critical_errors_range check (critical_errors >= 0 and critical_errors <= total)
);

create index if not exists idx_staff_training_results_staff_completed
  on public.staff_training_results (staff_user_id, completed_at desc);

create index if not exists idx_staff_training_results_module_completed
  on public.staff_training_results (module_id, completed_at desc);

create index if not exists idx_staff_training_results_completed
  on public.staff_training_results (completed_at desc);

do $$ begin
  create trigger trg_staff_training_results_updated_at
    before update on public.staff_training_results
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

alter table public.staff_training_results enable row level security;

do $$ begin
  create policy "staff_training_results_select_own"
    on public.staff_training_results for select
    using (auth.uid() = staff_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "staff_training_results_insert_own"
    on public.staff_training_results for insert
    with check (auth.uid() = staff_user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "staff_training_results_manager_all"
    on public.staff_training_results for all
    using (is_admin(auth.uid()) or exists (
      select 1
      from public.staff_roles sr
      where sr.user_id = auth.uid()
        and sr.role = 'doctor'
        and sr.is_active = true
    ));
exception when duplicate_object then null; end $$;
