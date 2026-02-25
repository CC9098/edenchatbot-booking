-- Expand chat type checks to align with app-side ConstitutionType
-- so session upserts and request logs do not fail for mixed/unknown users.

alter table if exists public.chat_sessions
  drop constraint if exists chat_sessions_type_check;

alter table if exists public.chat_sessions
  add constraint chat_sessions_type_check
  check (
    type = any (
      array[
        'depleting'::text,
        'crossing'::text,
        'hoarding'::text,
        'mixed'::text,
        'unknown'::text
      ]
    )
  );

alter table if exists public.chat_request_logs
  drop constraint if exists chat_request_logs_type_check;

alter table if exists public.chat_request_logs
  add constraint chat_request_logs_type_check
  check (
    type = any (
      array[
        'depleting'::text,
        'crossing'::text,
        'hoarding'::text,
        'mixed'::text,
        'unknown'::text
      ]
    )
  );
