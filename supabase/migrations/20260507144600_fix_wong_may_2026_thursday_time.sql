update public.doctor_schedules
set schedule = '{
  "0": null,
  "1": null,
  "2": null,
  "3": null,
  "4": [{"start": "11:00", "end": "14:00"}],
  "5": null,
  "6": [{"start": "14:30", "end": "16:30"}]
}'::jsonb
where doctor_id = 'wong'
  and clinic_id = 'jordan'
  and effective_from = '2026-05-01';
