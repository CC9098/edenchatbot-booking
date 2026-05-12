update public.doctor_schedules
set calendar_id = 'bb9e3b864e99dd1dda3e828e40f2545f245c8e2fd01bd459390c3409e46db4d3@group.calendar.google.com'
where doctor_id = 'wong'
  and clinic_id = 'jordan'
  and effective_from = '2026-05-01';
