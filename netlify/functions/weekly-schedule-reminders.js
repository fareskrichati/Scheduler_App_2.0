exports.handler = async function handler() {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  if (required.some((name) => !process.env[name])) return { statusCode: 503, body: "Reminder backend is not configured." };
  const profiles = await supabaseRequest("/rest/v1/planner_profiles?select=user_id,profile,data&limit=1000");
  const states = await supabaseRequest("/rest/v1/planner_reminder_delivery?select=user_id,reminder_type,last_sent_key&limit=5000").catch(() => []);
  const stateMap = new Map(states.map((state) => [`${state.user_id}:${state.reminder_type}`, state.last_sent_key]));
  let sent = 0;
  for (const row of profiles) {
    const settings = row.data?.settings || {};
    const reminder = settings.notificationSchedule?.weeklyScheduleReminder;
    if (!reminder?.enabled || !isReminderTime(reminder)) continue;
    const dateKey = localDateKey(reminder.timezone || "UTC");
    const email = settings.email || row.profile?.email || "";
    const phone = settings.phone || row.profile?.phone || "";
    const name = settings.name || row.profile?.name || "there";
    const plannerUrl = process.env.PLANNER_PUBLIC_URL || "";
    if (["email", "both"].includes(reminder.delivery) && email && stateMap.get(`${row.user_id}:weekly-schedule-email`) !== dateKey) {
      try { await sendEmail(email, name, plannerUrl); await saveDeliveryState(row.user_id, "weekly-schedule-email", dateKey); sent += 1; }
      catch (error) { console.error(`Weekly email failed for ${row.user_id}:`, error.message); }
    }
    if (["text", "both"].includes(reminder.delivery) && phone && stateMap.get(`${row.user_id}:weekly-schedule-text`) !== dateKey) {
      try { await sendText(phone, plannerUrl); await saveDeliveryState(row.user_id, "weekly-schedule-text", dateKey); sent += 1; }
      catch (error) { console.error(`Weekly text failed for ${row.user_id}:`, error.message); }
    }
  }
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};

function isReminderTime(reminder) {
  const parts = zonedParts(reminder.timezone || "UTC");
  const [hour, minute] = String(reminder.time || "18:00").split(":").map(Number);
  return parts.day === Number(reminder.day || 0) && parts.hour === hour && Math.floor(parts.minute / 15) === Math.floor(minute / 15);
}

function zonedParts(timeZone) {
  let formatter;
  try { formatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  catch (_) { formatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); }
  const values = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { day: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[values.weekday], year: values.year, month: values.month, date: values.day, hour: Number(values.hour), minute: Number(values.minute) };
}

function localDateKey(timeZone) { const parts = zonedParts(timeZone); return `${parts.year}-${parts.month}-${parts.date}`; }

async function sendEmail(to, name, plannerUrl) {
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_EMAIL_FROM) throw new Error("Email reminders are not configured.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "DailyPlanner/1.0", "Idempotency-Key": `weekly-${to}-${new Date().toISOString().slice(0, 10)}` }, body: JSON.stringify({ from: process.env.REMINDER_EMAIL_FROM, to: [to], subject: "Time to review your weekly schedule", text: `Hi ${name}, take a minute to review your classes and upcoming homework for the week.${plannerUrl ? ` Open your planner: ${plannerUrl}` : ""}` }) });
  if (!response.ok) throw new Error(`Email reminder failed: ${await response.text()}`);
}

async function sendText(to, plannerUrl) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Text reminders are not configured.");
  const body = new URLSearchParams({ To: to, From: from, Body: `Daily Planner: Review your classes and upcoming homework for the week.${plannerUrl ? ` ${plannerUrl}` : ""}` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error(`Text reminder failed: ${await response.text()}`);
}

async function saveDeliveryState(userId, reminderType, lastSentKey) {
  await supabaseRequest("/rest/v1/planner_reminder_delivery?on_conflict=user_id,reminder_type", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, reminder_type: reminderType, last_sent_key: lastSentKey, sent_at: new Date().toISOString() }) });
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase reminder request failed: ${await response.text()}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
