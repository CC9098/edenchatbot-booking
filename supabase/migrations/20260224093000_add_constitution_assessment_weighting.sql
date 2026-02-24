-- Add weighted doctor assessment fields for constitution resolution.
-- Rule:
--   suspect = +30
--   likely  = +70
--   confirmed = always confirm (override weighted ranking)

alter table if exists patient_care_profile
  add column if not exists constitution_score_depleting integer not null default 0,
  add column if not exists constitution_score_crossing integer not null default 0,
  add column if not exists constitution_score_hoarding integer not null default 0,
  add column if not exists constitution_score_mixed integer not null default 0,
  add column if not exists doctor_assessment_level text not null default 'confirmed',
  add column if not exists doctor_assessment_constitution constitution_type,
  add column if not exists doctor_assessment_at timestamptz;

alter table if exists patient_care_profile
  drop constraint if exists patient_care_profile_doctor_assessment_level_check;

alter table if exists patient_care_profile
  add constraint patient_care_profile_doctor_assessment_level_check
  check (doctor_assessment_level in ('suspect', 'likely', 'confirmed'));

alter table if exists patient_care_profile
  drop constraint if exists patient_care_profile_constitution_score_depleting_non_negative;

alter table if exists patient_care_profile
  add constraint patient_care_profile_constitution_score_depleting_non_negative
  check (constitution_score_depleting >= 0);

alter table if exists patient_care_profile
  drop constraint if exists patient_care_profile_constitution_score_crossing_non_negative;

alter table if exists patient_care_profile
  add constraint patient_care_profile_constitution_score_crossing_non_negative
  check (constitution_score_crossing >= 0);

alter table if exists patient_care_profile
  drop constraint if exists patient_care_profile_constitution_score_hoarding_non_negative;

alter table if exists patient_care_profile
  add constraint patient_care_profile_constitution_score_hoarding_non_negative
  check (constitution_score_hoarding >= 0);

alter table if exists patient_care_profile
  drop constraint if exists patient_care_profile_constitution_score_mixed_non_negative;

alter table if exists patient_care_profile
  add constraint patient_care_profile_constitution_score_mixed_non_negative
  check (constitution_score_mixed >= 0);

