-- Allow widget_booking_verifications to store login OTPs in addition to
-- manage_booking OTPs. The two purposes share the same table and TTL
-- infrastructure but are queried independently.
alter table widget_booking_verifications
  drop constraint if exists widget_booking_verifications_purpose_check;

alter table widget_booking_verifications
  add constraint widget_booking_verifications_purpose_check
    check (purpose in ('manage_booking', 'login'));
