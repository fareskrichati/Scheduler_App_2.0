# Daily Planner iPhone Widgets

## Install

1. Install **Scriptable** from the App Store.
2. Move `scriptable/DailyPlannerWidget.js` to your iPhone using iCloud Drive, AirDrop, or copy and paste it into a new Scriptable script named `DailyPlannerWidget`.
3. Open the script once inside Scriptable.
4. Tap **Connect account** and use the same email and password as Daily Planner.
5. Long-press the iPhone Home Screen, tap **+**, choose **Scriptable**, and select a widget size.
6. Edit the new widget and choose `DailyPlannerWidget` as its script.

## Widget views

Set **Parameter** while editing the widget:

- `today` shows today's combined schedule.
- `classes` shows upcoming classes.
- `homework` shows upcoming incomplete homework.
- `events` shows events, exams, and reminders.

Add several Scriptable widgets with different parameters to keep separate views on the Home Screen. The widget refreshes every 15 minutes and uses its last cached data when offline.

## Privacy

The script signs into Supabase under the existing row-level security rules. The Supabase session is stored in iPhone Keychain. The password is used only during sign-in and is not saved by the script.
