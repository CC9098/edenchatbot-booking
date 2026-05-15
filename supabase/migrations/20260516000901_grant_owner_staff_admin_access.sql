-- Ensure owner/admin accounts can see all doctor and nurse console data.

insert into public.staff_access_emails (email, role, staff_kind, is_active, note, updated_at)
values
  ('drleungeden@gmail.com', 'admin', 'admin', true, 'Owner-level access requested 2026-05-16', now()),
  ('chetleung@gmail.com', 'admin', 'admin', true, 'Owner-level access requested 2026-05-16', now()),
  ('edeninfo333@gmail.com', 'admin', 'admin', true, 'Owner-level access requested 2026-05-16', now())
on conflict (email) do update
set
  role = excluded.role,
  staff_kind = excluded.staff_kind,
  is_active = excluded.is_active,
  note = excluded.note,
  updated_at = now();

insert into public.staff_roles (user_id, role, is_active)
select id, 'admin'::public.staff_role, true
from auth.users
where lower(email) in ('drleungeden@gmail.com', 'chetleung@gmail.com', 'edeninfo333@gmail.com')
on conflict (user_id) do update
set
  role = excluded.role,
  is_active = true;
