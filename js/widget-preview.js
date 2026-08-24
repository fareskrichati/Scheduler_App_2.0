const STORAGE_KEY = "pulse-planner-v2";
const titles = { all: "Everything upcoming", today: "Today's planner", classes: "Classes + homework", homework: "Homework", events: "Events" };
const viewSelect = document.querySelector("#preview-view");
const dataSourceSelect = document.querySelector("#preview-data-source");
const offline = document.querySelector("#preview-offline");
const widgets = document.querySelectorAll(".scriptable-widget");

function previewData() {
  if (dataSourceSelect.value === "mine") {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved && typeof saved === "object") return saved; } catch (_) {}
    return { schedule: [], homework: [], exams: [], reminders: [] };
  }
  return presetPreviewData();
}

function presetPreviewData() {
  const today = todayIso(), tomorrow = offsetDate(today, 1), later = offsetDate(today, 2);
  return {
    schedule: [
      { id: "c1", type: "class", title: "CIV E 301 Discussion", date: today, start: "17:30", location: "BT 161", color: "#7eaed6" },
      { id: "c2", type: "class", title: "CON E 330 Discussion", date: today, start: "08:00", location: "SH 105", color: "#3f8091" },
      { id: "e1", type: "event", title: "Study group", date: tomorrow, start: "19:00", location: "Library", color: "#9b78c6", status: "pending" }
    ],
    homework: [
      { id: "h1", title: "Chapter 3 problems", course: "CIV E 301", date: today, time: "23:59", status: "pending", color: "#7eaed6" },
      { id: "h2", title: "Reading response", course: "CON E 330", date: tomorrow, time: "18:00", status: "pending", color: "#3f8091" },
      { id: "h3", title: "Lab preparation", course: "CIV E 301", date: later, time: "17:00", status: "pending", color: "#7eaed6" }
    ],
    exams: [{ id: "x1", title: "History exam", course: "World History", date: later, time: "10:00", status: "pending", color: "#6d9fd0" }],
    reminders: [{ id: "r1", title: "Submit scholarship form", date: tomorrow, time: "16:00", status: "pending", color: "#ba913a" }]
  };
}

function getPreviewItems(view) {
  const data = previewData(), today = todayIso(), end = offsetDate(today, 7), items = [];
  const schedule = Array.isArray(data.schedule) ? data.schedule : [], homework = Array.isArray(data.homework) ? data.homework : [];
  schedule.filter((item) => item.date >= today && item.date <= end && item.status !== "done").forEach((item) => {
    if (view === "classes" && item.type !== "class") return; if (view === "homework") return; if (view === "events" && item.type !== "event") return; if (view === "today" && item.date !== today) return;
    items.push({ symbol: item.type === "event" ? "○" : "│", title: item.title, meta: `${dateLabel(item.date, today)} ${formatTime(item.start)}${item.location ? ` · ${item.location}` : ""}`, color: item.color || "#7eaed6", key: courseKey(item.title), sort: `${item.date} ${item.start || ""}|0` });
  });
  if (view === "classes") {
    const parents = items.filter((item) => item.symbol === "│").sort((a, b) => a.sort.localeCompare(b.sort));
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end).forEach((item) => { const parent = parents.find((candidate) => candidate.key === courseKey(item.course)); if (parent) items.push({ symbol: "○", title: item.title, meta: `Due ${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: parent.color, nested: true, sort: `${parent.sort}|1|${item.date}` }); });
  } else if (view === "today" || view === "homework") {
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)} ${item.course || "Homework"}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#7eaed6", sort: `${item.date} ${item.time || "23:59"}` }));
  }
  if (view === "events" || view === "today") {
    [...(data.exams || []), ...(data.reminders || [])].filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#9abbd6", sort: `${item.date} ${item.time || "23:59"}` }));
  }
  return items.sort((a, b) => a.sort.localeCompare(b.sort));
}

function renderWidgetPreviews() {
  const view = viewSelect.value, source = getPreviewItems(view);
  widgets.forEach((widget) => {
    const items = source.slice(0, Number(widget.dataset.limit)).map((item) => `<div class="widget-item${item.nested ? " is-nested" : ""}" style="--item-color:${safeColor(item.color)}"><span class="widget-check${item.symbol === "│" ? " is-bar" : ""}">${item.symbol}</span><div class="widget-copy"><p class="widget-name">${escapeHtml(item.title)}</p><p class="widget-meta">${escapeHtml(item.meta)}</p></div></div>`).join("");
    widget.innerHTML = `<div class="widget-header"><span class="widget-title">${titles[view]}</span><span class="widget-date">${new Date().toLocaleDateString([], { month: "short", day: "numeric" })}</span></div><div class="widget-items">${items || '<p class="widget-meta">Nothing coming up.</p>'}</div><div class="widget-footer">${offline.checked ? "Offline copy" : "Updated just now"}</div>`;
  });
}

function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function offsetDate(value, days) { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function courseKey(value) { const match = String(value || "").match(/([A-Z]{2,}(?:\s+[A-Z])?\s*\d+[A-Z]?)/i); return (match?.[1] || value || "").replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function dateLabel(value, today) { if (value === today) return "Today"; return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
function formatTime(value) { if (!value) return ""; const [h,m] = value.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`; }
function safeColor(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#7eaed6"; }
function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }

viewSelect.addEventListener("change", renderWidgetPreviews); dataSourceSelect.addEventListener("change", renderWidgetPreviews); offline.addEventListener("change", renderWidgetPreviews); renderWidgetPreviews();
