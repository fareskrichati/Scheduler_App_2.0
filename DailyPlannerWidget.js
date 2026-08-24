// Daily Planner widget for Scriptable on iPhone.
// Widget parameter: all, today, classes, homework, reminders, exams, events, or tasks.

const CONFIG = {
  supabaseUrl: "https://mgvahslbxdskzhiwxxod.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndmFoc2xieGRza3poaXd4eG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTE2MzksImV4cCI6MjA5NDAyNzYzOX0.ovt30I4ZqPclxcXR5XJVrtBKUn_bVz17vrTJklxg3h8",
  refreshMinutes: 15,
};

const SESSION_KEY = "daily-planner-scriptable-session-v1";
const APP_URL_KEY = "daily-planner-scriptable-app-url-v1";
const CACHE_FILE = "daily-planner-widget-cache.json";

async function main() {
  if (args.queryParameters && args.queryParameters.action === "complete") {
    await completeWidgetItem(args.queryParameters.collection, args.queryParameters.id);
    return;
  }

  if (args.queryParameters && args.queryParameters.action === "open-app") {
    try {
      await openFullPlanner();
    } catch (error) {
      await showSetupMenu(error);
    }
    return;
  }

  if (config.runsInApp) {
    await showSetupMenu();
    return;
  }

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

  const preferences = getWidgetPreferences(result.data);
  const view = normalizeView(args.widgetParameter, preferences.defaultView);
  const widget = buildPlannerWidget(result.data, view, Boolean(result.cached), preferences);
  widget.url = `${URLScheme.forRunningScript()}?action=open-app`;
  widget.refreshAfterDate = new Date(Date.now() + CONFIG.refreshMinutes * 60 * 1000);
  Script.setWidget(widget);
  Script.complete();
}

async function showSetupMenu(error = null) {
  const menu = new Alert();
  const actions = [];
  const hasSession = Keychain.contains(SESSION_KEY);
  menu.title = "Daily Planner Widget";
  menu.message = error
    ? String(error.message || error)
    : hasSession
    ? "Your planner account is connected."
    : "Connect the same account used in Daily Planner.";

  if (hasSession) {
    menu.addAction("Open full planner");
    actions.push(openFullPlanner);
  }
  menu.addAction(hasSession ? "Reconnect account" : "Connect account");
  actions.push(signInInteractively);
  menu.addAction("Set planner website URL");
  actions.push(configureAppUrl);
  if (hasSession) {
    menu.addAction("Preview widget");
    actions.push(previewWidget);
    menu.addDestructiveAction("Sign out");
    actions.push(signOut);
  }
  menu.addCancelAction("Cancel");
  const choice = await menu.presentAlert();
  if (choice >= 0 && actions[choice]) await actions[choice]();
}

async function previewWidget() {
  try {
    const result = await loadPlannerData();
    saveCache(result.data);
    const preferences = getWidgetPreferences(result.data);
    await buildPlannerWidget(result.data, preferences.defaultView, false, preferences).presentMedium();
  } catch (error) {
    await showError(error);
  }
}

async function signOut() {
  if (Keychain.contains(SESSION_KEY)) Keychain.remove(SESSION_KEY);
  const alert = new Alert();
  alert.title = "Signed out";
  alert.message = "The widget session was removed from iPhone Keychain.";
  alert.addAction("OK");
  await alert.presentAlert();
}

async function configureAppUrl() {
  const prompt = new Alert();
  prompt.title = "Planner website";
  prompt.message = "Enter the public Netlify URL for Daily Planner. Scriptable will open the complete app in a full-screen WebView.";
  prompt.addTextField("https://your-site.netlify.app", getAppUrl());
  prompt.addAction("Save");
  prompt.addCancelAction("Cancel");
  const choice = await prompt.presentAlert();
  if (choice === -1) return "";

  const url = prompt.textFieldValue(0).trim().replace(/\/$/, "");
  if (!/^https:\/\//i.test(url)) {
    await showError(new Error("Enter a complete https:// website URL."));
    return "";
  }

  Keychain.set(APP_URL_KEY, url);
  return url;
}

