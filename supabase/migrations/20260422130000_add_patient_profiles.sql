-- ============================================================
-- Phase 2A: family / multi-patient support.
-- One auth user → many patient_profiles.
-- booking_intake gets patient_profile_id.
--
-- Strategy: additive only — no drops, no column renames,
-- no data loss. All DDL is guarded with IF NOT EXISTS so
-- this migration is safe to re-run.
-- ============================================================


-- ============================================================
-- 1. Create patient_profiles table
--    One account (user_id) → many patients.
--    is_default = true marks the "self" profile for the account.
--    A partial unique index enforces at most one default per user.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text        NOT NULL,
  relationship     text,                        -- free-text: 自己 / 配偶 / 子女 / 長輩 / 其他
  date_of_birth    date,
  gender           text,
  is_default       boolean     NOT NULL DEFAULT false,  -- exactly one per user_id should be true
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id
  ON public.patient_profiles(user_id);

-- Enforce at most one is_default = true per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_one_default_per_user
  ON public.patient_profiles(user_id)
  WHERE is_default = true;


-- ============================================================
-- 2. Row Level Security for patient_profiles
-- ============================================================
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own patient_profiles"
    ON public.patient_profiles FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own patient_profiles"
    ON public.patient_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own patient_profiles"
    ON public.patient_profiles FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own patient_profiles"
    ON public.patient_profiles FOR DELETE
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================
-- 3. updated_at auto-touch trigger
--    Drop-then-recreate is the portable Postgres pattern for
--    "CREATE TRIGGER IF NOT EXISTS" (not natively supported).
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_touch_patient_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
BEGIN
  -- Drop first so the migration is idempotent
  DROP TRIGGER IF EXISTS patient_profiles_touch_updated_at
    ON public.patient_profiles;

  CREATE TRIGGER patient_profiles_touch_updated_at
    BEFORE UPDATE ON public.patient_profiles
    FOR EACH ROW EXECUTE FUNCTION public.tg_touch_patient_profiles_updated_at();

  RAISE NOTICE '[Phase2A] patient_profiles_touch_updated_at trigger (re)created.';
END $$;


-- ============================================================
-- 4. Add patient_profile_id to booking_intake
--    ON DELETE SET NULL: deleting a profile record does NOT
--    cascade-delete historical bookings; it just clears the link.
-- ============================================================
ALTER TABLE public.booking_intake
  ADD COLUMN IF NOT EXISTS patient_profile_id uuid
    REFERENCES public.patient_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_intake_patient_profile_id
  ON public.booking_intake(patient_profile_id);


-- ============================================================
-- 5. Backfill: populate patient_profiles from existing
--    booking_intake rows and link them back.
--
--    Algorithm:
--    a) Collect distinct (user_id, trimmed_patient_name) pairs
--       from booking_intake where:
--       - user_id IS NOT NULL
--       - patient_name is not null and not whitespace-only
--    b) For each pair:
--       - INSERT ... ON CONFLICT DO NOTHING to upsert a
--         patient_profiles row (idempotent).
--       - is_default = true for the first patient_name per user_id
--         (ordered by the earliest created_at among their bookings).
--       - relationship = '自己' for that first / only profile per user.
--    c) UPDATE booking_intake.patient_profile_id using the
--       newly created (or pre-existing) profile rows.
--
--    Idempotency: ON CONFLICT DO NOTHING on the INSERT means
--    re-runs skip already-created profiles. The final UPDATE
--    is a plain SET which is safe to re-run.
--
--    Rows with null user_id are intentionally skipped;
--    they will be claimed in Phase 1B (WhatsApp unification).
-- ============================================================
DO $$
DECLARE
  v_inserted_profiles   integer := 0;
  v_updated_bookings    integer := 0;
  v_skipped_null_user   integer := 0;
  v_skipped_blank_name  integer := 0;
