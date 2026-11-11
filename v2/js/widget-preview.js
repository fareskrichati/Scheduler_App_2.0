const STORAGE_KEY = "uniplan-2.0-data";
const viewSelect = document.querySelector("#preview-view");
const dataSourceSelect = document.querySelector("#preview-data-source");
const offline = document.querySelector("#preview-offline");
const widgets = document.querySelectorAll(".scriptable-widget");

const previewCompleted = new Set();

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
      { id: "c1", type: "class", title: "CIV E 301 Discussion", date: today, start: "17:30", end: "18:20", location: "BT 161", color: "#7eaed6" },
      { id: "c2", type: "class", title: "CON E 330 Discussion", date: today, start: "08:00", end: "09:15", location: "SH 105", color: "#3f8091" },
      { id: "e1", type: "event", title: "Study group", date: tomorrow, start: "19:00", location: "Library", color: "#9b78c6", status: "pending" }
    ],
    homework: [
      { id: "h1", title: "Chapter 3 problems", course: "CIV E 301", date: today, time: "23:59", status: "pending", color: "#7eaed6" },
      { id: "h2", title: "Reading response", course: "CON E 330", date: tomorrow, time: "18:00", status: "pending", color: "#3f8091" }
    ],
    exams: [{ id: "x1", title: "History exam", course: "World History", date: later, time: "10:00", status: "pending", color: "#6d9fd0" }],
    reminders: [{ id: "r1", title: "Submit scholarship form", date: tomorrow, time: "16:00", status: "pending", color: "#ba913a" }]
  };
}

