# English website

The application serves the English website at `/en`. It retains the October 11 sample design and all 100 existing article adaptations. The shared appointment system serves `/en/booking` and `/en/manage-booking`; `/en/book` redirects to that flow through its own request-dynamic route, preserving practitioner/clinic/visit-type/source parameters. Keep this query-reading alias separate from the static content renderer. This website adds no booking backend or patient database.

## One maintained English edition

**Maintain English content in this repository.** `content/english/site.json` is the English edition source after migration. The original `/Users/chetchung/EdenClinicStudio/website/english-preview` folder is a frozen design and migration reference; routine changes do not require editing it, running Python or keeping two websites synchronized.

WordPress remains the Chinese article source of record. The prepared English adaptations retain original WordPress IDs, URLs and source snapshot dates. They are not live translations. Every article links to its Chinese original. This integration does not create or modify WordPress content.

- `content/english/site.json`: article bodies, titles, source IDs/URLs, revision dates, artwork metadata, service/team translations and the about/fees/first-visit brochure fragments.
- `content/english/site.ts`: content access and current shared clinic/doctor facts.
- `components/english/EnglishHomepage.tsx`: homepage copy and layout; repeated journal, practitioner and clinic sections use the same content records as the rest of the site.
- `components/english/`: shared navigation, article cards/body, practitioner cards and journal search/filter/pagination.
- `app/en/`: routes, metadata and website styles. Sample CSS lives under `:where(.eden-english)` in Tailwind’s `components` layer, allowing shared booking utility classes to retain their intended colors and typography. Keep layout adjustments scoped here.
- `public/english/assets/`: public images, existing SVG/PNG article artwork and fonts. Source archives, GSC evidence and internal reports are excluded.

## Routine article or page changes

1. Find the existing article by original WordPress `id` in `content/english/site.json`. For a Chinese source change, retrieve only the affected IDs through `EdenClinicStudio/seo/site-index/README.md` and reconcile the English edition.
2. Edit the English record in this repository. Preserve its ID/slug and original source URL. Set `metadata.modified` to the actual English revision date; do not infer a medical-review date. Change source snapshot information only when that source was actually refreshed.
3. Edit shared page copy in its corresponding JSON page/service/team record or the homepage component. Add new public media under `public/english/assets/` and update the affected artwork path/alt text.
4. Run the content checks, affected browser checks and normal application checks below. Deliver using the repository’s authorized deployment workflow.

Clinic names, telephone/WhatsApp contacts, map links and booking IDs resolve from `shared/clinic-data.ts`. English address/hours translations record the exact shared source facts they translate. If shared address/hours change, the current shared text appears until the English translation is refreshed in `site.json`. WhatsApp remains a separate text-contact link. Availability and appointment details come from the existing booking application.

## Migration/refresh utility

`scripts/english/import-preview.py` is an explicit migration tool, not a normal editing or publishing step. It reads the frozen prepared sample, copies public media, converts content and scopes its CSS. It requires Python `beautifulsoup4` and the repository's Node/PostCSS runtime.

When `site.json` already exists, the importer refuses to replace it without `--replace-existing`. An intentional refresh saves the complete existing snapshot to `output/english-import-backups/site-<UTC timestamp>.json` before replacement:

```sh
python3 scripts/english/import-preview.py --source /path/to/frozen/english-preview --replace-existing
```

Compare the imported result with the backup and reconcile newer repository edits before accepting the refresh. Do not run it as part of routine builds or deployment.

## Local verification and publication state

```sh
node --import tsx --test tests/english-site-content.test.ts
node scripts/english/verify-site.mjs http://127.0.0.1:3128
npm run typecheck
npm run lint
npm run build
```

The rendered check reads every maintained content page, the booking redirect, a missing-page response and referenced English images. It does not submit appointments or invoke booking APIs. Browser checks cover journal pagination/reload, full-text search including later pages, topic filtering, mobile navigation and practitioner/clinic booking preselection. The current content test records the migrated set of 100 editions; intentional additions or source withdrawals should update that coverage expectation with the content change.

The confirmed single public English edition is `https://www.edenclinic.hk/en`. The default build remains `noindex,nofollow`, has no public canonical, and emits an empty `/en/sitemap.xml`. To activate publication, set the server build environment variable `EDEN_ENGLISH_PUBLICATION=published` on the production deployment and rebuild. Unset it and rebuild to return to preview indexing. Vercel `preview` and `development` deployments always retain preview metadata even if the publication variable is copied.

Published content declares its own `www.edenclinic.hk/en` canonical, English social URL, and an English/Traditional Chinese language pair where the existing route has a known Chinese original. The English sitemap includes every maintained content route, excludes the `/en/book` redirect and appointment flows, and uses the recorded English revision dates for articles. Booking and booking management retain `noindex,nofollow`. The application robots file advertises the English sitemap in published mode. The WordPress origin must also serve the new `/en` routes, `/en/sitemap.xml` and `/english/assets/`, advertise that sitemap from its root robots file, and retire or redirect the replaced English URLs. Reciprocal Chinese-side language annotations require a separate WordPress update; metadata here does not establish that update.

Run `node --import tsx --test tests/english-publication.test.ts` for both indexing contracts. For a local server built with publication enabled, run `node scripts/english/verify-site.mjs http://127.0.0.1:3128 --published`; omit the flag for a default preview build. Activation and local verification do not establish live publication or clinical review.
