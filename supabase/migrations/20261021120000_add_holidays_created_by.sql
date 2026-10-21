-- Audit who created each holiday / closure row in the staff timetable console.
-- Nullable so historical rows and direct script inserts stay valid.
alter table if exists holidays
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists created_by_email text;

comment on column holidays.created_by is 'Staff auth user id that created the row via /api/doctor/timetable/holidays';
comment on column holidays.created_by_email is 'Email of the staff user at creation time (display only)';
