# iOS TestFlight Test Log

Last updated: 2026-02-19
Project: EdenChatbotBooking
App Name (current): Eden Flow
Bundle ID: com.cc9098.edenchatbotbooking

## Current Status

- Capacitor iOS shell created and synced.
- App successfully archived and uploaded to App Store Connect.
- TestFlight build available: `1.0.0 (1)`.
- Internal testing started on iPhone.

## Baseline Configuration

- Web URL in app shell: `https://edenchatbot-booking.vercel.app/`
- iOS project path: `ios/App/App.xcodeproj`
- Signing mode used for archive: Manual (App Store profile + Apple Distribution)

## Test Checklist (Mobile)

- [ ] Launch app from TestFlight install
- [ ] Login flow (email)
- [ ] Login flow (Google)
- [ ] Chatbot basic conversation flow
- [ ] Booking slot selection
- [ ] Booking confirmation page
- [ ] Confirmation email received
- [ ] Cancel booking flow
- [ ] Reschedule flow
- [ ] Logout + relogin
- [ ] UI layout check on small screen
- [ ] UI layout check on large screen
- [ ] Network failure handling

## Bug Log

| Date | Build | Device | Area | Severity | Repro Steps | Expected | Actual | Status | Owner |
|---|---|---|---|---|---|---|---|---|---|
| 2026-02-20 | 1.0.0 (1) | iPhone (TestFlight) | Google OAuth | High | 1) Open app 2) Tap Google login 3) Complete account selection | Stay in app auth flow and return to chat logged-in state | Redirect jumps to external browser (Chrome), then app session is not always resumed | In Progress (native OAuth callback fix implemented) | AI + CC9098 |
| 2026-02-20 | 1.0.0 (1) | iPhone (TestFlight) | Auth Redirect | High | 1) Start Google login repeatedly 2) Return from OAuth callback | One callback -> one redirect to `/chat` | Intermittent repeated redirect loop during/after callback | In Progress (callback URL + next sanitization fix implemented) | AI + CC9098 |

## Notes

- `Run on Simulator` and `Archive for TestFlight` use different signing requirements.
- For future uploads, increase `Build` number each time (e.g. 2, 3, 4...).
