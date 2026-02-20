-- Support partial-day holiday blocks for booking availability
alter table if exists holidays
  add column if not exists start_time time,
  add column if not exists end_time time;

-- Ensure time range is either both NULL (all-day) or both set with start < end
alter table if exists holidays
  drop constraint if exists holidays_time_range_chk;

alter table if exists holidays
  add constraint holidays_time_range_chk
  check (
    (start_time is null and end_time is null)
    or
    (start_time is not null and end_time is not null and start_time < end_time)
  );

create index if not exists idx_holidays_date_scope
  on holidays (holiday_date, doctor_id, clinic_id);
