-- Public announcements only. Tokens are environment secrets, never database fields.
create table public.ig_news_sync (
  id text primary key check (id = 'eden'),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz,
  attempted_at timestamptz,
  last_error text,
  source text check (source in ('manual', 'daily')),
  actor uuid,
  run_id uuid,
  lease_until timestamptz
);
alter table public.ig_news_sync enable row level security;
revoke all on public.ig_news_sync from anon, authenticated;
grant select, insert, update on public.ig_news_sync to service_role;
insert into public.ig_news_sync (id) values ('eden');

create function public.claim_ig_news_sync(p_run_id uuid, p_source text, p_actor uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.ig_news_sync set run_id = p_run_id, lease_until = now() + interval '2 minutes',
    attempted_at = now(), source = p_source, actor = p_actor
  where id = 'eden'
    and (lease_until is null or lease_until < now())
    and (attempted_at is null or attempted_at < now() - interval '30 seconds');
  return found;
end;
$$;
revoke all on function public.claim_ig_news_sync(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_ig_news_sync(uuid, text, uuid) to service_role;

-- Only cached, already-public IG announcement images. No client write policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ig-news', 'ig-news', true, 10485760, array['image/jpeg','image/png','image/webp']);
