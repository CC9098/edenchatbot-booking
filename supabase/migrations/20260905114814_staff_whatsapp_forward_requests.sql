-- Durable send claim: retrying a request must never issue another WhatsApp send.
create table public.staff_whatsapp_forward_requests (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  account_id bigint not null,
  source_conversation_id bigint not null,
  source_message_id bigint not null,
  destination_conversation_id bigint not null,
  doctor_id text not null,
  payload_hash text not null,
  message_id bigint,
  created_at timestamptz not null default now()
);
alter table public.staff_whatsapp_forward_requests enable row level security;
revoke all on public.staff_whatsapp_forward_requests from public, anon, authenticated;
grant select, insert, update on public.staff_whatsapp_forward_requests to service_role;
comment on table public.staff_whatsapp_forward_requests is
  'Server-only WhatsApp forward idempotency and audit metadata; no message body or phone numbers.';
