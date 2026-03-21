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
| `CHATWOOT_BASE_URL` | Chatwoot base URL for Agent Bot callbacks. e.g. `https://chat.example.com` |
| `CHATWOOT_API_ACCESS_TOKEN` | Chatwoot API access token used to send bot replies and update conversation attributes |
| `CHATWOOT_ACCOUNT_ID` | Optional. Chatwoot account ID for outbound WhatsApp confirmations. If omitted, the app will try to infer it from `/api/v1/profile` |
| `CHATWOOT_WHATSAPP_INBOX_ID` | Optional. WhatsApp inbox ID to use for booking confirmations. Required if your Chatwoot account has multiple WhatsApp inboxes that cannot be auto-matched by clinic number |
| `CHATWOOT_WHATSAPP_TEMPLATE_NAME` | Approved WhatsApp template name used for new outbound booking confirmations |
| `CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE` | Optional. WhatsApp template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY` | Optional. WhatsApp template category, defaults to `UTILITY` |
| `CHATWOOT_WEBHOOK_SECRET` | Optional but recommended. Validates the Agent Bot webhook signature |

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

## Project Structure
-   `app/api/booking`: Handles Booking creation (POST), retrieval (GET), cancellation (DELETE), rescheduling (PATCH).
-   `app/api/availability`: Handles time slot checks.
-   `app/api/chatwoot/agent-bot`: Chatwoot Agent Bot webhook for menu-based WhatsApp/general inquiry routing.
-   `app/api/articles`, `app/api/courses`: Public content APIs for educational content migration/integration.
-   `app/api/me/lesson-progress`: Unified lesson progress APIs for logged-in users.
-   `app/cancel`: Cancellation page in existing app.
-   `app/reschedule`: Rescheduling page in existing app.
-   `app/articles`, `app/courses`, `app/booking`: Unified content + booking entry routes.
-   `lib/gmail.ts`: Email generation logic.
-   `lib/google-calendar.ts`: Google Calendar API wrapper.

## Chatwoot Agent Bot

For the first-pass WhatsApp / Chatwoot flow, point the inbox Agent Bot `outgoing_url` to:

-   `POST /api/chatwoot/agent-bot`

Current behavior:

-   New / uncategorized conversations reply with a fixed menu.
-   If the customer replies `1` or `一般查詢`, the conversation moves into `general_ai`.
-   Once in `general_ai`, subsequent customer messages use the same legacy `/api/chat` AI response logic as the WordPress embed widget.
