# Integration TODO List

This guide outlines the remaining tasks for an AI agent to complete the integration of the Booking System into the Chatbot.

## 1. Environment Setup
- [ ] Create `.env` file based on `.env.example` (need to create example first)
- [ ] Ensure all Google API credentials (Client ID, Secret, Refresh Token) are valid
- [ ] Ensure `DATABASE_URL` is set for Neon DB

## 2. Testing API Routes
- [ ] Test `POST /api/availability` with Postman or curl to ensure it returns slots
- [ ] Test `POST /api/booking` to verify it creates a Google Calendar event and sends an email

## 3. Completing ChatWidget Flow
The `ChatWidget.tsx` currently has a `TODO` comment in the `handleOptionSelect` function. You need to implement the following state machine:

1. **Clinic Selection**:
   - After selecting a doctor, ask user to choose a clinic (if the doctor works at multiple).
   - Use `doctorSchedules` or `CALENDAR_MAPPINGS` to filter available clinics.

2. **Date Selection**:
   - Present a simple way to select a date (e.g., "Next Monday", "Next Tuesday", or a list of upcoming available dates).
   - Call `/api/availability` for the selected date.

3. **Time Selection**:
   - Display the slots returned from the API as clickable chips.
   - Handle "No slots available" case.

4. **Patient Info Collection**:
   - Reuse the existing `formFlow` but map the data to the `BookingRequest` type.

5. **Confirmation**:
   - Show a summary of the booking (Doctor, Clinic, Time).
   - specific call `/api/booking` upon confirmation.
   - Show success message / booking ID.

## 4. UI/UX Refinement
- [ ] Add loading states when fetching availability.
- [ ] improved error handling (e.g., if API fails).
- [ ] Consider adding a "Reschedule" link in the Chatbot if possible.

## 5. Deployment
- [ ] Run `npm run build` to ensure no type errors.
- [ ] Deploy to Vercel.
