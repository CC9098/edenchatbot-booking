insert into public.doctors (id, name, name_zh, title, title_zh, is_active)
values ('wong', 'Dr. Samuel H.C. Wong', '黃浩哲脊醫', 'Chiropractor', '脊醫', true)
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
values (
  'wong',
  'jordan',
  '40cb62a1e50a16724e785554027785b0b1b041a4b8dffea974d0a2d243c0985f@group.calendar.google.com',
  true,
  '2026-05-01',
  '{
    "0": null,
    "1": null,
    "2": null,
    "3": null,
    "4": [{"start": "10:30", "end": "13:00"}],
    "5": null,
    "6": [{"start": "14:30", "end": "16:30"}]
  }'::jsonb
)
on conflict (doctor_id, clinic_id, effective_from) do update
set
  calendar_id = excluded.calendar_id,
  is_active = excluded.is_active,
  schedule = excluded.schedule;
