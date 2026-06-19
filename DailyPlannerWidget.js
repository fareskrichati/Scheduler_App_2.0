// Daily Planner widget for Scriptable on iPhone.
// Widget parameter: today, classes, homework, or events.

const CONFIG = {
  supabaseUrl: "https://mgvahslbxdskzhiwxxod.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmFoc2xieGRza3poaXd4eG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTE2MzksImV4cCI6MjA5NDAyNzYzOX0.ovt30I4ZqPclxcXR5XJVrtBKUn_bVz17vrTJklxg3h8",
  refreshMinutes: 15,
};

const SESSION_KEY = "daily-planner-scriptable-session-v1";
const CACHE_FILE = "daily-planner-widget-cache.json";

async function main() {
  if (config.runsInApp) {
    await showSetupMenu();
    return;
  }

  const view = normalizeView(args.widgetParameter);
  let result;

  try {
    result = await loadPlannerData();
    saveCache(result.data);
  } catch (error) {
    const cached = loadCache();
    if (!cached) {
      Script.setWidget(buildMessageWidget("Open the script to sign in", String(error.message || error)));
      Script.complete();
      return;
    }
    result = { data: cached, cached: true };
  }

  const widget = buildPlannerWidget(result.data, view, Boolean(result.cached));
  widget.refreshAfterDate = new Date(Date.now() + CONFIG.refreshMinutes * 60 * 1000);
  Script.setWidget(widget);
  Script.complete();
}

async function showSetupMenu() {
  const menu = new Alert();
  menu.title = "Daily Planner Widget";
  menu.message = Keychain.contains(SESSION_KEY)
    ? "Your planner account is connected."
    : "Connect the same account used in Daily Planner.";
  menu.addAction(Keychain.contains(SESSION_KEY) ? "Reconnect account" : "Connect account");
  menu.addAction("Preview widget");
  if (Keychain.contains(SESSION_KEY)) menu.addDestructiveAction("Sign out");
  menu.addCancelAction("Cancel");
  const choice = await menu.presentAlert();

  if (choice === 0) {
    await signInInteractively();
    return;
  }

  if (choice === 1) {
    try {
      const result = await loadPlannerData();
      saveCache(result.data);
      await buildPlannerWidget(result.data, "today", false).presentMedium();
    } catch (error) {
      await showError(error);
    }
    return;
  }

  if (choice === 2 && Keychain.contains(SESSION_KEY)) {
    Keychain.remove(SESSION_KEY);
    const alert = new Alert();
    alert.title = "Signed out";
    alert.message = "The widget session was removed from iPhone Keychain.";
    alert.addAction("OK");
    await alert.presentAlert();
  }
}

async function signInInteractively() {
  const prompt = new Alert();
  prompt.title = "Connect Daily Planner";
  prompt.message = "Enter the email and password used in the planner app. The resulting session is stored securely in iPhone Keychain.";
  prompt.addTextField("Email");
  prompt.addSecureTextField("Password");
  prompt.addAction("Connect");
  prompt.addCancelAction("Cancel");
  const choice = await prompt.presentAlert();
  if (choice === -1) return;

  const email = prompt.textFieldValue(0).trim();
  const password = prompt.textFieldValue(1);
  if (!email || !password) {
    await showError(new Error("Email and password are required."));
    return;
  }

  try {
    const session = await requestSession("password", { email, password });
    saveSession(session);
    const result = await loadPlannerData();
    saveCache(result.data);
    const success = new Alert();
    success.title = "Connected";
    success.message = "Add a Scriptable widget to your Home Screen and select DailyPlannerWidget.";
    success.addAction("Preview");
    await success.presentAlert();
    await buildPlannerWidget(result.data, "today", false).presentMedium();
  } catch (error) {
    await showError(error);
  }
}

async function loadPlannerData() {
  let session = readSession();
  if (!session) throw new Error("Open this script in Scriptable to connect your account.");

  if (!session.access_token || Date.now() >= session.expiresAt - 60000) {
    session = await requestSession("refresh_token", { refresh_token: session.refresh_token });
    saveSession(session);
  }

  const request = new Request(
    `${CONFIG.supabaseUrl}/rest/v1/planner_profiles?select=data&user_id=eq.${encodeURIComponent(session.user.id)}`,
  );
  request.headers = {
    apikey: CONFIG.anonKey,
    Authorization: `Bearer ${session.access_token}`,
    Accept: "application/json",
  };
  const rows = await request.loadJSON();
  if (request.response.statusCode >= 400) throw new Error(rows.message || "Planner sync failed.");
  if (!Array.isArray(rows) || !rows[0] || !rows[0].data) throw new Error("No planner data was found.");
  return { data: rows[0].data, cached: false };
}

