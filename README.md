# EdenChatbot Booking System

Booking system backend and frontend for Eden TCM Clinic (醫天圓).

## Features
-   Chatbot Widget (Decision tree for booking/inquiry)
-   Google Calendar Integration (Availability check, Booking creation)
-   Gmail Integration (Confirmation emails)
-   Cancellation and Rescheduling Pages

## Configuration

> [!IMPORTANT]
> **Correctly setting `BASE_URL` is critical for email links and Chatwoot / WhatsApp outbound booking links to work.**

### Environment Variables (.env)

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | For AI Chatbot features |
| `DATABASE_URL` | Neon/Postgres connection string |
| `GOOGLE_CLIENT_ID` | OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 Refresh Token (offline access) |
| `BASE_URL` | **Canonical public domain of your deployed app**. Do not use preview / developer Vercel URLs |
| `CHATWOOT_BASE_URL` | Chatwoot base URL for Agent Bot callbacks. e.g. `https://chat.example.com` |
| `CHATWOOT_API_ACCESS_TOKEN` | Chatwoot API access token used to send bot replies and update conversation attributes |
| `CHATWOOT_ACCOUNT_ID` | Optional. Chatwoot account ID for outbound WhatsApp confirmations. If omitted, the app will try to infer it from `/api/v1/profile` |
| `CHATWOOT_WHATSAPP_INBOX_ID` | Optional. WhatsApp inbox ID to use for booking confirmations. Required if your Chatwoot account has multiple WhatsApp inboxes that cannot be auto-matched by clinic number |
| `CHATWOOT_WHATSAPP_TEMPLATE_NAME` | Approved WhatsApp template name used for new outbound booking confirmations |
| `CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE` | Optional. WhatsApp template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY` | Optional. WhatsApp template category, defaults to `UTILITY` |
| `CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_NAME` | Approved WhatsApp template name used for proactive staff follow-up messages. Required when the patient has not replied recently |
| `CHATWOOT_WHATSAPP_STAFF_FOLLOW_UP_TEMPLATE_LANGUAGE` | Optional but recommended. Staff follow-up template language, use `zh_HK` for the current Eden template |
| `CHATWOOT_WHATSAPP_DOCTOR_ONLINE_READY_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used to notify doctors when a patient opens the online consultation page. Defaults to `doctor_online_consult_ready` |
| `DOCTOR_NOTIFICATION_WHATSAPP_CHEUNG` | Optional. WhatsApp number for 張天慧醫師 online-consult ready notifications. Defaults to `+85260260716` in the app fallback |
| `CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used for 24-hour reminder messages |
| `CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_LANGUAGE` | Optional. 24-hour reminder template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_CATEGORY` | Optional. 24-hour reminder template category, defaults to `UTILITY` |
| `CHATWOOT_WHATSAPP_OTP_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used for booking-management OTP verification codes |
| `CHATWOOT_WHATSAPP_OTP_TEMPLATE_LANGUAGE` | Optional. OTP template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_OTP_TEMPLATE_CATEGORY` | Optional. OTP template category, defaults to `UTILITY` |
| `CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used for booking-management magic links |
| `CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE` | Optional. Manage-link template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY` | Optional. Manage-link template category, defaults to `UTILITY` |
| `CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used for cancellation messages. Can temporarily point to existing Meta template `appointment_cancel` |
| `CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_LANGUAGE` | Optional. Cancellation template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_CANCEL_TEMPLATE_CATEGORY` | Optional. Cancellation template category, defaults to `UTILITY` |
| `CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_NAME` | Optional. Approved WhatsApp template name used for reschedule messages |
| `CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_LANGUAGE` | Optional. Reschedule template language, defaults to `zh_HK` |
| `CHATWOOT_WHATSAPP_RESCHEDULE_TEMPLATE_CATEGORY` | Optional. Reschedule template category, defaults to `UTILITY` |
| `CHATWOOT_DELIVERY_POLL_ATTEMPTS` | Optional. Delivery status checks after sending a Chatwoot WhatsApp message. Defaults to `4` |
| `CHATWOOT_DELIVERY_POLL_INTERVAL_MS` | Optional. Delay between delivery status checks. Defaults to `1000` |
| `CHATWOOT_WEBHOOK_SECRET` | Optional but recommended. Validates the Agent Bot webhook signature |

### URL Resolution Logic
The system determines the public URL in this order:
1.  `process.env.NEXT_PUBLIC_BASE_URL`
2.  `process.env.NEXT_PUBLIC_SITE_URL`
3.  `process.env.BASE_URL`
4.  `process.env.VERCEL_PROJECT_PRODUCTION_URL`
5.  `process.env.VERCEL_URL` only when it is already the production host
6.  Canonical production fallback: `https://edenchatbot-booking.vercel.app`

Preview / developer `*.vercel.app` deployment URLs are rejected for server-generated outbound links so patients do not receive protected preview links by mistake.

**AI Assistant Note:** Never hardcode `localhost` in email templates or redirects. Always use the `BASE_URL` environment variable logic.

## Deployment (Vercel)

1.  Connect your GitHub repository to Vercel.
2.  Add all Environment Variables in Vercel Project Settings.
3.  Deploy.
4.  **After deployment, set `BASE_URL` and `NEXT_PUBLIC_BASE_URL` to your canonical production domain, then Redeploy.** This ensures email links and Chatwoot booking links point to the correct public domain.

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

Useful check:

-   `npm run chatwoot:realtime-check`: verifies the configured Chatwoot REST API token and `/cable` WebSocket subscription. Use this when agents need a browser refresh before seeing new patient messages.

Current behavior:

-   New / uncategorized conversations reply with a fixed menu.
-   If the customer replies `1` or `一般查詢`, the conversation moves into `general_ai`.
-   Once in `general_ai`, subsequent customer messages use the same legacy `/api/chat` AI response logic as the WordPress embed widget.
