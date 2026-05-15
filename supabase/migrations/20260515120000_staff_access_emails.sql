-- Email-based staff access allowlist.
-- This lets clinic managers add staff before that person has signed in for the first time.

create table if not exists public.staff_access_emails (
  email       text primary key,
  role        staff_role not null default 'assistant',
  staff_kind  text not null default 'core_assistant',
  is_active   boolean not null default true,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  updated_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint staff_access_emails_email_normalized check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint staff_access_emails_staff_kind check (
    staff_kind in ('core_assistant', 'part_time_assistant', 'doctor', 'admin')
  )
);

alter table public.staff_access_emails enable row level security;

do $$ begin
  create policy "staff_access_emails_admin_all" on public.staff_access_emails
    for all using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