async function openFullPlanner() {
  const result = await loadPlannerData();
  saveCache(result.data);
  const preferences = getWidgetPreferences(result.data);
  const syncedUrl = preferences.plannerUrl;
  if (syncedUrl) Keychain.set(APP_URL_KEY, syncedUrl);
  const url = syncedUrl || getAppUrl() || (config.runsInApp ? await configureAppUrl() : "");
  if (!url) {
    if (config.runsInApp) return;
    throw new Error("Open the script and set your planner website URL first.");
  }
  const separator = url.includes("?") ? "&" : "?";
  const plannerUrl = `${url}${separator}tab=${encodeURIComponent(preferences.startScreen)}&scriptable=1`;
  await WebView.loadURL(plannerUrl, null, true);
}

function getAppUrl() {
  return Keychain.contains(APP_URL_KEY) ? Keychain.get(APP_URL_KEY) : "";
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
    await openFullPlanner();
  } catch (error) {
    await showError(error);
  }
}

async function loadPlannerData() {
  let session = readSession();
  if (!session) throw new Error("Open this script in Scriptable to connect your account.");

  if (!session.access_token || Date.now() >= session.expiresAt - 60000) {
    try {
      session = await requestSession("refresh_token", { refresh_token: session.refresh_token });
    } catch (error) {
      if (error.statusCode === 400 || error.statusCode === 401) {
        Keychain.remove(SESSION_KEY);
        throw new Error("Your saved sign-in expired. Tap Connect account to sign in again.");
      }
      throw error;
    }
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
  if (request.response.statusCode >= 400) {
    const error = new Error(response.error_description || response.msg || "Sign in failed.");
    error.statusCode = request.response.statusCode;
    throw error;
  }
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

function buildPlannerWidget(data, view, cached, preferences = getWidgetPreferences(data)) {
  const widget = new ListWidget();
  widget.setPadding(10, 11, 9, 11);
  const gradient = new LinearGradient();
  gradient.colors = [new Color("EAF4FB"), new Color("F8F4EC")];
  gradient.locations = [0, 1];
  widget.backgroundGradient = gradient;

  const header = widget.addStack();
  header.centerAlignContent();
  const title = header.addText(viewTitle(view));
  title.font = Font.boldSystemFont(12);
  title.textColor = new Color("285B86");
  header.addSpacer();
  const date = header.addText(shortDate(new Date()));
  date.font = Font.mediumSystemFont(9);
  date.textColor = new Color("667085");

  const items = getWidgetItems(data, view, preferences);
  const familyLimit = config.widgetFamily === "small" ? 3 : config.widgetFamily === "large" ? 14 : 5;
  const limit = config.widgetFamily === "large" ? Math.min(Math.max(preferences.itemLimit, 12), familyLimit) : Math.min(preferences.itemLimit, familyLimit);
  widget.addSpacer(5);

  if (!items.length) {
    const empty = widget.addText("Nothing coming up.");
    empty.font = Font.mediumSystemFont(13);
    empty.textColor = new Color("667085");
  } else {
    items.slice(0, limit).forEach((item, index) => {
      if (index) widget.addSpacer(4);
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
  row.spacing = 6;
  if (item.nested) row.addSpacer(14);
  if (item.completable) {
    row.url = `${URLScheme.forRunningScript()}?action=complete&collection=${encodeURIComponent(item.collection)}&id=${encodeURIComponent(item.id)}`;
    const check = row.addText("○");
    check.font = Font.semiboldSystemFont(14);
    check.textColor = new Color(item.color.replace("#", "") || "7EAED6");
    check.url = row.url;
  } else {
    const dot = row.addText("│");
    dot.font = Font.boldSystemFont(13);
    dot.textColor = new Color(item.color.replace("#", "") || "7EAED6");
  }
  const text = row.addStack();
  text.layoutVertically();
  const name = text.addText(item.title);
  name.font = Font.semiboldSystemFont(10);
  name.textColor = new Color("161616");
  name.lineLimit = 1;
  const meta = text.addText(item.meta);
  meta.font = Font.mediumSystemFont(8);
  meta.textColor = new Color("667085");
  meta.lineLimit = 1;
}

function getWidgetItems(data, view, preferences = getWidgetPreferences(data)) {
  const today = isoDate(new Date());
  const lastDate = preferences.daysAhead === "all" ? "9999-12-31" : offsetIsoDate(today, preferences.daysAhead - 1);
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const homework = Array.isArray(data.homework) ? data.homework : [];
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const reminders = Array.isArray(data.reminders) ? data.reminders : [];
  const items = [];

  schedule.forEach((item) => {
    if (item.date < today || item.date > lastDate) return;
    if (view === "classes" && item.type !== "class") return;
    if (["homework", "reminders", "exams", "tasks"].includes(view)) return;
    if (view === "events" && item.type !== "event") return;
    if (view === "today" && item.date !== today) return;
    if (item.type === "class" && !preferences.classes) return;
    if (item.type === "event" && !preferences.events) return;
    if (item.status === "done") return;
    items.push({ title: item.title, date: item.date, time: item.start || "", color: item.color || "#3F76C5", meta: `${dateLabel(item.date, today)} ${formatTime(item.start)}${item.location ? ` - ${item.location}` : ""}`.trim(), id: item.id, collection: "schedule", completable: item.type === "event", courseKey: widgetCourseKey(item.title), sortKey: `${item.date} ${item.start || ""}|0` });
  });

  if (view === "classes" && preferences.homework) {
    const classItems = items.filter((item) => item.collection === "schedule").sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    homework.forEach((item) => {
      if (item.status === "done" || item.date < today || item.date > lastDate) return;
      const homeworkKey = widgetCourseKey(item.course || "");
      const courseName = (item.course || "").trim().toLowerCase();
      if (!courseName) return;
      const parent = classItems.find((classItem) => classItem.courseKey === homeworkKey || classItem.title.toLowerCase().includes(courseName) || courseName.includes(classItem.title.toLowerCase()));
      if (!parent) return;
      items.push({ title: item.title, date: parent.date, time: parent.time, color: parent.color, meta: `Due ${dateLabel(item.date, today)}${item.time ? ` - ${formatTime(item.time)}` : ""}`, id: item.id, collection: "homework", completable: true, nested: true, sortKey: `${parent.sortKey}|1|${item.date} ${item.time || "23:59"}` });
    });
  }

  if (["all", "today", "homework", "tasks"].includes(view)) {
    homework.forEach((item) => {
      if (!preferences.homework || item.status === "done" || item.date < today || (!["homework", "tasks"].includes(view) && item.date > lastDate) || (view === "today" && item.date !== today)) return;
      items.push({ title: item.title, date: item.date, time: item.time || "23:59", color: item.color || "#7EAED6", meta: `${dateLabel(item.date, today)} ${item.course || "Homework"}${item.time ? ` - ${formatTime(item.time)}` : ""}`.trim(), id: item.id, collection: "homework", completable: true });
    });
  }

  if (["all", "today", "events", "exams"].includes(view)) {
    exams.forEach((item) => {
      if (!preferences.exams || item.status === "done" || item.date < today || item.date > lastDate || (view === "today" && item.date !== today)) return;
      items.push({ title: item.title, date: item.date, time: item.time || "23:58", color: item.color || "#6D9FD0", meta: `${dateLabel(item.date, today)} ${item.course || "Exam"}`.trim(), id: item.id, collection: "exams", completable: true });
    });
  }
  if (["all", "today", "events", "reminders", "tasks"].includes(view)) reminders.forEach((item) => {
    if (!preferences.reminders || item.status === "done" || item.date < today || (["reminders", "tasks"].includes(view) ? false : item.date > lastDate) || (view === "today" && item.date !== today)) return;
    items.push({ title: item.title, date: item.date, time: item.time || "23:57", color: item.color || "#9ABBD6", meta: `${dateLabel(item.date, today)} Reminder${item.time ? ` - ${formatTime(item.time)}` : ""}`, id: item.id, collection: "reminders", completable: true });
  });

  return items.sort((a, b) => (a.sortKey || `${a.date} ${a.time}`).localeCompare(b.sortKey || `${b.date} ${b.time}`));
}

function widgetCourseKey(value) {
  const match = String(value || "").match(/([A-Z]{2,}(?:\s+[A-Z])?\s*\d+[A-Z]?)/i);
  return (match ? match[1] : String(value || "")).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

async function completeWidgetItem(collection, id) {
  const allowed = ["schedule", "homework", "exams", "reminders"];
  if (!allowed.includes(collection) || !id) throw new Error("Invalid planner item.");
  const result = await loadPlannerData();
  const items = Array.isArray(result.data[collection]) ? result.data[collection] : [];
  const item = items.find((entry) => entry.id === id);
  if (!item || (collection === "schedule" && item.type !== "event")) return;
  item.status = "done";
  item.completedAt = new Date().toISOString();
  await savePlannerData(result.data);
  saveCache(result.data);
  const notice = new Notification();
  notice.title = "Completed";
  notice.body = item.title;
  await notice.schedule();
  Script.complete();
}

async function savePlannerData(data) {
  const session = readSession();
  const request = new Request(`${CONFIG.supabaseUrl}/rest/v1/planner_profiles?user_id=eq.${encodeURIComponent(session.user.id)}`);
  request.method = "PATCH";
  request.headers = { apikey: CONFIG.anonKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Prefer: "return=minimal" };
  request.body = JSON.stringify({ data, updated_at: new Date().toISOString() });
  await request.load();
  if (request.response.statusCode >= 400) throw new Error("Could not mark that item complete.");
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

function getWidgetPreferences(data) {
  const saved = data && data.settings && data.settings.widgetPreferences
    ? data.settings.widgetPreferences
    : {};
  return {
    defaultView: normalizeView(saved.defaultView, "all"),
    startScreen: normalizeStartScreen(saved.startScreen),
    plannerUrl: typeof saved.plannerUrl === "string" ? saved.plannerUrl.trim().replace(/\/$/, "") : "",
    daysAhead: saved.daysAhead === "all" || [1, 3, 7, 14].includes(Number(saved.daysAhead)) ? (saved.daysAhead === "all" ? "all" : Number(saved.daysAhead)) : "all",
    itemLimit: [3, 5, 8, 10, 12, 14].includes(Number(saved.itemLimit)) ? Number(saved.itemLimit) : 5,
    classes: typeof saved.classes === "boolean" ? saved.classes : true,
    homework: typeof saved.homework === "boolean" ? saved.homework : true,
    events: typeof saved.events === "boolean" ? saved.events : true,
    exams: typeof saved.exams === "boolean" ? saved.exams : true,
    reminders: typeof saved.reminders === "boolean" ? saved.reminders : true,
  };
}

function normalizeStartScreen(value) {
  const screens = ["calendar", "classes", "events", "homework", "exams", "reminders", "settings"];
  return screens.includes(value) ? value : "calendar";
}

function normalizeView(value, fallback = "today") {
  const view = String(value || "").trim().toLowerCase();
  return ["all", "today", "classes", "homework", "reminders", "exams", "events", "tasks"].includes(view) ? view : fallback;
}

function viewTitle(view) {
  return { all: "Everything upcoming", today: "Today's planner", classes: "Classes", homework: "Homework", reminders: "Reminders", exams: "Exams & quizzes", events: "Events", tasks: "Homework & reminders" }[view];
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function offsetIsoDate(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
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
