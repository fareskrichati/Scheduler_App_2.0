# Homework and event image import setup

The planner can read screenshots through authenticated Netlify Functions. Homework images use `homework-photo-import`; event images use `event-photo-import`. Both send resized images to the OpenAI Responses API and return structured fields for review. The planner does not add anything until the user reviews and saves the detected rows.

## Supported screenshot layouts

- Canvas Grades pages with a course heading or selector, assignment rows, groups, and due dates.
- Canvas Agenda or To Do pages where one date heading applies to several rows.
- Canvas homework, discussions, quizzes, tests, midterms, finals, and exams. Submitted or completed rows are ignored when the screenshot makes that status visible.
- Free-form event schedules organized by weekdays and time ranges.
- Dated sports, club, work, meeting, practice, and activity schedules.

Keep the date heading, course name, title, and due time in the same screenshot when possible. For weekly event schedules, keep each weekday heading and all of its event lines together. You can upload up to four JPG, PNG, or WebP screenshots per import.

## Netlify environment variables

In Netlify, open **Site configuration → Environment variables** and add:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Server-only key used by both image import functions. Never put this key in browser JavaScript. |
| `SUPABASE_URL` | Yes | Supabase project URL used to verify the signed-in planner user. |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key used for authentication verification. `SUPABASE_ANON_KEY` is also accepted for an older setup. |
| `OPENAI_HOMEWORK_IMPORT_MODEL` | No | Overrides the default homework image model, `gpt-5.4-mini`. |
| `OPENAI_EVENT_IMPORT_MODEL` | No | Overrides the default event image model, `gpt-5.4-mini`. |

After changing environment variables, trigger a new Netlify deploy. The browser never receives `OPENAI_API_KEY`; calls go through the authenticated functions.

## Build and deploy

1. Run `node build-deploy.js` from the project folder.
2. Confirm these files exist:
   - `deploy/netlify/functions/homework-photo-import.js`
   - `deploy/netlify/functions/event-photo-import.js`
3. Deploy the `deploy` folder through the existing Netlify workflow, or push the project if Netlify deploys from GitHub.
4. Sign in to the planner before testing an import.

## Using it in the planner

For Canvas work, open **Homework → Import homework from Canvas screenshots**, choose up to four images, and select **Read screenshots**. The review cards let you correct the title, type, class, date, time, and color. Items marked **Exam or quiz** are saved in Exams; the others are saved in Homework.

For a private Canvas `.ics` calendar link, open **Settings → School accounts**, paste the link, and select **Check Canvas calendar**. This only prepares a review list; it does not automatically add anything. In **School import**, expand an assignment, choose Homework or Exam, confirm the matched class, fill any missing due time, and add only the items you want. Check the link again later to find new assignments or review teacher changes; changed items can update the matching planner entry while unchanged items are labeled **Already current**.

For schedules, open **Events → Import events from screenshots**. A weekday-only schedule is converted to the next occurrence of each weekday. The notes identify it as weekly so the result is clear during review. The current importer adds the reviewed occurrence; it does not silently create an entire semester of repeats.

## Test checklist

- A Canvas Grades screenshot keeps every assignment tied to the course shown in the page heading or selector.
- A Canvas Agenda screenshot carries its date heading to all rows below it until the next heading.
- Quiz, exam, midterm, and final rows appear as **Exam or quiz** during review.
- Completed/submitted rows and “Nothing Planned Yet” are not imported.
- A weekday schedule splits multiple time ranges into separate events and reads text after `@` as the location.
- Every imported item is reviewed before it changes planner data.

## Troubleshooting

- **404 / function not deployed:** rebuild and redeploy the latest `deploy` folder.
- **503 / not configured:** verify the OpenAI and Supabase environment variables, then redeploy.
- **401 / sign-in could not be verified:** sign out, sign back in, and retry.
- **No rows found:** use a sharper screenshot and include the course/date heading plus the complete rows.
- **Wrong course:** add the class to the planner first, then choose it in the review dropdown.
- **Wrong date when no year is visible:** correct the inferred year in review before saving.

## Privacy

Screenshots can contain names, grades, course IDs, and other private information. Crop or redact anything the importer does not need. Do not commit personal screenshots to Git. The planner resizes images in the browser and sends them to the backend only for recognition; this project does not save uploaded image files. Review the data-handling settings for the configured model provider before using real student records.
