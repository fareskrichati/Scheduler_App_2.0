const STORAGE_KEY = "uniplan-2.0-data";
const titles = { all: "Up next", today: "Today's planner", classes: "Classes + homework", homework: "Homework", reminders: "Reminders", tasks: "To-Do list", exams: "Exams & quizzes", events: "Events" };
const viewSelect = document.querySelector("#preview-view");
const dataSourceSelect = document.querySelector("#preview-data-source");
const offline = document.querySelector("#preview-offline");
const widgets = document.querySelectorAll(".scriptable-widget");

const previewCompleted = new Set();
let completionMessage = "Tap to chat";
const widgetPetSvg = kind => {
    const color = {cat:'#b6a1e6',dog:'#d7aa77',fox:'#ed985d',robot:'#83c9c4'}[kind] || '#b6a1e6';
    if(kind==='cat') return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M21 45L25 15L42 30Q50 27 58 30L75 15L79 45Q88 80 66 88Q50 95 34 88Q12 80 21 45" fill="${color}"/><path d="M28 34l1-10 8 9m26 0 8-9 1 10" fill="#efbdd8"/><path d="M42 32l3 9m13-9-3 9" stroke="#8970bc" stroke-width="3" stroke-linecap="round"/><g fill="#253749"><ellipse cx="36" cy="55" rx="4" ry="6"/><ellipse cx="64" cy="55" rx="4" ry="6"/></g><path d="M46 66h8l-4 5z" fill="#bc7398"/><path d="M50 71v4m0 0q-5 6-10 0m10 0q5 6 10 0M30 67l-16-3m16 10-16 3m56-10 16-3m-16 10 16 3" fill="none" stroke="#253749" stroke-width="2" stroke-linecap="round"/></svg>`;
    const ears = kind === 'robot' ? '<path d="M50 22V10m-5 0h10" stroke="#405065" stroke-width="4"/><rect x="16" y="39" width="68" height="47" rx="15"/>' : kind === 'dog' ? '<ellipse cx="22" cy="48" rx="13" ry="24"/><ellipse cx="78" cy="48" rx="13" ry="24"/>' : '<path d="M22 43L18 12L44 31M56 31L82 12L78 43" stroke="#405065" stroke-width="3"/>';
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="${color}">${ears}<ellipse cx="50" cy="60" rx="33" ry="30"/></g><ellipse cx="50" cy="71" rx="21" ry="14" fill="#fff" opacity=".75"/><g fill="#253749"><circle cx="37" cy="54" r="4"/><circle cx="63" cy="54" r="4"/><path d="M46 66h8l-4 5z"/></g><path d="M42 76q8 7 16 0" fill="none" stroke="#253749" stroke-width="2.5" stroke-linecap="round"/></svg>`;

};

function previewData() {
  if (dataSourceSelect.value === "mine") {
    try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved && typeof saved === "object") return saved; } catch (_) {}
    return { schedule: [], homework: [], exams: [], reminders: [] };
  }
  const data = presetPreviewData();
  if (dataSourceSelect.value === "full") {
    data.homework = Array.from({length: 26}, (_, index) => ({id: `sample-${index}`, title: ['Chapter review', 'Practice problems', 'Reading response', 'Lab preparation'][index % 4] + ` ${index + 1}`, course: 'CIV E 301', date: todayIso(), time: '23:59', status: 'pending', color: '#7eaed6'}));
  }
  return data;
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
    if (view === "classes" && item.type !== "class") return; if (["homework", "reminders", "tasks", "exams"].includes(view)) return; if (view === "events" && item.type !== "event") return; if (view === "today" && item.date !== today) return;
    items.push({ id: item.id, collection: undefined, end: item.end, symbol: "│", title: item.title, meta: `${dateLabel(item.date, today)} ${formatTime(item.start)}${item.location ? ` · ${item.location}` : ""}`, color: item.color || "#7eaed6", key: courseKey(item.title), sort: `${item.date} ${item.start || ""}|0` });
  });
  if (view === "classes") {
    const parents = items.filter((item) => item.symbol === "│").sort((a, b) => a.sort.localeCompare(b.sort));
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end).forEach((item) => { const parent = parents.find((candidate) => candidate.key === courseKey(item.course)); if (parent) items.push({ id: item.id, collection: "homework", symbol: "○", title: item.title, meta: `Due ${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: parent.color, nested: true, sort: `${parent.sort}|1|${item.date}` }); });
  } else if (["all", "today", "homework", "tasks"].includes(view)) {
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "homework", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)} ${item.course || "Homework"}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#7eaed6", sort: `${item.date} ${item.time || "23:59"}` }));
  }
  if (["all", "events", "today", "exams", "tasks"].includes(view)) (data.exams || []).filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "exams", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#6d9fd0", sort: `${item.date} ${item.time || "23:58"}` }));
  if (["all", "events", "today", "reminders", "tasks"].includes(view)) (data.reminders || []).filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "reminders", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#9abbd6", sort: `${item.date} ${item.time || "23:57"}` }));
  return items.filter(item => view !== 'all' || !item.sort.slice(11,16).match(/^\d{2}:\d{2}$/) || new Date(item.sort.slice(0,10)+'T'+(item.end || item.sort.slice(11,16))) >= new Date()).filter(item => !previewCompleted.has(`${dataSourceSelect.value}:${item.collection}:${item.id}`)).sort((a, b) => a.sort.localeCompare(b.sort));
}

