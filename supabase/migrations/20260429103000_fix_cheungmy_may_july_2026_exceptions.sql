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
declare
  holiday record;
begin
  for holiday in
    select *
    from (
      values
        ('cheungmy', 'tsuenwan', '2026-05-06'::date, '張敏言醫師星期三例外休診'),
        ('cheungmy', 'tsuenwan', '2026-05-20'::date, '張敏言醫師星期三例外休診'),
        ('cheungmy', 'tsuenwan', '2026-07-01'::date, '張敏言醫師星期三例外休診'),
        ('cheungmy', 'jordan', '2026-05-07'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-05-14'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-05-21'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-05-28'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-06-11'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-06-25'::date, '張敏言醫師星期四例外休診'),
        ('cheungmy', 'jordan', '2026-07-02'::date, '張敏言醫師星期四例外休診')
    ) as holidays(doctor_id, clinic_id, holiday_date, reason)
  loop
    if exists (
      select 1
      from public.holidays
      where doctor_id = holiday.doctor_id
        and clinic_id = holiday.clinic_id
        and holiday_date = holiday.holiday_date
        and start_time is null
        and end_time is null
    ) then
      update public.holidays
      set reason = holiday.reason
      where doctor_id = holiday.doctor_id
        and clinic_id = holiday.clinic_id
        and holiday_date = holiday.holiday_date
        and start_time is null
        and end_time is null;
    else
      insert into public.holidays (
        doctor_id,
        clinic_id,
        holiday_date,
        start_time,
        end_time,
        reason
      )
      values (
        holiday.doctor_id,
        holiday.clinic_id,
        holiday.holiday_date,
        null,
        null,
        holiday.reason
      );
    end if;
  end loop;
end $$;
