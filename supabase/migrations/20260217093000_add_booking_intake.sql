-- Booking intake records for conversational booking (chat v2 B-mode).
-- Keeps structured intake fields in Supabase and links to Google Calendar event IDs.

create table if not exists booking_intake (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'chat_v2',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'failed')),
  failure_reason text,

  user_id uuid references auth.users(id) on delete set null,
  session_id text,

  google_event_id text,
  calendar_id text,

  doctor_id text not null,
  doctor_name_zh text not null,
  clinic_id text not null,
  clinic_name_zh text not null,

  appointment_date date not null,
  appointment_time text not null,
  duration_minutes integer not null default 15,

  patient_name text not null,
  phone text not null,
  email text not null,

  visit_type text not null check (visit_type in ('first', 'followup')),
  need_receipt text not null check (need_receipt in ('no', 'yes_insurance', 'yes_not_insurance')),
  medication_pickup text not null check (medication_pickup in ('none', 'lalamove', 'sfexpress', 'clinic_pickup')),

  id_card text,
  dob text,
  gender text check (gender in ('male', 'female', 'other')),
  allergies text,
  medications text,
  symptoms text,
  referral_source text,

  notes text,
  booking_payload jsonb not null default '{}'::jsonb,

  confirmed_at timestamptz,
  cancelled_at timestamptz,
  last_rescheduled_at timestamptz,
  reschedule_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_booking_intake_google_event_unique
  on booking_intake (google_event_id)
  where google_event_id is not null;

create index if not exists idx_booking_intake_user_created
  on booking_intake (user_id, created_at desc);

create index if not exists idx_booking_intake_status_date
  on booking_intake (status, appointment_date);

alter table booking_intake enable row level security;

do $$ begin
  create policy "booking_intake_select_own"
    on booking_intake for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "booking_intake_update_own"
    on booking_intake for update
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
