-- Harden legacy billing table access.
-- Goal: prevent anon/authenticated direct reads while preserving service-role workflows.

do $$
declare
  p record;
begin
  if to_regclass('public.member_subscriptions') is null then
    return;
  end if;

  execute 'alter table public.member_subscriptions enable row level security';

  -- Clear existing policies so authenticated/anon cannot access this legacy table.
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'member_subscriptions'
  loop
    execute format('drop policy if exists %I on public.member_subscriptions', p.policyname);
  end loop;

  -- Restrict direct grants on legacy table.
  execute 'revoke all on table public.member_subscriptions from anon';
  execute 'revoke all on table public.member_subscriptions from authenticated';
end $$;

comment on table public.member_subscriptions is
  'Legacy billing table. Access should be service role only; use user_subscriptions for active integration.';
