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
