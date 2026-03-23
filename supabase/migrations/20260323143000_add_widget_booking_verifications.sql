alter table booking_intake
  add column if not exists phone_digits text;

update booking_intake
set phone_digits = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
where phone_digits is null;

create index if not exists idx_booking_intake_phone_digits_date
  on booking_intake (phone_digits, appointment_date, appointment_time);

create table if not exists widget_booking_verifications (
  id uuid primary key default gen_random_uuid(),
  phone_digits text not null,
  purpose text not null default 'manage_booking',
  code_hash text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  delivery_channel text not null default 'whatsapp',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purpose in ('manage_booking')),
  check (delivery_channel in ('whatsapp'))
);

create index if not exists idx_widget_booking_verifications_phone_created
  on widget_booking_verifications (phone_digits, created_at desc);

create index if not exists idx_widget_booking_verifications_active_lookup
  on widget_booking_verifications (phone_digits, expires_at desc)
  where consumed_at is null;

alter table widget_booking_verifications enable row level security;
