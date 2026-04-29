---
name: eden-timetable-poster
description: Create or revise Eden TCM doctor timetable poster images from booking schedules. Use when working on doctor timetable PNG/JPG posters, monthly clinic schedules, QR booking links, clinic color balancing, or preserving the Eden timetable poster design for other doctors.
---

# Eden Timetable Poster

## Purpose

Use this skill to update Eden doctor timetable posters while preserving the original design language. Treat the existing poster as the visual source of truth for layout, typography, borders, shadows, QR placement, leaves, and logo treatment; treat the live booking schedule as the source of truth for times.

## Workflow

1. Identify the inputs:
   - Full-resolution source poster image, not a cropped screenshot.
   - Doctor id, month/effective period, doctor name/title, and booking URL.
   - Default booking URL: `https://edenchatbot-booking.vercel.app/booking?doctor=<doctorId>`.

2. Verify the timetable before editing:
   - Run `python3 scripts/fetch_doctor_schedule.py <doctorId>` from this skill folder.
   - Use the public booking API as the primary source. Do not infer new month times from an old poster.
   - Exclude `online` clinic rows from public posters unless the user explicitly asks to show online.
   - Include booking notices/holidays in the working notes and decide whether the poster needs a visible notice.

3. Preserve the poster design:
   - Prefer copy/paste from existing card regions and small glyph patches over redrawing cards from scratch.
   - Keep the original dimensions, card frame thickness, rounded corners, shadows, typography, spacing, and decorative elements.
   - If a rest card must be resized, do not vertically squash the `休息` mark. Copy a normal-proportion rest group or rebuild only that mark.
   - When replacing times, use existing poster digits/glyphs where practical so the typography stays consistent.

4. Update the QR code:
   - Generate QR with `scripts/qr_tools.swift generate <url> <out.png> [size] [label]`.
   - Paste the QR into the existing QR box as a clean replacement. Clean any old lines or artifacts above/below the QR.
   - Validate the final poster with `scripts/qr_tools.swift validate <final-poster.png>`.

5. Balance clinic colors:
   - Keep all clinic colors in the same calm natural family; avoid one clinic looking visually unrelated.
   - If showing Jordan, Central, and Tsuen Wan together, use a balanced trio:
     - Jordan: warm olive / muted gold-green.
     - Central: calm blue-teal.
     - Tsuen Wan: leaf green.
   - Keep luminance and saturation close enough that no clinic dominates. Central and Tsuen Wan must be distinguishable at thumbnail size.
   - Recolor only clinic card interiors/text/icons/dashes. Preserve card borders and global Eden green headers unless the user asks otherwise.

6. Visual QA before final:
   - View the whole poster and at least one close crop of changed areas.
   - Check the QR result prints exactly the expected URL.
   - Check all weekdays, clinic names, morning/afternoon rows, rest cells, and holiday note.
   - If the user reports a specific visual issue, patch only that area and avoid global restyling.

## Resources

- `scripts/fetch_doctor_schedule.py`: fetch and summarize the live doctor schedule.
- `scripts/qr_tools.swift`: generate a QR image and validate QR codes inside a poster image on macOS.
- `references/poster-checklist.md`: concise review checklist for future poster edits.
