-- ============================================================
-- Knowledge Cards Workspace (Obsidian-like authoring layer)
-- Date: 2026-02-19
-- ============================================================

create table if not exists public.knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_md text not null default '',
  status text not null default 'inbox'
    check (status in ('inbox', 'drafting', 'ready', 'published', 'archived')),
  source text not null default 'manual'
    check (source in ('manual', 'article_sync', 'ai_assist')),
  tags text[] not null default '{}'::text[],
  source_article_id uuid references public.articles(id) on delete set null,
  source_hash text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_cards_status on public.knowledge_cards(status);
create index if not exists idx_knowledge_cards_source on public.knowledge_cards(source);
create index if not exists idx_knowledge_cards_active on public.knowledge_cards(is_active);
create index if not exists idx_knowledge_cards_source_article on public.knowledge_cards(source_article_id);
create index if not exists idx_knowledge_cards_updated_at on public.knowledge_cards(updated_at desc);
create index if not exists idx_knowledge_cards_tags_gin on public.knowledge_cards using gin(tags);

create table if not exists public.knowledge_card_article_links (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.knowledge_cards(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  relation_type text not null default 'seed'
    check (relation_type in ('seed', 'draft', 'published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(card_id, article_id, relation_type)
);

create index if not exists idx_card_article_links_card on public.knowledge_card_article_links(card_id);
create index if not exists idx_card_article_links_article on public.knowledge_card_article_links(article_id);
create index if not exists idx_card_article_links_relation on public.knowledge_card_article_links(relation_type);

alter table public.knowledge_cards enable row level security;
alter table public.knowledge_card_article_links enable row level security;

do $$ begin
  create policy "knowledge_cards_select_staff"
    on public.knowledge_cards for select
    using (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "knowledge_cards_insert_staff"
    on public.knowledge_cards for insert
    with check (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "knowledge_cards_update_staff"
    on public.knowledge_cards for update
    using (is_staff(auth.uid()))
    with check (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "knowledge_cards_delete_admin"
    on public.knowledge_cards for delete
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_links_select_staff"
    on public.knowledge_card_article_links for select
    using (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_links_insert_staff"
    on public.knowledge_card_article_links for insert
    with check (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_links_update_staff"
    on public.knowledge_card_article_links for update
    using (is_staff(auth.uid()))
    with check (is_staff(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "card_links_delete_admin"
    on public.knowledge_card_article_links for delete
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_knowledge_cards_updated_at
    before update on public.knowledge_cards
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;
