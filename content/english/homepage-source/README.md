# English homepage source

The English `/en` homepage uses the current Chinese homepage, WordPress page 35890, captured on 2026-10-28. The source inputs are decoded `vc_raw_html` and `vc_raw_js` blocks from the authenticated WordPress read. They contain public content only.

- `wordpress-homepage.html`: original markup, scoped CSS and JSON-LD.
- `wordpress-runtime.html`: original interactive runtime and its external Lenis reference.
- `../../../../scripts/import-english-homepage.py`: translations and narrow integration transformations.

Run `python3 scripts/import-english-homepage.py` from the repository root after replacing the two source inputs or changing a translation. It rebuilds `content/english/homepage.ts`, `app/en/homepage.css`, and `public/english/homepage/runtime.js`. BeautifulSoup4 is required for this local maintenance command; production has no Python dependency.

The generated page retains the source layout, colors, reception photos, calligraphy, treatment aims, booking tiles, practitioner selection, earliest consultation list, journal topic cards and clinic footer. English text needs a few font-size and spacing adaptations. Existing English pages retain their separate styles; those styles are excluded from this homepage to prevent selector collisions.

Booking links use `/en/booking`, `lang=en`, and the selected doctor, clinic and date. The schedule continues reading the same canonical production endpoint as the Chinese homepage. Its current embedded fallback includes the 29 October staff activity closure. On localhost the canonical endpoint's existing CORS policy blocks refresh; the source fallback still renders. On the app production origin the request is same-origin. Available appointment slots are confirmed by the existing booking flow.

Journal entries and search use the English catalogue. Latest-news responses appear only when explicitly marked as English. The original feeds must never insert untranslated Chinese posts or notices into the English page.

`public/english/homepage/lenis.min.js` is the same Lenis 1.1.13 release referenced by the Chinese source. The original fourteen ink image/timemap PNGs are copied into `public/english/homepage/ink/` so canvas pixel reads work across the WordPress/application origins. The importer maps their URLs to these same-origin copies; retain them when refreshing source. WordPress reception and portrait images remain at their original public URLs.

The runtime is initialized by `EnglishHomepageRuntime.tsx`. Its disposer aborts event listeners and requests, cancels timers and animation frames, disconnects observers, destroys Lenis and restores its global hooks. All event listeners, including element listeners, use the lifecycle signal so React StrictMode or a changed HTML prop can reinitialize the same root without duplicate handlers.
