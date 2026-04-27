# EdenChatbotBooking Agent Notes

## Scope

This repo contains multiple chat systems. Do not mix them.

If the user says only "chatbot", "AI 自動回覆", "最近歷史對話", "widget", or "database", first confirm which system they mean before analysing behavior, logs, or data.

## Brand Color Guardrail

Keep the public app and booking UI on Eden green brand tokens in `app/globals.css`.
Do not change global `--primary`, `--primary-pale`, or page backgrounds to purple/violet unless the user explicitly asks for a new full-app palette.
If a different area needs experimental styling, scope it locally instead of changing the global brand variables.

## Chat Systems

### 1) WordPress widget 客服 bot
- UI: `components/ChatWidget.tsx`
- API: `app/api/chat/route.ts`
- LLM logic: `lib/legacy-chat-response.ts`
- Trigger: in the widget, entering `其他問題` turns on `aiMode`, and each free-text message is sent to `/api/chat`
- Data reality: this flow is **not logged into** `public.chat_sessions`, `public.chat_messages`, or `public.chat_request_logs` by default
- Only partial signal in project DB: `public.message_feedback` with `source = 'widget_v1'` if a user explicitly clicks thumbs up/down
- Therefore: do not claim you verified recent widget history from Supabase unless `widget_v1` feedback or another explicit logging source exists

### 2) 養生bot / Chat v2
- UI: `components/chat-v2/ChatRoom.tsx`
- API: `app/api/chat/v2/route.ts`
- Purpose: multi-turn health / booking assistant with G1, G2, G3, B modes
- Project DB source of truth:
  - `public.chat_sessions`
  - `public.chat_messages`
  - `public.chat_request_logs`
  - `public.message_feedback` with `source = 'chat_v2'`
- Use these tables when the user asks about recent history, routing mistakes, booking mode, or AI answer quality for the 養生bot

### 3) Chatwoot / WhatsApp bot
- Webhook: `app/api/chatwoot/agent-bot/route.ts`
- Helper: `lib/chatwoot-agent-bot.ts`
- Purpose: Chatwoot / WhatsApp menu flow and AI handoff
- Data reality: recent message history usually lives in the **Chatwoot PostgreSQL** (`conversations`, `messages`), not this project's Supabase chat tables
- Therefore: do not say Chatwoot history was verified from Supabase unless a separate sync layer is explicitly present

## Required Answering Rule

Before presenting findings, explicitly state which system you are analysing:
- `WordPress widget 客服 bot`
- `養生bot / chat v2`
- `Chatwoot / WhatsApp bot`

If the user asks for "recent history" or "database evidence", name the actual database you are using:
- project Supabase
- Chatwoot PostgreSQL
- no reliable DB log available