function getPreviewItems(view, now = new Date()) {
  const data = previewData(), today = todayIso(), end = offsetDate(today, 7), items = [];
  const schedule = Array.isArray(data.schedule) ? data.schedule : [], homework = Array.isArray(data.homework) ? data.homework : [];
  schedule.filter((item) => item.date >= today && item.date <= end && item.status !== "done").forEach((item) => {
    if (view === "classes" && item.type !== "class") return; if (["homework", "reminders", "tasks", "exams"].includes(view)) return; if (view === "events" && item.type !== "event") return; if (view === "today" && item.date !== today) return;
    items.push({ id: item.id, collection: undefined, end: item.end, time: item.start, detail: item.location, kind: item.type === 'class' ? 'Class' : 'Event', featureMeta: [item.location, durationLabel(item.start, item.end)].filter(Boolean).join(' · '), symbol: "│", title: item.title, meta: `${dateLabel(item.date, today)} ${formatTime(item.start)}${item.location ? ` · ${item.location}` : ""}`, color: item.color || "#7eaed6", key: courseKey(item.title), sort: `${item.date} ${item.start || ""}|0` });
  });
  if (view === "classes") {
    const parents = items.filter((item) => item.symbol === "│").sort((a, b) => a.sort.localeCompare(b.sort));
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end).forEach((item) => { const parent = parents.find((candidate) => candidate.key === courseKey(item.course)); if (parent) items.push({ id: item.id, collection: "homework", time: item.time, detail: item.course, kind: "Homework", symbol: "○", title: item.title, meta: `Due ${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: parent.color, nested: true, sort: `${parent.sort}|1|${item.date}` }); });
  } else if (["all", "today", "homework", "tasks"].includes(view)) {
    homework.filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "homework", time: item.time, detail: item.course, kind: "Homework", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)} ${item.course || "Homework"}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#7eaed6", sort: `${item.date} ${item.time || "23:59"}` }));
  }
  if (["all", "events", "today", "exams", "tasks"].includes(view)) (data.exams || []).filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "exams", time: item.time, detail: item.course, kind: "Exam", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#6d9fd0", sort: `${item.date} ${item.time || "23:58"}` }));
  if (["all", "events", "today", "reminders", "tasks"].includes(view)) (data.reminders || []).filter((item) => item.status !== "done" && item.date >= today && item.date <= end && (view !== "today" || item.date === today)).forEach((item) => items.push({ id: item.id, collection: "reminders", time: item.time, detail: item.course, kind: "Reminder", symbol: "○", title: item.title, meta: `${dateLabel(item.date, today)}${item.time ? ` · ${formatTime(item.time)}` : ""}`, color: item.color || "#9abbd6", sort: `${item.date} ${item.time || "23:57"}` }));
  return items.filter(item => view !== 'all' || !item.sort.slice(11,16).match(/^\d{2}:\d{2}$/) || new Date(item.sort.slice(0,10)+'T'+(item.end || item.sort.slice(11,16))) >= now).filter(item => !previewCompleted.has(`${dataSourceSelect.value}:${item.collection}:${item.id}`)).sort((a, b) => a.sort.localeCompare(b.sort));
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
  for (const [key, value] of Object.entries(appearance)) {
    if (typeof value === 'string') document.documentElement.style.setProperty('--widget-' + key, value);
  }
  document.documentElement.style.colorScheme = appearance.dark ? 'dark' : 'light';

  const now = dataSourceSelect.value === "mine" ? new Date() : new Date(todayIso() + "T09:30");
  const today = todayIso();
  const all = getPreviewItems("all", now);
  const source = getPreviewItems(viewSelect.value, now);
  const headline = source.find(item => widgetCountdown(item, now).startsWith("Ends in")) || source.find(item => !item.collection) || source[0];
  const classes = previewData().schedule?.filter(item => item.type === 'class' && item.date === today).length || 0;
  const due = all.filter(item => item.collection && item.sort.slice(0, 10) === today).length;
  const summary = `${classes} ${classes === 1 ? 'class' : 'classes'} · ${due} ${due === 1 ? 'task' : 'tasks'} due today`;

  widgets.forEach(widget => {
    const small = widget.classList.contains("widget-small");
    const limit = Number(widget.dataset.limit);
    const preference = settings.widgetPreferences;
    const count = preference?.itemLimitMode === "manual" ? Math.min(limit, Number(preference.itemLimit) || limit) : limit;
    const dueToday = source.filter(item => item.collection && item.sort.slice(0, 10) === today);
    const agenda = (small ? dueToday.length ? dueToday : source.filter(item => item !== headline) : source).slice(0, count);
    const groups = new Map();
    for (const item of agenda) {
      const date = small && dueToday.length ? "Due today" : agendaDate(item.sort.slice(0, 10), today);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(item);
    }
    const sections = [...groups].map(([label, items]) => `<section class="widget-agenda"><div class="widget-section-title"><strong>${escapeHtml(label)}</strong><span>${items.length} ${items.length === 1 ? 'item' : 'items'}</span></div>${items.map(agendaRow).join('')}</section>`).join('');
    const timing = headline && widgetCountdown(headline, now);
    const feature = headline ? `<div class="widget-feature"><div class="widget-kicker">${timing.startsWith("Ends in") ? 'Now · ' + escapeHtml(timing) : 'Up next · ' + escapeHtml(itemTime(headline))}</div><div class="widget-feature-title">${escapeHtml(headline.title)}</div><div class="widget-meta">${escapeHtml(headline.featureMeta || agendaMeta(headline))}</div></div>` : '<div class="widget-feature"><div class="widget-feature-title">Nothing coming up</div></div>';
    widget.innerHTML = `<div class="widget-header"><strong>UniPlan</strong><span>${escapeHtml(dateLabelFull(today))}</span></div>
      <div class="widget-summary"><span>${summary}</span><a class="widget-pet" href="index.html?pet=open" target="_top" aria-label="Open your pet in UniPlan">${widgetPetSvg(settings.pet?.species || 'cat')}</a></div>
      ${feature}${sections}
      <div class="widget-footer"><span aria-hidden="true">✦</span> ${offline.checked ? 'Offline copy' : dataSourceSelect.value === "mine" ? "Your schedule" : "Sample schedule"}</div>`;
  });
}

function agendaRow(item) {
  const check = item.collection ? `<button type="button" class="widget-check" data-collection="${item.collection}" data-id="${escapeHtml(item.id)}" aria-label="Mark ${escapeHtml(item.title)} done" ${offline.checked ? 'disabled' : ''}>○</button>` : '';
  return `<div class="widget-row" style="--item-color:${safeColor(item.color)}"><span class="widget-time">${escapeHtml(itemTime(item))}</span><div class="widget-row-copy"><strong>${escapeHtml(item.title)}</strong><div class="widget-meta">${escapeHtml(agendaMeta(item))}</div></div>${check}</div>`;
}

function durationLabel(start, end) {
  if (!start || !end) return '';
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const length = minutes(end) - minutes(start);
  return length > 0 ? length + ' minutes' : '';
}
function itemTime(item) { return /^\d{2}:\d{2}$/.test(item.time || "") ? formatTime(item.time) : "Anytime"; }
function agendaMeta(item) { return [item.detail, item.kind].filter(Boolean).join(' · '); }
function dateLabelFull(date) {
  return new Date(date + 'T12:00').toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function agendaDate(date, today) {
  if (date === today) return "Today";
  return date === offsetDate(today, 1) ? "Tomorrow · " + dateLabelFull(date) : dateLabelFull(date);
}

function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function offsetDate(value, days) { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate()+days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function courseKey(value) { const match = String(value || "").match(/([A-Z]{2,}(?:\s+[A-Z])?\s*\d+[A-Z]?)/i); return (match?.[1] || value || "").replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function dateLabel(value, today) { if (value === today) return "Today"; return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); }
function formatTime(value) { if (!value) return ""; const [h,m] = value.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`; }
function safeColor(value) { return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#7eaed6"; }
function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }

viewSelect.addEventListener("change", renderWidgetPreviews); dataSourceSelect.addEventListener("change", renderWidgetPreviews); offline.addEventListener("change", renderWidgetPreviews);

window.addEventListener('storage', renderWidgetPreviews);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderWidgetPreviews);

widgets.forEach(widget => widget.addEventListener('click', event => {
  const button = event.target.closest('button[data-collection]');
  if (!button || offline.checked) return;
  previewCompleted.add(`${dataSourceSelect.value}:${button.dataset.collection}:${button.dataset.id}`);
  renderWidgetPreviews();
}));
viewSelect.value = 'all';
if (!new URLSearchParams(location.search).has('embedded')) dataSourceSelect.value = 'preset';
renderWidgetPreviews();

setInterval(renderWidgetPreviews, 60000);
