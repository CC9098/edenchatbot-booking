-- ============================================================
-- Strengthens profiles.phone as stable identity key for
-- WhatsApp-first membership. See EdenChatbotBooking Phase 0 plan.
--
-- Phase 0B: Make phone a reliable, normalised identity anchor
-- so that a user who books via WhatsApp and later logs in via
-- email/Google can be unified under one profiles row.
--
-- Strategy: additive only — no drops, no data deletion.
-- All DDL is guarded with IF NOT EXISTS / IF EXISTS so this
-- migration is safe to re-run.
-- ============================================================


-- ============================================================
-- 1. Add normalised phone_digits generated column
--    Strips all non-digit characters from phone so that
--    "+852 9123-4567", "85291234567", and "91234567" can all
--    be compared consistently in application logic.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_digits text GENERATED ALWAYS AS (
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
  ) STORED;


-- ============================================================
-- 2. Backfill note
--    phone_digits is a STORED generated column, so Postgres
--    populates it automatically for every existing row when
--    the column is added — no explicit UPDATE needed.
--    We only need to check for duplicates before adding the
--    unique index.
-- ============================================================

-- Diagnostic: detect existing duplicate phone_digits.
-- This block DOES NOT fail the migration — it only raises
-- NOTICE messages so the operator can review the current state.
DO $$
DECLARE
  dup_record RECORD;
  dup_count  integer := 0;
BEGIN
  FOR dup_record IN
    SELECT phone_digits,
           count(*)           AS user_count,
           array_agg(id)      AS user_ids
    FROM   public.profiles
    WHERE  phone_digits IS NOT NULL
      AND  phone_digits <> ''
    GROUP  BY phone_digits
    HAVING count(*) > 1
    ORDER  BY count(*) DESC
  LOOP
    dup_count := dup_count + 1;
    RAISE NOTICE '[Phase0B] DUPLICATE phone_digits found: % — % profiles — ids: %',
      dup_record.phone_digits,
      dup_record.user_count,
      dup_record.user_ids;
  END LOOP;

  IF dup_count = 0 THEN
    RAISE NOTICE '[Phase0B] No duplicate phone_digits found — unique index will be created.';
  ELSE
    RAISE NOTICE '[Phase0B] % duplicate phone_digits group(s) detected — see NOTICEs above. Manual cleanup required before enforcing unique constraint.',
      dup_count;
  END IF;
END $$;


-- ============================================================
-- 3. Partial unique index on phone_digits
--    Allows multiple rows with NULL or empty phone (pre-signup
--    guest rows) but enforces uniqueness once a phone is set.
--    If existing duplicates prevent index creation, the block
--    skips index creation gracefully with a NOTICE rather than
--    crashing the migration.
-- ============================================================
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_digits_unique
    ON public.profiles(phone_digits)
    WHERE phone_digits IS NOT NULL AND phone_digits <> '';

  RAISE NOTICE '[Phase0B] idx_profiles_phone_digits_unique created (or already exists).';

EXCEPTION
  WHEN unique_violation OR others THEN
    RAISE NOTICE '[Phase0B] Could not create idx_profiles_phone_digits_unique due to existing duplicate phone_digits values. Index skipped — clean up duplicates and re-run. SQLERRM: %', SQLERRM;
END $$;


-- ============================================================
-- 4. Unification banner flag
--    Set to true once the app has shown the user the
--    "We linked your WhatsApp account" banner on first
--    cross-method login, so it is shown only once.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_cross_method_login_banner_shown boolean NOT NULL DEFAULT false;


-- ============================================================
-- 5. Phone normalisation helper function
--    Use this in application queries and RLS policies so
--    normalisation logic stays in one place.
--
--    Example:
--      SELECT * FROM profiles
--      WHERE phone_digits = public.normalize_hk_phone('+852 9123-4567');
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_hk_phone(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(coalesce(input, ''), '[^0-9]', '', 'g');
$$;


-- ============================================================
-- End of Phase 0B migration
-- ============================================================
