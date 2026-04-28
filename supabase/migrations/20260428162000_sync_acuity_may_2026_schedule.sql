insert into public.doctors (id, name, name_zh, title, title_zh, is_active)
values
  ('cheungmy', 'Dr. Cheung', '張敏言醫師', 'Doctor', '醫師', true)
on conflict (id) do update
set
  name = excluded.name,
  name_zh = excluded.name_zh,
  title = excluded.title,
  title_zh = excluded.title_zh,
  is_active = excluded.is_active;

insert into public.doctor_schedules (
  doctor_id,
  clinic_id,
  calendar_id,
  is_active,
  effective_from,
  schedule
)
values
  (
    'cheung',
    'jordan',
    'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
    false,
    '2026-05-01',
    '{"0": null, "1": null, "2": null, "3": null, "4": null, "5": null, "6": null}'::jsonb
  ),
  (
    'cheungmy',
    'jordan',
    'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": null,
      "2": null,
      "3": null,
      "4": [{"start": "11:00", "end": "14:00"}],
      "5": null,
      "6": null
    }'::jsonb
  ),
  (
    'cheungmy',
    'tsuenwan',
    'ibk3t07kqhdvp5lfvpim401vqo@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": null,
      "2": null,
      "3": [{"start": "10:30", "end": "14:00"}, {"start": "15:30", "end": "17:00"}],
      "4": null,
      "5": null,
      "6": null
    }'::jsonb
  )
on conflict (doctor_id, clinic_id, effective_from) do update
set
  calendar_id = excluded.calendar_id,
  is_active = excluded.is_active,
  schedule = excluded.schedule;

do $$
begin
  if exists (
    select 1 from public.holidays
    where holiday_date = '2026-05-01'
      and doctor_id is null
      and clinic_id is null
      and start_time is null
      and end_time is null
  ) then
    update public.holidays
    set reason = '勞動節，全線休息一日'
    where holiday_date = '2026-05-01'
      and doctor_id is null
      and clinic_id is null
      and start_time is null
      and end_time is null;
  else
    insert into public.holidays (doctor_id, clinic_id, holiday_date, start_time, end_time, reason)
    values (null, null, '2026-05-01', null, null, '勞動節，全線休息一日');
  end if;

  if exists (
    select 1 from public.holidays
    where holiday_date = '2026-05-02'
      and doctor_id = 'chan'
      and clinic_id = 'tsuenwan'
      and start_time is null
      and end_time is null
  ) then
    update public.holidays
    set reason = '陳醫師休息一日'
    where holiday_date = '2026-05-02'
      and doctor_id = 'chan'
      and clinic_id = 'tsuenwan'
      and start_time is null
      and end_time is null;
  else
    insert into public.holidays (doctor_id, clinic_id, holiday_date, start_time, end_time, reason)
    values ('chan', 'tsuenwan', '2026-05-02', null, null, '陳醫師休息一日');
  end if;

  if exists (
    select 1 from public.holidays
    where holiday_date = '2026-05-06'
      and doctor_id = 'cheungmy'
      and clinic_id = 'tsuenwan'
      and start_time is null
      and end_time is null
  ) then
    update public.holidays
    set reason = '張敏言醫師5月13日起應診'
    where holiday_date = '2026-05-06'
      and doctor_id = 'cheungmy'
      and clinic_id = 'tsuenwan'
      and start_time is null
      and end_time is null;
  else
    insert into public.holidays (doctor_id, clinic_id, holiday_date, start_time, end_time, reason)
    values ('cheungmy', 'tsuenwan', '2026-05-06', null, null, '張敏言醫師5月13日起應診');
  end if;

  if exists (
    select 1 from public.holidays
    where holiday_date = '2026-05-07'
      and doctor_id = 'cheungmy'
      and clinic_id = 'jordan'
      and start_time is null
      and end_time is null
  ) then
    update public.holidays
    set reason = '張敏言醫師5月13日起應診'
    where holiday_date = '2026-05-07'
      and doctor_id = 'cheungmy'
      and clinic_id = 'jordan'
      and start_time is null
      and end_time is null;
  else
    insert into public.holidays (doctor_id, clinic_id, holiday_date, start_time, end_time, reason)
    values ('cheungmy', 'jordan', '2026-05-07', null, null, '張敏言醫師5月13日起應診');
  end if;
end $$;
