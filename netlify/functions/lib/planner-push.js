const { createHash } = require("node:crypto");

const minute = 60_000;
const dayMs = 1440 * minute;
const presetDays = new Map([["day", 1], ["threeDays", 3], ["week", 7]]);
const kinds = [
  { collection: "schedule", label: "Event", minutes: 15, timeField: "start" },
  { collection: "homework", label: "Homework", minutes: 60, fallback: "23:59", timeField: "time" },
  { collection: "exams", label: "Exam", minutes: 1440, fallback: "09:00", timeField: "time" },
];

function validTimezone(timezone) {
  if (typeof timezone !== "string" || timezone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function validEndpoint(endpoint) {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    const supported = [
      "fcm.googleapis.com",
      "updates.push.services.mozilla.com",
    ].includes(host) || /^[a-z0-9-]+\.push\.apple\.com$/.test(host) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
    return supported && url.protocol === "https:" && !url.port &&
      !url.username && !url.password && !url.hash && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function validSubscription(subscription) {
  return validEndpoint(subscription?.endpoint) &&
    /^B[A-Za-z0-9_-]{86}$/.test(subscription.keys?.p256dh ?? "") &&
    /^[A-Za-z0-9_-]{22}$/.test(subscription.keys?.auth ?? "");
}

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY && process.env.PUSH_VAPID_SUBJECT);
}

function supabaseBase() {
  return process.env.SUPABASE_URL.replace(/\/$/, "");
}

async function database(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${supabaseBase()}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Push storage returned ${response.status}`);
  return response.status === 204 ? null : response.json();
}

// Resolve the local planner time in its IANA timezone. If a clock change skips
// the requested time, move it forward by the gap, matching local Date behavior.
function localTimestamp(date, time, formatter) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 10) !== date) return NaN;

  const offsets = [wallTime - 24 * 60 * minute, wallTime + 24 * 60 * minute].map((sample) => {
    const parts = Object.fromEntries(formatter.formatToParts(sample).map(({ type, value }) => [type, value]));
    const wallSample = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    return wallSample - sample;
  });
  const candidates = [...new Set(offsets)].map((offset) => wallTime - offset).sort((a, b) => a - b);
  const match = candidates.find((candidate) => {
    const parts = Object.fromEntries(formatter.formatToParts(candidate).map(({ type, value }) => [type, value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === `${date}T${time}`;
  });
  return match ?? candidates.at(-1);
}

function reminderDate(day, preset) {
  if (preset !== "month") return new Date(day - presetDays.get(preset) * dayMs).toISOString().slice(0, 10);
  const date = new Date(day);
  const previousMonthEnd = new Date(day);
  previousMonthEnd.setUTCDate(0);
  previousMonthEnd.setUTCDate(Math.min(date.getUTCDate(), previousMonthEnd.getUTCDate()));
  return previousMonthEnd.toISOString().slice(0, 10);
}

function dueNotifications(data, deviceZone, now, userId) {
  const formatters = new Map();
  const due = [];
  for (const kind of kinds) {
    const items = data?.[kind.collection];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item?.id || item.status === "done" || (kind.collection === "schedule" && item.type !== "event")) continue;
      const preset = item.pushLeadPreset || (item.pushLeadMinutes === undefined && kind.collection === "exams" ? "day" : null);
      const calendarLead = preset === "month" || presetDays.has(preset);
      const lead = item.pushLeadMinutes === undefined ? kind.minutes : item.pushLeadMinutes;
      if (!calendarLead && (!Number.isInteger(lead) || lead < 0 || lead > 10080)) continue;
      // Include the largest calendar offset plus timezones on either side of UTC.
      const day = typeof item.date === "string" ? Date.parse(item.date + "T00:00:00Z") : NaN;
      const horizon = preset === "month" ? 33 : 9;
      if (!(day >= now - 2 * dayMs && day <= now + horizon * dayMs)) continue;
      const zone = item.pushTimezone || deviceZone;
      if (!formatters.has(zone)) {
        formatters.set(zone, new Intl.DateTimeFormat("en", {
          timeZone: validTimezone(zone) ? zone : deviceZone,
          year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }));
      }
      const formatter = formatters.get(zone);
      const time = item[kind.timeField] || kind.fallback;
      const scheduledAt = localTimestamp(item.date, time, formatter);
      if (!Number.isFinite(scheduledAt)) continue;
      const notifyAt = calendarLead
        ? localTimestamp(reminderDate(day, preset), time, formatter)
        : scheduledAt - lead * minute;
      if (!(notifyAt <= now && now - notifyAt < 60 * minute)) continue;
      if (notifyAt < scheduledAt && now >= scheduledAt) continue;
      const key = createHash("sha256").update(JSON.stringify([
        userId, kind.collection, item.seriesId || item.id, item.date, scheduledAt, notifyAt,
      ])).digest("base64url").slice(0, 32);
      due.push({ key, title: `${kind.label} reminder`, body: String(item.title || "").slice(0, 120) });
    }
  }
  return due;
}

module.exports = { configured, database, dueNotifications, supabaseBase, validEndpoint, validSubscription, validTimezone };
