# Final Merge Checklist (2026-02-16)

## Completed in this repo
- [x] Unified routes in one app: `/articles`, `/courses`, `/chat`, `/booking`
- [x] Content schema created in Supabase: `articles`, `courses`, `course_modules`, `course_lessons`, `user_lesson_progress`
- [x] Public content pages + detail pages are live in Next.js App Router
- [x] AI Chat v2 injects relevant in-site content references (articles/courses/lessons)
- [x] Public content APIs added:
  - `/api/articles`
  - `/api/articles/[slug]`
  - `/api/courses`
  - `/api/courses/[slug]`
- [x] Unified lesson progress APIs added:
  - `GET/POST /api/me/lesson-progress`
  - `PATCH/DELETE /api/me/lesson-progress/[lessonId]`
- [x] Single-domain strategy adopted (keep one canonical app URL only)
- [x] Seed content inserted into Supabase (2 articles, 1 course, 3 lessons)

## Still required outside code (Vercel/domain operations)
- [ ] Keep only one production URL:
  - `https://edenchatbot-booking.vercel.app/`
- [ ] Disable/remove old educational deployment URL:
  - `https://educational-platform-mocha-alpha.vercel.app/`
- [ ] Ensure `BASE_URL` in Vercel env is set to canonical URL
- [ ] Confirm OAuth callback domain list includes canonical host

## Validation checklist after deploy
- [ ] `GET /api/articles` returns items with canonical absolute URLs
- [ ] `GET /api/courses` returns items with canonical absolute URLs
- [ ] `/chat` replies include links to `/articles/*` or `/courses/*` when content is relevant
- [ ] Logged-in user can save and read lesson progress via `/api/me/lesson-progress`
- [ ] Existing booking/cancel/reschedule flows remain unaffected
