# Poster Checklist

## Before Editing

- Confirm the full-resolution source file path.
- Confirm doctor id, doctor name, month/effective date, and booking URL.
- Fetch the live schedule with `scripts/fetch_doctor_schedule.py`.
- Write down the final weekly timetable before touching pixels.

## Editing Rules

- Preserve original card shapes, frames, shadows, line weights, fonts, and spacing.
- Patch from existing poster artwork where possible.
- Do not redraw all cards unless the source artwork is unusable.
- Do not stretch clinic/rest text. If resizing a rest card, replace the `休息` mark with a normal-proportion copy.
- Keep QR replacement clean; remove old QR artifacts and stray lines.

## Clinic Color Rules

- Use a related natural palette, not unrelated high-contrast colors.
- Jordan should not remain far away from the other clinics; prefer muted olive/gold-green rather than strong brown.
- Central should be visibly different from Tsuen Wan; prefer blue-teal rather than plain green.
- Tsuen Wan should stay leaf green.
- Compare a crop showing all clinic colors at small size before finalizing.

## Final QA

- Validate QR output and quote the detected URL.
- View full poster and close crops for changed cells.
- Check: doctor name, title, month, weekdays, all clinic names, all times, rest cells, holiday note, QR label.
- Save the final output with doctor/month/version in the filename.
