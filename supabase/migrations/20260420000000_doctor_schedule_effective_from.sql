alter table doctor_schedules
  add column if not exists effective_from date;

update doctor_schedules
set effective_from = current_date
where effective_from is null;

alter table doctor_schedules
  alter column effective_from set default current_date;

alter table doctor_schedules
  alter column effective_from set not null;

create index if not exists idx_doctor_schedules_lookup
  on doctor_schedules (doctor_id, clinic_id, effective_from desc);

create unique index if not exists idx_doctor_schedules_unique_version
  on doctor_schedules (doctor_id, clinic_id, effective_from);
