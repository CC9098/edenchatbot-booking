# English booking maintenance

English pages reuse the existing booking and management components at `/en/booking` and `/en/manage-booking`. Existing `/booking?lang=en` and `/manage-booking?lang=en` inputs remain supported. Chinese stays the default; option IDs, patient text, authorization and availability rules are shared.

## Change once

- Patient labels and display formatting: `shared/booking-locale.ts`. Add translations when adding a visible booking label; never translate stored option IDs or patient-entered text.
- Clinic and practitioner identities: `shared/clinic-data.ts`. Translation helpers resolve these shared records. Practitioners with the same English name retain their Chinese identity alongside it.
- Booking behavior: existing `BookingTabFlow`, `ManageBookingFlow` and booking APIs. Do not create a separate English booking backend.
- English message copy: `lib/whatsapp-booking.ts` and `lib/whatsapp-manage.ts`; original Chinese branches remain unchanged.
- Patient language: `booking_intake.booking_payload.locale` and Google Calendar private metadata `locale`. No schema migration is required. Reminder candidates read the same language and pass it to the existing sender. Missing language means Chinese for older bookings.
- Links: `lib/public-url.ts` generates English booking/management URLs while preserving signed tokens. Tokens do not grant additional permissions based on language.

## WhatsApp delivery

The sender selects approved English variants for English bookings. Existing Chinese template selection is preserved. English message text works through the existing permitted text-message path; outside that window, delivery requires an approved English Meta template in the configured Chatwoot WhatsApp inbox.

Recognized English templates use the existing purpose name with an English language, or the same name suffixed `_en`. A differently named approved template can be selected with the corresponding `CHATWOOT_WHATSAPP_*_TEMPLATE_NAME_EN` environment variable (`TEMPLATE_NAME_EN` for the standard confirmation; `ONLINE`, `REMINDER`, `MANAGE_LINK`, `OTP`, `CANCEL`, or `RESCHEDULE` for other purposes). Existing template parameter/button contracts still apply. The code never substitutes a Chinese template for an English notification.

This task verified English message generation, approved-template selection and simulated delivery responses locally. The local runtime has no Chatwoot credentials for inspecting live approved templates, and no patient notification was sent. Verify the actual approved English templates and delivery with an authorized test identity before claiming live English notification delivery. A notification failure must remain separate from a successful appointment.

## Checks

`tests/booking-english-notifications.test.ts` covers message text, names, parameter preservation, English management URLs, approved template selection, mocked sender delivery and language persistence into reminder payloads. Existing WhatsApp, reminder and calendar unit tests protect Chinese behavior. Browser verification must cover booking and management in both languages with mutation APIs intercepted unless a real test booking is explicitly authorized.

The English website maintenance guide is `docs/ENGLISH_WEBSITE.md`. Local validation, Git delivery and production deployment are separate evidence states.
