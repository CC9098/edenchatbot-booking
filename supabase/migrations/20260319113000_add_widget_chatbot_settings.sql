create table if not exists public.widget_chatbot_settings (
  singleton_key text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.widget_chatbot_settings enable row level security;

do $$ begin
  create policy "widget_chatbot_settings_admin_all"
    on public.widget_chatbot_settings
    for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_widget_chatbot_settings_updated_at
    before update on public.widget_chatbot_settings
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

insert into public.widget_chatbot_settings (singleton_key, config)
values ('default', '{}'::jsonb)
on conflict (singleton_key) do nothing;
