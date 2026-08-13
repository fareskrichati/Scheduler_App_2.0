# Daily Planner iPhone Widgets

## Install

1. Install **Scriptable** from the App Store.
2. Move `scriptable/DailyPlannerWidget.js` to your iPhone using iCloud Drive, AirDrop, or copy and paste it into a new Scriptable script named `DailyPlannerWidget`.
3. Open the script once inside Scriptable.
4. Tap **Connect account** and use the same email and password as Daily Planner.
5. In Daily Planner Settings, choose **Scriptable opens to** and save your widget settings. The deployed planner URL is filled automatically when Settings is saved from the live site.
6. Run `DailyPlannerWidget` in Scriptable. After the initial connection, it opens the complete planner automatically at your chosen screen.
7. Long-press the iPhone Home Screen, tap **+**, choose **Scriptable**, and select a widget size.
8. Edit the new widget and choose `DailyPlannerWidget` as its script.

## Widget views

Set **Parameter** while editing the widget:

- `today` shows today's combined schedule.
- `classes` shows upcoming classes.
- `homework` shows upcoming incomplete homework.
- `events` shows events, exams, and reminders.

Add several Scriptable widgets with different parameters to keep separate views on the Home Screen. The widget refreshes every 15 minutes and uses its last cached data when offline.

When no widget parameter is supplied, the widget uses the default view selected in Daily Planner Settings. The category toggles, upcoming range, and maximum item count also come from Daily Planner Settings. A widget parameter overrides only the default view.

## Privacy

The script signs into Supabase under the existing row-level security rules. The Supabase session is stored in iPhone Keychain. The password is used only during sign-in and is not saved by the script.

## Automatic school-calendar lookup

Configure these Netlify environment variables before deploying the backend lookup:

- `OPENAI_API_KEY` — server-side OpenAI API key; never expose it in browser JavaScript.
- `SUPABASE_URL` — the planner Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_ANON_KEY` — used by the backend to validate the signed-in user's token. If neither is set, the backend can use `SUPABASE_SERVICE_ROLE_KEY` server-side.
- `OPENAI_CALENDAR_MODEL` — optional override; defaults to `gpt-5.4-mini`.

Redeploy after saving the variables. The class importer will then search official school-controlled sources and autofill editable term dates, named breaks, confidence, and source links.

## Weekly schedule reminders

Run the latest `supabase-schema.sql`, then configure these Netlify variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PLANNER_PUBLIC_URL`
- `RESEND_API_KEY` and `REMINDER_EMAIL_FROM` for email
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` for text messages

`REMINDER_EMAIL_FROM` must use a domain verified with Resend. Text delivery must comply with Twilio messaging registration and consent requirements. The scheduled function checks every 15 minutes and sends once at the weekday, local time, timezone, and delivery method selected in Settings.
