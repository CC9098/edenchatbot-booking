# EdenChatbotBooking Agent Notes

## Scope

This repo contains multiple chat systems. Do not mix them.

If the user says only "chatbot", "AI 自動回覆", "最近歷史對話", "widget", or "database", first confirm which system they mean before analysing behavior, logs, or data.

## Brand Color Guardrail

Keep the public app and booking UI on Eden green brand tokens in `app/globals.css`.
Do not change global `--primary`, `--primary-pale`, or page backgrounds to purple/violet unless the user explicitly asks for a new full-app palette.
If a different area needs experimental styling, scope it locally instead of changing the global brand variables.

## UI Copy / Minimalism Guardrail

Default website and staff-console UI work to Steve Jobs-style minimalism: the screen should feel obvious from layout, labels, and actions, not from explanatory paragraphs.

- Visible copy must earn its place. If a busy patient, nurse, doctor, or front-desk staff member would not read it during real work, remove it.
- Prefer short action labels, real data, icons, grouping, spacing, and visual hierarchy over explanatory text.
- Avoid feature-intro copy, self-describing UI text, "how this page works" paragraphs, internal jargon, SOP/browser labels, and repeated helper text.
- For staff tools, write like an operational console: task name, current state, next action. Do not make training/onboarding pages feel like a manual unless the user explicitly asks for teaching material.
- For public patient pages, keep wording direct and confidence-building. Do not expose implementation details, backend terms, or system-generated metadata.
- Keep only text that is necessary for safety, consent, privacy, payment, medical escalation, legal clarity, form errors, or a decision the user must make now.
- Before adding any paragraph, ask: "Can this become a button label, field label, status, or be deleted?" If yes, do that instead.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
