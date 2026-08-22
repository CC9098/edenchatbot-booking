-- Route 張敏言醫師 bookings to dedicated calendars instead of calendars
-- belonging to 張天慧醫師 (Jordan) and 梁仲威醫師 (Tsuen Wan).

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
    '02340d736967498edcb5f3d62ff286e79ea51e63cb6f992393d28ffc91c0e38f@group.calendar.google.com',
    true,
    '2026-08-22',
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
    'abff9765dbe5f9b5b39c0809afc3ec41500331c1afbf55e9797efbb31b5b7185@group.calendar.google.com',
    true,
    '2026-08-22',
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
