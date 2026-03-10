# AI Data Lookup

Last updated: 2026-03-11

This file records how future AI chats should check live data in this project, especially timetable and clinic-ops data.

## 1) Timetable source of truth

- Live doctor timetable data is stored in Supabase tables `doctor_schedules` and `holidays`.
- Read path: `lib/doctor-schedule-store.ts` uses `createServiceClient()` from `lib/supabase.ts`.
- Fallback path: if Supabase has no active rows or query fails, the app falls back to `shared/schedule-config.ts`.
- Treat `shared/schedule-config.ts` as fallback only, not the normal source of truth.

## 2) Where timetable data is used

- Staff admin: `/doctor/timetable`
- WordPress/embed timetable page: `/embed/timetable`
- Public schedule API: `GET /api/public/bookable-schedules`
- Real availability API: `POST /api/availability`
- Booking flow and reschedule flow both depend on the same schedule chain

## 3) How to check schedule data quickly

When a user asks where doctor hours or clinic timetable data comes from, check in this order:

1. Supabase `doctor_schedules`
2. Supabase `holidays`
3. `lib/doctor-schedule-store.ts` to confirm load/fallback behavior
4. `shared/schedule-config.ts` only if Supabase is empty or failing

Useful code entry points:

- `lib/doctor-schedule-store.ts`
- `lib/public-timetable-data-server.ts`
- `lib/bookable-schedule-data-server.ts`
- `app/api/doctor/timetable/route.ts`
- `app/api/public/bookable-schedules/route.ts`
- `app/api/availability/route.ts`

## 4) How staff can edit the data

- Staff-facing admin page: `/doctor/timetable`
- Fixed weekly schedule edits write to `doctor_schedules`
- Holiday / closure edits write to `holidays`

If a user says nurses or assistants should not keep editing static cards manually, point them to `/doctor/timetable` and `/embed/timetable`.

## 5) Railway database rule

If someone pastes a database URL like:

`postgresql://...@postgres.railway.internal:5432/...`

that host is Railway private-network only.

Meaning:

- it may work from inside Railway services
- it usually does not work from an external machine or local terminal

So future AI chats should not assume that a pasted `*.railway.internal` URL is directly reachable.

Ask for one of these instead:

1. a public/external Postgres connection string
2. a Railway shell / SQL console result
3. Supabase dashboard / SQL Editor access

## 6) FRONTEND_URL rule

- `FRONTEND_URL` is a public website URL
- it is not a database URL
- Railway's yellow warning/info icon beside `FRONTEND_URL` is usually advisory, not a fatal error

## 7) Practical answers to common questions

If asked "Where does the WordPress timetable get its data from?"

- answer: Supabase `doctor_schedules` and `holidays`, rendered through `/embed/timetable`, with static fallback in `shared/schedule-config.ts`

If asked "Can you check the Railway database now?"

- answer: only if the connection string is externally reachable; `*.railway.internal` alone is not enough from outside Railway

If asked "Where should staff change doctor leave / annual leave?"

- answer: `/doctor/timetable` or directly in Supabase `holidays`
