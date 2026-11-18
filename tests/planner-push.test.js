const test = require("node:test");
const assert = require("node:assert/strict");
const webPush = require("web-push");
const { dueNotifications, validEndpoint } = require("../netlify/functions/lib/planner-push");
const registration = require("../netlify/functions/push-registration");
const dispatch = require("../netlify/functions/planner-push-dispatch");

function reminders(data, now, timezone = "America/Los_Angeles") {
  return dueNotifications(data, timezone, Date.parse(now), "owner");
}

test("event lead time is interpreted in the item's timezone", () => {
  const event = { id: "meeting", type: "event", title: "Meeting", date: "2026-11-17", start: "10:00",
    pushLeadMinutes: 35, pushTimezone: "America/Los_Angeles" };
  const data = { schedule: [event, { ...event, id: "class", type: "study" }] };
  assert.deepEqual(reminders(data, "2026-11-17T17:24:59Z", "UTC"), []);
  assert.deepEqual(reminders(data, "2026-11-17T17:25:00Z", "UTC").map(({ body }) => body), ["Meeting"]);
  assert.deepEqual(reminders(data, "2026-11-17T18:00:00Z", "UTC"), []);
});

test("homework and exams use defaults only when the override is absent", () => {
  const homework = { id: "assignment", title: "Reading", date: "2026-11-17" };
  const exam = { id: "exam", title: "Midterm", date: "2026-11-18" };
  assert.deepEqual(reminders({ homework: [homework] }, "2026-11-18T06:59:00Z").map(({ body }) => body), ["Reading"]);
  assert.deepEqual(reminders({ exams: [exam] }, "2026-11-17T17:00:00Z").map(({ body }) => body), ["Midterm"]);
  assert.deepEqual(reminders({ exams: [{ ...exam, pushLeadMinutes: null }, { ...exam, status: "done" }] },
    "2026-11-17T17:00:00Z"), []);
  assert.equal(reminders({ exams: [{ ...exam, pushLeadMinutes: 0 }] }, "2026-11-18T17:00:00Z").length, 1);
});

test("recurring items keep a delivery key through series edits and handle DST", () => {
  const occurrence = { id: "original", seriesId: "series", type: "event", date: "2026-03-08", start: "02:30",
    pushLeadMinutes: 15 };
  const now = "2026-03-08T10:15:00Z";
  const [initial] = reminders({ schedule: [occurrence] }, now);
  const [edited] = reminders({ schedule: [{ ...occurrence, id: "after-edit" }] }, now);
  assert.ok(initial);
  assert.equal(initial.key, edited.key);
  assert.notEqual(initial.key, reminders({ schedule: [{ ...occurrence, date: "2026-03-15" }] },
    "2026-03-15T09:15:00Z")[0].key);
});

test("calendar presets keep local time through daylight saving changes", () => {
  const event = { id: "event", type: "event", date: "2026-03-09", start: "09:00", pushLeadMinutes: null };
  for (const [preset, expected] of [
    ["day", "2026-03-08T16:00:00Z"],
    ["threeDays", "2026-03-06T17:00:00Z"],
    ["week", "2026-03-02T17:00:00Z"],
  ]) {
    const data = { schedule: [{ ...event, pushLeadPreset: preset }] };
    assert.equal(reminders(data, new Date(Date.parse(expected) - 1).toISOString()).length, 0);
    assert.equal(reminders(data, expected).length, 1);
  }
});

test("month preset clamps to the last day of the previous month", () => {
  const data = { exams: [{ id: "exam", date: "2026-03-31", time: "09:00", pushLeadPreset: "month",
    pushLeadMinutes: null }] };
  assert.equal(reminders(data, "2026-02-28T16:59:00Z").length, 0);
  assert.equal(reminders(data, "2026-02-28T17:00:00Z").length, 1);
});

