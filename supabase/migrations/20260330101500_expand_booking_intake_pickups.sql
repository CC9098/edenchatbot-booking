alter table booking_intake
  drop constraint if exists booking_intake_medication_pickup_check;

alter table booking_intake
  add constraint booking_intake_medication_pickup_check
  check (
    medication_pickup in (
      'none',
      'lalamove',
      'sfexpress',
      'clinic_pickup',
      'overseas_shipping',
      'central_pickup',
      'jordan_pickup',
      'tsuenwan_pickup'
    )
  );
