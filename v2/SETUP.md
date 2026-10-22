# UniPlan 2.0

Open `/v2/index.html`. The deploy root now serves 2.0; a frozen 1.5.1 copy lives at `/releases/1.5.1/index.html`. Both versions use the existing Supabase project and planner records, so editing planner data affects both views. The archive preserves code, not an independent database snapshot.

Run `node build-deploy.js` for the combined deploy folder. Run `node dev-server-v2.js` for local preview on port 8796. Existing Netlify photo-import services still require their existing server environment variables. Local previews do not supply production secrets.

## Pending backend activation

No new database objects or edge functions have been deployed. Automatic Canvas import is unavailable until this setup is approved and applied. Manual review retains the existing Canvas import service.

1. Apply `supabase-setup.sql` to project `mgvahslbxdskzhiwxxod`. This adds only the private per-user preference table and its row-level security policies.
2. Deploy `../supabase/functions/uniplan-canvas-v2/index.ts` and `canvas-core.mjs` as `uniplan-canvas-v2`. Use `verify_jwt=false`: the handler explicitly validates user bearer tokens via Supabase Auth and independently checks the scheduler secret. Never remove these checks.
3. Generate a strong random `UNIPLAN_CRON_SECRET`; configure it as an Edge Function secret and store the same value in Supabase Vault as `uniplan_v2_cron_secret`. Never commit it or expose it to browser code.
4. Enable pg_cron and pg_net, then apply `supabase-scheduler.sql`. It dispatches hourly; the handler processes only opted-in users whose next check is due, setting their next check three days later.
5. Verify two real accounts cannot read/update each other's preference rows, manual mode is excluded from background checks, and a real opted-in Canvas feed imports once without changing completed items. Confirm cron logs and next-check timestamps.

The background worker adds new items only. Planner updates use optimistic concurrency checks to retain concurrent changes. The old 1.5.1 client's existing save behavior is preserved, so avoid editing both versions simultaneously.

## Verification

`node --test tests/*.test.js`: archive integrity, current planner tests, data merge, Canvas parsing/deduplication/timezones and endpoint authentication. Browser checks use a separate local fixture server, never actual user records. Real-account authentication and production import services require final live validation.

## Study workspace and Tesla destinations

Study is in the desktop sidebar and mobile More menu. Its embedded workspace uses the current account's class names and saves notes, exam focus, homework questions, responses, and progress in browser localStorage, scoped by account and class name. These materials do not sync to the planner database. Renaming a class creates a new study space; the prior class-name key remains in browser storage. The standalone study-mockup folder remains separate.

Study imports `.pdf`/`.txt`/`.md` files up to 20 MB each, or pasted text. PDF.js 6.4.299 is bundled locally with worker, CMaps, and standard font data. Text PDFs are extracted in the browser (up to 150 pages / 600,000 characters); scanned PDFs without a text layer require OCR first. Numbered homework questions become a selectable bank; optional `Answer:` lines become a review key. Sets shuffle source questions; they do not generate new AI variations or auto-grade. Plans use local topic and keyword rules. Word and photo/OCR extraction is not included.

Address controls include Send to Tesla. It invokes navigator.share with the address and a Google Maps destination URL; the user selects Tesla from the device share menu. Unsupported or failed shares show a copy-address/map-link dialog. Cancelled shares stay quiet, and the app does not claim that a destination reached the car. Vehicle API credentials are not used. Actual delivery depends on device sharing support and the installed Tesla app.

Validation: `node --test tests/*.test.js`. Build the deployment locally with `node build-deploy.js`; this does not publish the site.

The tutorial is a non-modal 17-feature guide, with visible target outlines, real-control interaction feedback, jump navigation, and an optional Next action. Study uses a single page scroll and a content-sized iframe; input fonts stay at 16px on phones to prevent focus zoom.

## Handwriting recognition in Study

Enable **Read handwriting with AI** before uploading a Goodnotes/scanned PDF or a JPG/PNG/WebP photo. This is opt-in for each open Study session; the choice is not persisted. PDF pages in the selected range (at most 10 per file) render to JPEGs up to 1800px on the long side and are transcribed one page at a time. Standard text-PDF reading stays local. Handwriting images are sent to OpenAI through `/.netlify/functions/study-handwriting`; the function sets `store:false` and does not log or save images. Review recognized text and `[unclear]` markers, especially equations, before studying from it. No automatic solutions are generated.

Hosting must provide `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`). `OPENAI_STUDY_OCR_MODEL` optionally overrides the default `gpt-5.4-mini`. The function checks the access token against Supabase Auth before contacting OpenAI. The parent app handles session refresh and the request; the iframe never receives access tokens. A local fixture cannot perform real recognition. Deploy the Netlify function with these variables to activate live transcription.

## iPad layout

Touch devices through 1366 CSS pixels use the iPhone layout, including bottom navigation, single-column panels, mobile calendar behavior, and compact Study controls. This covers iPad portrait and landscape, including Split View. Fine-pointer desktop/laptop screens retain the desktop layout.
