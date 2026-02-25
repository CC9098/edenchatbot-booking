# AGENTS.md

## Cursor Cloud specific instructions

### Overview

EdenChatbotBooking is a Next.js 14 (App Router) + TypeScript full-stack app for a Traditional Chinese Medicine clinic. See `README.md` for project overview and `CLAUDE_CONTEXT.md` for AI agent quick-routing.

### Services

| Service | How to run | Notes |
|---|---|---|
| Next.js dev server | `npm run dev` (port 3000) | Core app; pages like `/booking` and `/embed` work without external credentials |
| MCP GitHub server | `npm run mcp:github` (port 3333) | Optional standalone Express server |

### External dependencies (not started locally)

Supabase, Neon PostgreSQL, Google Calendar/Gmail APIs, and Gemini AI all require real credentials. Pages that call Supabase client-side (`/`, `/login`, `/chat`) will show runtime errors without `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Static pages (`/booking`, `/embed`, `/cancel`, `/reschedule`) render without credentials.

### Key commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Build | `npm run build` |
| E2E tests | `npm run test:e2e` (requires Playwright browsers and a running deployment) |

### Non-obvious notes

- `.env.local` is the local env file (copy from `.env.example`). Next.js auto-loads it. Ensure no leading/trailing whitespace in env values — Supabase client will fail silently with malformed URLs.
- When restarting the dev server, always kill the old process first (check `lsof -ti :3000`). Next.js will silently increment to port 3001, 3002, etc. if the port is taken, causing confusion.
- After deleting `.next/`, the first few page requests may return 500 ("missing required error components") while the dev server recompiles. Wait ~10 seconds or pre-warm with `curl http://localhost:3000/booking`.
- The Playwright E2E tests target the Vercel deployment URL by default (`E2E_BASE_URL` in `.env.example`), not localhost.
- TypeScript config excludes `drizzle.config.ts` from the main tsconfig; the MCP server has its own `mcp/github-server/tsconfig.json`.
- The project uses Tailwind CSS v4 with `@tailwindcss/postcss` (not the classic `tailwindcss` PostCSS plugin).
- Verification before push: run `npm run typecheck && npm run lint` (see `CLAUDE_CONTEXT.md` section 7 for details).
- The homepage (`/`) requires Supabase credentials to render (it fetches articles/courses from Supabase server-side). The `/booking` and `/embed` pages are the safest for quick smoke-testing without external services.

### Simulating the iOS mobile app on localhost

The production iOS app is a Capacitor WebView that loads the Vercel deployment. The `PatientAppChrome` component (bottom tab bar: 問問/預約/養生/根源 + top bar) only renders when the browser user agent contains `Capacitor` (see `lib/platform.ts`). To simulate the mobile app experience locally:

```bash
google-chrome --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Capacitor/8.1.0" --window-size=430,932 "http://localhost:3000/chat"
```

This triggers the native app chrome (tab bar + route-specific top bar). The `/chat` and `/chat/symptoms` routes require Supabase auth (login gate). The `/booking` tab works without login.