BEGIN

  -- ── Step 5a: Count rows we will skip for diagnostics ────────
  SELECT count(*) INTO v_skipped_null_user
    FROM public.booking_intake
   WHERE user_id IS NULL;

  SELECT count(*) INTO v_skipped_blank_name
    FROM public.booking_intake
   WHERE user_id IS NOT NULL
     AND (patient_name IS NULL OR trim(patient_name) = '');

  RAISE NOTICE '[Phase2A] Skipping % rows with null user_id (to be claimed in Phase 1B).',
    v_skipped_null_user;
  RAISE NOTICE '[Phase2A] Skipping % rows with non-null user_id but blank/null patient_name.',
    v_skipped_blank_name;


  -- ── Step 5b: Build distinct (user_id, name) pairs with rank ─
  --    rank = 1 means "first booking per user_id" → is_default + relationship
  --
  --    We use a temp table so we can reference profile IDs afterwards.
  CREATE TEMP TABLE IF NOT EXISTS _phase2a_profile_seed AS
  SELECT DISTINCT ON (bi.user_id, trim(bi.patient_name))
    bi.user_id,
    trim(bi.patient_name)                           AS display_name,
    -- row_number gives us ordinal position per user_id ordered by earliest booking
    row_number() OVER (
      PARTITION BY bi.user_id
      ORDER BY min(bi.created_at) OVER (
        PARTITION BY bi.user_id, trim(bi.patient_name)
      )
    )                                               AS name_rank
  FROM public.booking_intake bi
  WHERE bi.user_id IS NOT NULL
    AND bi.patient_name IS NOT NULL
    AND trim(bi.patient_name) <> ''
  ORDER BY bi.user_id, trim(bi.patient_name), bi.created_at;

  -- Add generated uuid column so we can capture the inserted id
  ALTER TABLE _phase2a_profile_seed
    ADD COLUMN IF NOT EXISTS profile_id uuid;


  -- ── Step 5c: Insert patient_profiles rows ───────────────────
  --    ON CONFLICT on (user_id) WHERE is_default is only for the
  --    unique partial index, so we need a different conflict target
  --    for deduplication. We use display_name per user as the
  --    logical unique key by pre-checking existence.
  --
  --    Because there is no explicit UNIQUE(user_id, display_name)
  --    constraint on the table (by design — display_name is free
  --    text and can be changed later), we check existence manually
  --    and INSERT only when the pair does not yet exist.

  UPDATE _phase2a_profile_seed seed
  SET profile_id = pp.id
  FROM public.patient_profiles pp
  WHERE pp.user_id      = seed.user_id
    AND pp.display_name = seed.display_name;

  -- Insert rows that still have no profile_id (i.e., not yet in the table)
  WITH inserted AS (
    INSERT INTO public.patient_profiles
      (user_id, display_name, is_default, relationship)
    SELECT
      seed.user_id,
      seed.display_name,
      (seed.name_rank = 1)                            AS is_default,
      CASE WHEN seed.name_rank = 1 THEN '自己' ELSE NULL END AS relationship
    FROM _phase2a_profile_seed seed
    WHERE seed.profile_id IS NULL
    -- Guard: skip if another profile already owns is_default for this user
    --        (handles re-runs where first profile was already inserted)
    ON CONFLICT DO NOTHING
    RETURNING id, user_id, display_name
  )
  UPDATE _phase2a_profile_seed seed
  SET    profile_id = ins.id
  FROM   inserted ins
  WHERE  ins.user_id      = seed.user_id
    AND  ins.display_name = seed.display_name;

  GET DIAGNOSTICS v_inserted_profiles = ROW_COUNT;
  RAISE NOTICE '[Phase2A] Inserted % new patient_profile rows.', v_inserted_profiles;


  -- ── Step 5d: Link booking_intake rows to their profile ──────
  UPDATE public.booking_intake bi
  SET    patient_profile_id = seed.profile_id
  FROM   _phase2a_profile_seed seed
  WHERE  bi.user_id                = seed.user_id
    AND  trim(bi.patient_name)     = seed.display_name
    AND  seed.profile_id IS NOT NULL
    AND  bi.patient_profile_id IS NULL;   -- skip already-linked rows (idempotent)

  GET DIAGNOSTICS v_updated_bookings = ROW_COUNT;
  RAISE NOTICE '[Phase2A] Linked % booking_intake rows to patient_profile_id.', v_updated_bookings;


  -- ── Step 5e: Clean up temp table ────────────────────────────
  DROP TABLE IF EXISTS _phase2a_profile_seed;

  RAISE NOTICE '[Phase2A] Backfill complete.';

END $$;


-- ============================================================
-- End of Phase 2A migration
-- ============================================================