test("classes and personal reminders use configurable defaults with per-item overrides", () => {
  const data = {
    settings: { pushDefaults: {
      class: { pushLeadMinutes: 30 },
      event: { pushLeadMinutes: null },
      reminder: { pushLeadPreset: "day", pushLeadMinutes: null },
      homework: { pushLeadMinutes: 10 },
      exam: { pushLeadMinutes: 60 },
    } },
    schedule: [
      { id: "class", type: "class", title: "Algebra", date: "2026-11-17", start: "10:00" },
      { id: "event", type: "event", title: "Hidden", date: "2026-11-17", start: "10:00", pushUseDefault: true, pushLeadMinutes: 15 },
      { id: "override", type: "event", title: "Custom event", date: "2026-11-17", start: "10:00", pushLeadMinutes: 30 },
      { id: "online", type: "class", title: "Online", date: "2026-11-17" },
    ],
    reminders: [
      { id: "reminder", title: "Call advisor", date: "2026-11-18", time: "09:30" },
      { id: "done", title: "Done", date: "2026-11-18", time: "09:30", status: "done" },
      { id: "off", title: "Off", date: "2026-11-18", time: "09:30", pushLeadMinutes: null },
    ],
    homework: [{ id: "homework", title: "Reading", date: "2026-11-17", time: "09:40" }],
    exams: [{ id: "exam", title: "Quiz", date: "2026-11-17", time: "10:30" }],
  };
  const due = reminders(data, "2026-11-17T17:30:00Z");
  assert.deepEqual(due.map(({body}) => body).sort(), ["Algebra", "Call advisor", "Custom event", "Quiz", "Reading"]);
  data.settings.pushDefaults.class.pushLeadMinutes = 10;
  assert.equal(reminders(data, "2026-11-17T17:30:00Z").some(({body}) => body === "Algebra"), false);
});

test("device registration limits destinations and derives ownership from the session", async (t) => {
  configure(t);
  const endpoint = "https://web.push.apple.com/provider-token";
  for (const url of ["https://web.push.apple.com.evil.test/abc", "http://fcm.googleapis.com/abc",
    "https://fcm.googleapis.com:444/abc", "https://other@updates.push.services.mozilla.com/abc"]) {
    assert.equal(validEndpoint(url), false);
  }
  const calls = [];
  t.mock.method(global, "fetch", async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "owner" });
    return new Response(null, { status: options.method === "POST" ? 201 : 204 });
  });

  const body = JSON.stringify({ user_id: "other", timezone: "UTC", subscription: subscription(endpoint) });
  assert.equal((await registration.handler({ httpMethod: "POST", body })).statusCode, 401);
  assert.equal(calls.length, 0);
  const headers = { authorization: "Bearer actual-session" };
  assert.equal((await registration.handler({ httpMethod: "POST", headers, body })).statusCode, 200);
  assert.equal(JSON.parse(calls[1][1].body).user_id, "owner");
  assert.equal((await registration.handler({ httpMethod: "DELETE", headers, body: JSON.stringify({ endpoint }) })).statusCode, 200);
  assert.equal(new URL(calls[3][0]).searchParams.get("user_id"), "eq.owner");
});

test("dispatch retries provider failures, then uses the database claim to skip duplicates", async (t) => {
  configure(t);
  t.mock.method(Date, "now", () => Date.parse("2026-11-17T09:45:00Z"));
  const claims = new Set();
  const device = { id: "device", user_id: "owner", timezone: "UTC", subscription: subscription(),
    planner_profiles: { data: { schedule: [{ id: "event", type: "event", title: "Meeting", date: "2026-11-17", start: "10:00" }] } } };
  t.mock.method(global, "fetch", async (url, options) => {
    if (url.includes("/planner_push_subscriptions?")) return Response.json([device]);
    if (options.method === "DELETE") {
      claims.delete(new URL(url).searchParams.get("notification_key").slice(3));
      return new Response(null, { status: 204 });
    }
    const claim = JSON.parse(options.body);
    if (claims.has(claim.notification_key)) return Response.json([]);
    claims.add(claim.notification_key);
    return Response.json([claim]);
  });
  let sent = 0;
  t.mock.method(console, "error", () => {});
  t.mock.method(webPush, "sendNotification", async (_, body) => {
    assert.equal(JSON.parse(body).body, "Meeting");
    sent++;
    if (sent === 1) throw Object.assign(new Error("Try again"), { statusCode: 503 });
  });

  assert.equal((await dispatch.handler()).statusCode, 502);
  const results = await Promise.all([dispatch.handler(), dispatch.handler()]);
  assert.deepEqual(results.map(({ statusCode }) => statusCode), [200, 200]);
  assert.equal(sent, 2);
});

function subscription(endpoint = "https://fcm.googleapis.com/provider-token") {
  return { endpoint, keys: { p256dh: "B" + "A".repeat(86), auth: "A".repeat(22) } };
}

function configure(t) {
  const values = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-only",
    PUSH_VAPID_PUBLIC_KEY: "public-key", PUSH_VAPID_PRIVATE_KEY: "private-key", PUSH_VAPID_SUBJECT: "mailto:test@example.com" };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}
