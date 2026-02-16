# EdenChatbot Booking System

Booking system backend and frontend for Eden TCM Clinic (醫天圓).

## Features
-   Chatbot Widget (Decision tree for booking/inquiry)
-   Google Calendar Integration (Availability check, Booking creation)
-   Gmail Integration (Confirmation emails)
-   Cancellation and Rescheduling Pages

## Configuration

> [!IMPORTANT]
> **Correctly setting `BASE_URL` is critical for email links to work.**

### Environment Variables (.env)

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | For AI Chatbot features |
| `DATABASE_URL` | Neon/Postgres connection string |
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 Refresh Token (offline access) |
| `BASE_URL` | **Domain of your deployed app**. e.g. `https://your-project.vercel.app` |
| `PRIMARY_HOST` | Canonical host for merged app (optional). e.g. `edenchatbot-booking.vercel.app` |
| `REDIRECT_HOSTS` | Comma-separated old hosts to 308-redirect to `PRIMARY_HOST` (optional) |

### URL Resolution Logic
The system determines the public URL in this order:
1.  `process.env.BASE_URL` (Manual override, **Recommended for Production**)
2.  `process.env.VERCEL_URL` (Automatic on Vercel)
3.  `http://localhost:3000` (Local fallback)

**AI Assistant Note:** Never hardcode `localhost` in email templates or redirects. Always use the `BASE_URL` environment variable logic.

## Deployment (Vercel)

1.  Connect your GitHub repository to Vercel.
2.  Add all Environment Variables in Vercel Project Settings.
3.  Deploy.
4.  **After deployment, copy your Vercel domain and set it as `BASE_URL` in the Environment Variables, then Redeploy.** This ensures email links point to the correct domain.
5.  (Optional) Set `PRIMARY_HOST` + `REDIRECT_HOSTS` to unify multiple domains into one canonical host.

## Project Structure
-   `app/api/booking`: Handles Booking creation (POST), retrieval (GET), cancellation (DELETE), rescheduling (PATCH).
-   `app/api/availability`: Handles time slot checks.
-   `app/api/articles`, `app/api/courses`: Public content APIs for educational content migration/integration.
-   `app/api/me/lesson-progress`: Unified lesson progress APIs for logged-in users.
-   `app/cancel`: Cancellation page in existing app.
-   `app/reschedule`: Rescheduling page in existing app.
-   `app/articles`, `app/courses`, `app/booking`: Unified content + booking entry routes.
-   `lib/gmail.ts`: Email generation logic.
-   `lib/google-calendar.ts`: Google Calendar API wrapper.