async function requestSession(grantType, body) {
  const request = new Request(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=${grantType}`);
  request.method = "POST";
  request.headers = {
    apikey: CONFIG.anonKey,
    "Content-Type": "application/json",
  };
  request.body = JSON.stringify(body);
  const response = await request.loadJSON();
  if (request.response.statusCode >= 400) throw new Error(response.error_description || response.msg || "Sign in failed.");
  return response;
}

function saveSession(session) {
  session.expiresAt = Date.now() + Number(session.expires_in || 3600) * 1000;
  Keychain.set(SESSION_KEY, JSON.stringify(session));
}

function readSession() {
  if (!Keychain.contains(SESSION_KEY)) return null;
  try {
    return JSON.parse(Keychain.get(SESSION_KEY));
  } catch (_) {
    return null;
  }
}

function buildPlannerWidget(data, view, cached) {
  const widget = new ListWidget();
  widget.setPadding(14, 14, 12, 14);
  const gradient = new LinearGradient();
  gradient.colors = [new Color("EAF4FB"), new Color("F8F4EC")];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;

  const header = widget.addStack();
  header.centerAlignContent();
  const title = header.addText(viewTitle(view));
  title.font = Font.boldSystemFont(14);
  title.textColor = new Color("285B86");
  header.addSpacer();
  const date = header.addText(shortDate(new Date()));
  date.font = Font.mediumSystemFont(11);
  date.textColor = new Color("667085");

  const items = getWidgetItems(data, view);
  const limit = config.widgetFamily === "small" ? 3 : config.widgetFamily === "large" ? 9 : 5;
  widget.addSpacer(8);

  if (!items.length) {
    const empty = widget.addText("Nothing coming up.");
    empty.font = Font.mediumSystemFont(13);
    empty.textColor = new Color("667085");
  } else {
    items.slice(0, limit).forEach((item, index) => {
      if (index) widget.addSpacer(7);
      addItemRow(widget, item);
    });
  }

  widget.addSpacer();
  const footer = widget.addText(cached ? "Offline copy" : "Updated just now");
  footer.font = Font.mediumSystemFont(9);
  footer.textColor = new Color("77808F");
  return widget;
}

function addItemRow(widget, item) {
  const row = widget.addStack();
  row.centerAlignContent();
  row.spacing = 7;
  const dot = row.addText("|");
  dot.font = Font.boldSystemFont(16);
  dot.textColor = new Color(item.color.replace("#", "") || "7EAED6");
  const text = row.addStack();
  text.layoutVertically();
  const name = text.addText(item.title);
  name.font = Font.semiboldSystemFont(12);
  name.textColor = new Color("161616");
  name.lineLimit = 1;
  const meta = text.addText(item.meta);
  meta.font = Font.mediumSystemFont(9);
  meta.textColor = new Color("667085");
  meta.lineLimit = 1;
}

function getWidgetItems(data, view) {
  const today = isoDate(new Date());
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const homework = Array.isArray(data.homework) ? data.homework : [];
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const items = [];

  schedule.forEach((item) => {
    if (item.date < today) return;
    if (view === "classes" && item.type !== "class") return;
    if (view === "homework") return;
    if (view === "events" && item.type !== "event") return;
    if (view === "today" && item.date !== today) return;
    items.push({ title: item.title, date: item.date, time: item.start || "", color: item.color || "#3F76C5", meta: `${dateLabel(item.date, today)} ${formatTime(item.start)}${item.location ? ` - ${item.location}` : ""}`.trim() });
  });

  if (view === "today" || view === "homework") {
    homework.forEach((item) => {
      if (item.status === "done" || item.date < today || (view === "today" && item.date !== today)) return;
      items.push({ title: item.title, date: item.date, time: item.time || "23:59", color: item.color || "#7EAED6", meta: `${dateLabel(item.date, today)} ${item.course || "Homework"}${item.time ? ` - ${formatTime(item.time)}` : ""}`.trim() });
    });
  }

  if (view === "today" || view === "events") {
    exams.forEach((item) => {
      if (item.status === "done" || item.date < today || (view === "today" && item.date !== today)) return;
      items.push({ title: item.title, date: item.date, time: item.time || "23:58", color: item.color || "#6D9FD0", meta: `${dateLabel(item.date, today)} ${item.course || "Exam"}`.trim() });
    });
    reminders.forEach((item) => {
      if (item.status === "done" || item.date < today || (view === "today" && item.date !== today)) return;
      items.push({ title: item.title, date: item.date, time: item.time || "23:57", color: item.color || "#9ABBD6", meta: `${dateLabel(item.date, today)} Reminder${item.time ? ` - ${formatTime(item.time)}` : ""}` });
    });
  }

  return items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function buildMessageWidget(titleText, message) {
  const widget = new ListWidget();
  widget.setPadding(16, 16, 16, 16);
  widget.backgroundColor = new Color("F8F4EC");
  const title = widget.addText(titleText);
  title.font = Font.boldSystemFont(14);
  title.textColor = new Color("285B86");
  widget.addSpacer(8);
  const detail = widget.addText(message);
  detail.font = Font.mediumSystemFont(11);
  detail.textColor = new Color("667085");
  return widget;
}

function normalizeView(value) {
  const view = String(value || "today").trim().toLowerCase();
  return ["today", "classes", "homework", "events"].includes(view) ? view : "today";
}

function viewTitle(view) {
  return { today: "Today's planner", classes: "Classes", homework: "Homework", events: "Events" }[view];
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(date, today) {
  if (date === today) return "Today";
  const value = new Date(`${date}T12:00:00`);
  return value.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function shortDate(date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  const parts = value.split(":");
  const hour = Number(parts[0]);
  return `${hour % 12 || 12}:${parts[1]} ${hour >= 12 ? "PM" : "AM"}`;
}

function cacheManager() {
  return FileManager.local();
}

function saveCache(data) {
  try {
    const manager = cacheManager();
    manager.writeString(manager.joinPath(manager.documentsDirectory(), CACHE_FILE), JSON.stringify(data));
  } catch (_) {}
}

function loadCache() {
  try {
    const manager = cacheManager();
    const path = manager.joinPath(manager.documentsDirectory(), CACHE_FILE);
    return manager.fileExists(path) ? JSON.parse(manager.readString(path)) : null;
  } catch (_) {
    return null;
  }
}

async function showError(error) {
  const alert = new Alert();
  alert.title = "Could not connect";
  alert.message = String(error.message || error);
  alert.addAction("OK");
  await alert.presentAlert();
}

await main();
