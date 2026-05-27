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
    'central',
    '1n6d816lab7isce87ma0ua8qoc@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": [{"start": "15:30", "end": "19:30"}],
      "2": null,
      "3": null,
      "4": null,
      "5": [{"start": "15:30", "end": "19:30"}],
      "6": null
    }'::jsonb
  ),
  (
    'cheung',
    'jordan',
    'r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": [{"start": "11:00", "end": "14:00"}],
      "2": [{"start": "11:00", "end": "14:00"}, {"start": "15:30", "end": "19:00"}],
      "3": [{"start": "11:00", "end": "14:00"}, {"start": "15:30", "end": "19:00"}],
      "4": null,
      "5": [{"start": "11:00", "end": "14:00"}],
      "6": null
    }'::jsonb
  ),
  (
    'leung',
    'central',
    '117uj7jkd40t0otf9aekvscm84@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": null,
      "2": null,
      "3": null,
      "4": [{"start": "15:30", "end": "19:30"}],
      "5": null,
      "6": null
    }'::jsonb
  ),
  (
    'leung',
    'jordan',
    'a7b5r8c6pfslia0sefcu1f4c38@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": null,
      "1": [{"start": "11:00", "end": "14:00"}],
      "2": null,
      "3": [{"start": "11:00", "end": "14:00"}],
      "4": [{"start": "11:00", "end": "14:00"}],
      "5": null,
      "6": null
    }'::jsonb
  ),
  (
    'leung',
    'tsuenwan',
    'ibk3t07kqhdvp5lfvpim401vqo@group.calendar.google.com',
    true,
    '2026-05-01',
    '{
      "0": [{"start": "10:30", "end": "14:00"}],
      "1": null,
      "2": null,
      "3": null,
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
