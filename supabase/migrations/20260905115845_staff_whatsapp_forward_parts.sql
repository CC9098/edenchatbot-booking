-- WhatsApp sends one attachment per message; track every part without storing content.
alter table public.staff_whatsapp_forward_requests
  add column message_ids bigint[] not null default '{}',
  add column part_count integer not null default 1 check (part_count > 0);
