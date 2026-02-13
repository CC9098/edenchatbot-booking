# EdenChatbotBooking Architecture

This project integrates the **Eden Chatbot** (Next.js frontend) with the **ClinicBookingFlow** (Express backend logic) into a single **Next.js 14** application.

## 🏗️ Project Structure

```
EdenChatbotBooking/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes (Backend Logic)
│   │   ├── chat/               # Gemini AI Chat Endpoint
│   │   ├── availability/       # [NEW] Check doctor availability
│   │   └── booking/            # [NEW] Create Google Calendar booking
│   ├── components/             # React Components
│   │   └── ChatWidget.tsx      # Main Chatbot Logic (Refactored)
│   └── page.tsx                # Landing Page
│
├── lib/                        # Backend Library Code (Migrated from Express)
│   ├── db.ts                   # Drizzle ORM Database Connection
│   ├── google-auth.ts          # Google API Authentication
│   ├── google-calendar.ts      # Google Calendar Helpers provided
│   ├── gmail.ts                # Gmail Sending Logic
│   ├── storage.ts              # Database Storage Interface
│   ├── storage-helpers.ts      # [NEW] Helper to switch between DB and Static Config
│   └── booking-helpers.ts      # [NEW] Booking logic (holiday checks, slot calc)
│
├── shared/                     # Shared Types & Config
│   ├── schema.ts               # Database Schema (Drizzle)
│   ├── schedule-config.ts      # Static Doctor Schedules
│   └── types.ts                # [NEW] API Request/Response Interfaces
│
└── public/                     # Static Assets
```

## 🔌 API Integration

The project replaces the standalone Express backend with Next.js **Route Handlers** (`app/api/*`).

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/chat` | POST | Gemini AI Chat | `{ message: string }` |
| `/api/availability` | POST | Check slots | `{ doctorId, clinicId, date }` |
| `/api/booking` | POST | Create booking | `{ doctorId, clinicId, date, time, patientName... }` |

## 🛠️ Key Technologies

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Neon (PostgreSQL) + Drizzle ORM
- **AI**: Google Gemini Pro
- **Integrations**: Google Calendar API, Gmail API
- **Styling**: Tailwind CSS + Framer Motion
