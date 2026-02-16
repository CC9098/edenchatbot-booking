-- ============================================================
-- Content Unification Phase 1
-- Date: 2026-02-16
-- Purpose: Add articles/courses content layer into EdenChatbotBooking
-- ============================================================

-- ============================================================
-- 1) CREATE CONTENT TABLES
-- ============================================================

create table if not exists articles (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  excerpt           text,
  content_md        text not null,
  cover_image_url   text,
  tags              text[] not null default '{}'::text[],
  is_active         boolean not null default true,
  published_at      timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists courses (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  description_md    text,
  cover_image_url   text,
  level             text,
  is_active         boolean not null default true,
  published_at      timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists course_modules (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  title             text not null,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists course_lessons (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses(id) on delete cascade,
  module_id         uuid references course_modules(id) on delete set null,
  slug              text not null,
  title             text not null,
  content_md        text not null,
  video_url         text,
  duration_minutes  integer,
  sort_order        integer not null default 0,
  is_active         boolean not null default true,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (course_id, slug),
  constraint course_lessons_duration_non_negative
    check (duration_minutes is null or duration_minutes >= 0)
);

create table if not exists user_lesson_progress (
  user_id           uuid not null references auth.users(id) on delete cascade,
  lesson_id         uuid not null references course_lessons(id) on delete cascade,
  progress_pct      integer not null default 0,
  completed_at      timestamptz,
  last_viewed_at    timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, lesson_id),
  constraint user_lesson_progress_pct_range
    check (progress_pct >= 0 and progress_pct <= 100)
);

-- ============================================================
-- 2) INDEXES
-- ============================================================

create index if not exists idx_articles_published
  on articles (is_active, published_at desc);

create index if not exists idx_courses_published
  on courses (is_active, published_at desc);

create index if not exists idx_course_modules_course
  on course_modules (course_id, is_active, sort_order);

create index if not exists idx_course_lessons_course
  on course_lessons (course_id, module_id, is_active, sort_order, published_at desc);

create index if not exists idx_user_lesson_progress_user
  on user_lesson_progress (user_id, last_viewed_at desc);

-- ============================================================
-- 3) AUTO-UPDATE updated_at TRIGGERS
-- ============================================================

-- Reuse existing update_updated_at() function

do $$ begin
  create trigger trg_articles_updated_at before update on articles
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_courses_updated_at before update on courses
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_course_modules_updated_at before update on course_modules
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_course_lessons_updated_at before update on course_lessons
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_user_lesson_progress_updated_at before update on user_lesson_progress
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 4) ROW LEVEL SECURITY
-- ============================================================

alter table articles enable row level security;
alter table courses enable row level security;
alter table course_modules enable row level security;
alter table course_lessons enable row level security;
alter table user_lesson_progress enable row level security;

-- articles: public read published + active

do $$ begin
  create policy "articles_select_public" on articles for select
    using (is_active = true and published_at is not null and published_at <= now());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "articles_admin_all" on articles for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- courses: public read published + active

do $$ begin
  create policy "courses_select_public" on courses for select
    using (is_active = true and published_at is not null and published_at <= now());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "courses_admin_all" on courses for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- modules: public read only if parent course is published + active

do $$ begin
  create policy "course_modules_select_public" on course_modules for select
    using (
      is_active = true and exists (
        select 1 from courses c
        where c.id = course_modules.course_id
          and c.is_active = true
          and c.published_at is not null
          and c.published_at <= now()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "course_modules_admin_all" on course_modules for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- lessons: public read only if lesson + course are published + active

do $$ begin
  create policy "course_lessons_select_public" on course_lessons for select
    using (
      is_active = true
      and published_at is not null
      and published_at <= now()
      and exists (
        select 1 from courses c
        where c.id = course_lessons.course_id
          and c.is_active = true
          and c.published_at is not null
          and c.published_at <= now()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "course_lessons_admin_all" on course_lessons for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- progress: user private access + admin

do $$ begin
  create policy "lesson_progress_select_own" on user_lesson_progress for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lesson_progress_insert_own" on user_lesson_progress for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lesson_progress_update_own" on user_lesson_progress for update
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lesson_progress_delete_own" on user_lesson_progress for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lesson_progress_admin_all" on user_lesson_progress for all
    using (is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
