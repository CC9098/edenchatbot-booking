# Public GA4 tracking

The existing stream uses `NEXT_PUBLIC_GA_MEASUREMENT_ID` (production: `G-QC3YMRL1ZS`). `GoogleAnalytics` is installed in the shared root layout. New English content routes automatically use the public path/title records in `content/english/site.json`; no second tag or article-body payload is needed.

- `page_view`: one explicit event for each public route or content-language change. Query-only filters do not create extra views. `content_language` is `en` or `zh-Hant`, including `/booking?lang=en` and embedded English booking.
- `booking_completed`: existing key event, fired only after the booking API reports success. Parameters retain only public `doctor_id`, `clinic_id`, `booking_flow` and the safe page/language context. No new completion event is introduced.

URLs exclude query strings/fragments. External referrers retain only their origin; subsequent SPA referrers use the previous safe public path. Titles come from public records or fixed labels. Dynamic application article/course slugs use grouped paths. Private account, management, signed-link, staff and unknown routes do not load the tag and disable a previously loaded tag. Conversion parameters never include patient identifiers, signed tokens, contact details, form answers, symptoms or arbitrary caller data.

GA4 Admin must retain the event-scoped `content_language` custom dimension and the existing `booking_completed` key event. This implementation sets `send_page_view:false`; Enhanced measurement history-based page views must stay off to avoid duplicates. Site search/form/outbound/download auto events must remain off to avoid recording free text or raw destination URLs. WordPress keeps its existing initial page-load tracking. The built-in `language` dimension remains the browser preference and is distinct from `content_language`.

Validate with `node --import tsx --test tests/analytics.test.ts`, typecheck and build. For browser checks, inspect queued/collected page views across English/Chinese routes and query-only language changes; do not create a real appointment to test analytics. GA4 Realtime does not expose event-scoped custom parameters: distinguish network delivery of `content_language` from a bounded backend `page_view` receipt. Actual booking completion receipt requires a separately authorized real booking.
