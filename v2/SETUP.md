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

Study imports `.txt`/`.md` files up to 1 MB each, or pasted text. Numbered homework questions become a selectable bank; optional `Answer:` lines become a review key. Sets shuffle source questions; they do not generate new AI variations or auto-grade. Plans use local topic and keyword rules. Native PDF, Word, photo/OCR extraction is not included.

Address controls include Send to Tesla. It invokes navigator.share with the address and a Google Maps destination URL; the user selects Tesla from the device share menu. Unsupported or failed shares show a copy-address/map-link dialog. Cancelled shares stay quiet, and the app does not claim that a destination reached the car. Vehicle API credentials are not used. Actual delivery depends on device sharing support and the installed Tesla app.

Validation: `node --test tests/*.test.js`. Build the deployment locally with `node build-deploy.js`; this does not publish the site.