function savedSettings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.settings || {}; } catch { return {}; }
}
function widgetCountdown(item, now = new Date()) {
  const date = item.sort.slice(0,10), time = item.sort.slice(11,16);
  if (!/^\d{2}:\d{2}$/.test(time)) return 'Coming up';
  const minutes = Math.max(0, Math.ceil((new Date(`${date}T${time}:00`) - now) / 60000));
  const due = ['homework', 'exams'].includes(item.collection);
  if(item.end && new Date(`${date}T${time}:00`) <= now && new Date(`${date}T${item.end}:00`) > now) {
    const left = Math.ceil((new Date(`${date}T${item.end}:00`) - now) / 60000);
    return `Ends in ${Math.floor(left / 60) ? Math.floor(left / 60)+'h ' : ''}${left % 60}m`;
  }
  if (!minutes) return due ? 'Due now' : 'Starting now';
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), mins = minutes % 60;
  return (due ? 'Due in ' : 'Starts in ') + [days ? `${days}d` : '', hours ? `${hours}h` : '', mins ? `${mins}m` : ''].filter(Boolean).join(' ');
}

function renderWidgetPreviews() {
  const settings = savedSettings();
  const appearance = widgetAppearance(settings, window.matchMedia('(prefers-color-scheme: dark)').matches);
  Object.entries(appearance).forEach(([key,value]) => { if (typeof value === 'string') document.documentElement.style.setProperty('--widget-'+key,value); });
  document.documentElement.style.colorScheme = appearance.dark ? 'dark' : 'light';

  const view = viewSelect.value, source = getPreviewItems(view).sort((a,b) => Number(widgetCountdown(b).startsWith('Ends in')) - Number(widgetCountdown(a).startsWith('Ends in')));
  widgets.forEach((widget) => {
    const requested = settings.widgetPreferences;
    const limit = requested?.itemLimitMode === "manual" ? Math.min(Number(requested.itemLimit) || Number(widget.dataset.limit), Number(widget.dataset.limit)) : (widget.classList.contains("widget-small") ? 2 : widget.classList.contains("widget-medium") ? 4 : Math.min(6,Number(widget.dataset.limit)));
    const items = source.slice(0, limit).map((item, index) => `<div class="widget-item${index === 0 ? " is-featured" : ""}${item.nested ? " is-nested" : ""}" style="--item-color:${safeColor(item.color)}">${item.collection ? `<button type="button" class="widget-check" data-collection="${item.collection}" data-id="${escapeHtml(item.id)}" aria-label="Mark ${escapeHtml(item.title)} done" ${offline.checked ? "disabled" : ""}>○</button>` : `<span class="widget-check${item.symbol === "│" ? " is-bar" : ""}">${item.symbol}</span>`}<div class="widget-copy"><p class="widget-countdown">${widgetCountdown(item).startsWith("Ends in") ? "Now" : index === 0 ? "Next" : "Then"} · ${escapeHtml(widgetCountdown(item))}</p><p class="widget-name">${escapeHtml(item.title)}</p><p class="widget-meta">${escapeHtml(item.meta)}</p></div></div>`).join("");
    widget.innerHTML = `<div class="widget-header"><span class="widget-title">${new Date().toLocaleDateString([], { weekday: "long" })}</span><span class="widget-date">${new Date().toLocaleDateString([], { month: "long", day: "numeric" })}</span></div><div class="widget-items">${items || '<p class="widget-meta">Nothing coming up.</p>'}</div><div class="widget-footer"><span>${offline.checked ? "Offline copy" : "Updated just now"}${source.length > limit ? ` · +${source.length - limit} more` : ""}</span><span class="widget-buddy"><span class="widget-buddy-message" role="status">${escapeHtml(completionMessage)}</span><a class="widget-pet" href="index.html?pet=open" target="_top" aria-label="Open your pet in UniPlan">${widgetPetSvg((typeof savedSettings === "function" ? savedSettings() : {}).pet?.species || "cat")}</a></span></div>`;
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

window.addEventListener('storage', renderWidgetPreviews);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderWidgetPreviews);

widgets.forEach(widget => widget.addEventListener('click', event => {
  const button = event.target.closest('button[data-collection]');
  if (!button || offline.checked) return;
  previewCompleted.add(`${dataSourceSelect.value}:${button.dataset.collection}:${button.dataset.id}`);
  completionMessage = 'Nice work! ✓';
  renderWidgetPreviews();
}));
viewSelect.value = 'all';
renderWidgetPreviews();

setInterval(renderWidgetPreviews, 60000);
