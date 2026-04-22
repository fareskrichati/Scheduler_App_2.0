const STORAGE_KEY = "pulse-planner-events";
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
  { id: "health", label: "Health" },
  { id: "study", label: "Study" },
];
const HOURS = Array.from({ length: 17 }, (_, index) => index + 6);

const state = {
  events: loadEvents(),
  selectedDate: todayString(),
  visibleWeekAnchor: todayString(),
  activeCategory: "all",
  searchTerm: "",
  agendaMode: "day",
};

const elements = {
  todayButton: document.querySelector("#today-button"),
  newEventButton: document.querySelector("#new-event-button"),
  duplicateDayButton: document.querySelector("#duplicate-day-button"),
  prevWeekButton: document.querySelector("#prev-week"),
  nextWeekButton: document.querySelector("#next-week"),
  weekStrip: document.querySelector("#week-strip"),
  weekRange: document.querySelector("#week-range"),
  selectedDateLabel: document.querySelector("#selected-date-label"),
  timeline: document.querySelector("#timeline"),
  agendaList: document.querySelector("#agenda-list"),
  agendaHeading: document.querySelector("#agenda-heading"),
  categoryFilters: document.querySelector("#category-filters"),
  searchInput: document.querySelector("#search-input"),
  agendaMode: document.querySelector("#agenda-mode"),
  todayHours: document.querySelector("#today-hours"),
  todaySummary: document.querySelector("#today-summary"),
  weekCount: document.querySelector("#week-count"),
  nextEventTitle: document.querySelector("#next-event-title"),
  nextEventTime: document.querySelector("#next-event-time"),
  dialog: document.querySelector("#event-dialog"),
  form: document.querySelector("#event-form"),
  formTitle: document.querySelector("#form-title"),
  closeDialog: document.querySelector("#close-dialog"),
  cancelButton: document.querySelector("#cancel-button"),
  deleteButton: document.querySelector("#delete-event-button"),
  eventId: document.querySelector("#event-id"),
  titleInput: document.querySelector("#title-input"),
  dateInput: document.querySelector("#date-input"),
  categoryInput: document.querySelector("#category-input"),
  startInput: document.querySelector("#start-input"),
  endInput: document.querySelector("#end-input"),
  locationInput: document.querySelector("#location-input"),
  completedInput: document.querySelector("#completed-input"),
  notesInput: document.querySelector("#notes-input"),
  timelineSlotTemplate: document.querySelector("#timeline-slot-template"),
};

initialize();

function initialize() {
  bindEvents();
  renderCategoryFilters();
  render();
}

function bindEvents() {
  elements.todayButton.addEventListener("click", () => {
    state.selectedDate = todayString();
    state.visibleWeekAnchor = state.selectedDate;
    render();
  });

  elements.newEventButton.addEventListener("click", () => {
    openForm();
  });

  elements.duplicateDayButton.addEventListener("click", () => {
    openForm({
      date: state.selectedDate,
      start: "09:00",
      end: "10:00",
      category: state.activeCategory === "all" ? "work" : state.activeCategory,
    });
  });

  elements.prevWeekButton.addEventListener("click", () => {
    state.visibleWeekAnchor = offsetDate(state.visibleWeekAnchor, -7);
    render();
  });

  elements.nextWeekButton.addEventListener("click", () => {
    state.visibleWeekAnchor = offsetDate(state.visibleWeekAnchor, 7);
    render();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim().toLowerCase();
    renderAgenda();
  });

  elements.agendaMode.addEventListener("change", (event) => {
    state.agendaMode = event.target.value;
    renderAgenda();
  });

  elements.closeDialog.addEventListener("click", closeForm);
  elements.cancelButton.addEventListener("click", closeForm);
  elements.deleteButton.addEventListener("click", handleDelete);

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSave();
  });

  elements.dialog.addEventListener("click", (event) => {
    const bounds = elements.form.getBoundingClientRect();
    const clickedOutside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (clickedOutside) {
      closeForm();
    }
  });
}

function render() {
  renderWeekStrip();
  renderTimeline();
  renderAgenda();
  renderStats();
}

function renderWeekStrip() {
  const weekDates = getWeekDates(state.visibleWeekAnchor);
  elements.weekStrip.innerHTML = "";
  elements.weekRange.textContent = formatWeekRange(weekDates);

  weekDates.forEach((date) => {
    const wrapper = document.createElement("div");
    const isSelected = date === state.selectedDate;
    const isToday = date === todayString();

    wrapper.className = [
      "day-pill",
      isSelected ? "is-selected" : "",
      isToday ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="day-name">${formatShortWeekday(date)}</span>
      <span class="day-number">${new Date(`${date}T00:00:00`).getDate()}</span>
    `;

    button.addEventListener("click", () => {
      state.selectedDate = date;
      render();
    });

    wrapper.appendChild(button);
    elements.weekStrip.appendChild(wrapper);
  });
}

function renderTimeline() {
  const selectedEvents = getEventsForDay(state.selectedDate);
  elements.selectedDateLabel.textContent = formatLongDate(state.selectedDate);
  elements.timeline.innerHTML = "";

  HOURS.forEach((hour) => {
    const fragment = elements.timelineSlotTemplate.content.cloneNode(true);
    const slot = fragment.querySelector(".timeline-slot");
    const timeLabel = fragment.querySelector(".timeline-time");
    const lane = fragment.querySelector(".timeline-lane");
    const slotEvents = selectedEvents.filter((event) => getHourFromTime(event.start) === hour);

    timeLabel.textContent = formatHourLabel(hour);

    if (!slotEvents.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "timeline-empty";
      emptyState.textContent = hour === 9 ? "Open block" : "";
      lane.appendChild(emptyState);
    } else {
      slotEvents.forEach((event) => {
        lane.appendChild(buildEventCard(event));
      });
    }

    elements.timeline.appendChild(slot);
  });
}

function renderAgenda() {
  const baseEvents =
    state.agendaMode === "day"
      ? getEventsForDay(state.selectedDate)
      : getEventsForWeek(state.visibleWeekAnchor);
  const filteredEvents = applyFilters(baseEvents);

  elements.agendaHeading.textContent =
    state.agendaMode === "day" ? "Selected day" : "Whole week";
  elements.agendaList.innerHTML = "";

  if (!filteredEvents.length) {
    const empty = document.createElement("div");
    empty.className = "agenda-empty";
    empty.textContent = "No events match the current filters.";
    elements.agendaList.appendChild(empty);
    return;
  }

  filteredEvents.forEach((event) => {
    elements.agendaList.appendChild(buildAgendaItem(event));
  });
}

function renderStats() {
  const today = todayString();
  const todaysEvents = getEventsForDay(today);
  const weeklyEvents = getEventsForWeek(state.visibleWeekAnchor);
  const totalHours = todaysEvents.reduce(
    (sum, event) => sum + getDurationHours(event.start, event.end),
    0,
  );
  const nextEvent = getNextEvent();

  elements.todayHours.textContent = `${trimHours(totalHours)}h`;
  elements.todaySummary.textContent = todaysEvents.length
    ? `${todaysEvents.length} event${todaysEvents.length === 1 ? "" : "s"} on deck`
    : "No events yet";
  elements.weekCount.textContent = String(weeklyEvents.length);
  elements.nextEventTitle.textContent = nextEvent ? nextEvent.title : "Clear slate";
  elements.nextEventTime.textContent = nextEvent
    ? `${formatLongDate(nextEvent.date)} at ${formatTimeRange(nextEvent.start, nextEvent.end)}`
    : "Add your first plan";
}

function renderCategoryFilters() {
  elements.categoryFilters.innerHTML = "";

  CATEGORIES.forEach((category) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = category.label;
    chip.className = `chip${state.activeCategory === category.id ? " is-active" : ""}`;

    chip.addEventListener("click", () => {
      state.activeCategory = category.id;
      renderCategoryFilters();
      renderAgenda();
    });

    elements.categoryFilters.appendChild(chip);
  });
}

function buildEventCard(event) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    "event-card",
    event.category,
    event.completed ? "is-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");

  button.innerHTML = `
    <div class="event-card-top">
      <span class="event-title">${escapeHtml(event.title)}</span>
      <span>${event.completed ? "Done" : categoryLabel(event.category)}</span>
    </div>
    <span class="event-meta">${formatTimeRange(event.start, event.end)}</span>
    <span class="event-meta">${escapeHtml(event.location || "No location set")}</span>
  `;

  button.addEventListener("click", () => openForm(event));
  return button;
}

function buildAgendaItem(event) {
  const article = document.createElement("button");
  article.type = "button";
  article.className = [
    "agenda-item",
    event.category,
    event.completed ? "is-complete" : "",
  ]
    .filter(Boolean)
    .join(" ");

  article.innerHTML = `
    <div class="agenda-top">
      <span class="agenda-title">${escapeHtml(event.title)}</span>
      <span class="agenda-meta">${formatTimeRange(event.start, event.end)}</span>
    </div>
    <div class="agenda-meta">${categoryLabel(event.category)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</div>
    <span class="agenda-date">${formatLongDate(event.date)}</span>
  `;

  article.addEventListener("click", () => openForm(event));
  return article;
}

function openForm(event = {}) {
  const date = event.date || state.selectedDate;
  const start = event.start || "09:00";
  const end = event.end || "10:00";

  elements.formTitle.textContent = event.id ? "Edit event" : "Create event";
  elements.deleteButton.hidden = !event.id;
  elements.eventId.value = event.id || "";
  elements.titleInput.value = event.title || "";
  elements.dateInput.value = date;
  elements.categoryInput.value = event.category || "work";
  elements.startInput.value = start;
  elements.endInput.value = end;
  elements.locationInput.value = event.location || "";
  elements.completedInput.checked = Boolean(event.completed);
  elements.notesInput.value = event.notes || "";

  elements.dialog.showModal();
}

function closeForm() {
  if (elements.dialog.open) {
    elements.dialog.close();
  }
}

function handleSave() {
  const id = elements.eventId.value || crypto.randomUUID();
  const payload = {
    id,
    title: elements.titleInput.value.trim(),
    date: elements.dateInput.value,
    category: elements.categoryInput.value,
    start: elements.startInput.value,
    end: elements.endInput.value,
    location: elements.locationInput.value.trim(),
    completed: elements.completedInput.checked,
    notes: elements.notesInput.value.trim(),
  };

  if (!payload.title || !payload.date || !payload.start || !payload.end) {
    return;
  }

  if (payload.end <= payload.start) {
    window.alert("End time needs to be after the start time.");
    return;
  }

  const existingIndex = state.events.findIndex((event) => event.id === id);

  if (existingIndex >= 0) {
    state.events.splice(existingIndex, 1, payload);
  } else {
    state.events.push(payload);
  }

  state.selectedDate = payload.date;
  state.visibleWeekAnchor = payload.date;
  saveEvents();
  closeForm();
  render();
}

function handleDelete() {
  const id = elements.eventId.value;

  if (!id) {
    closeForm();
    return;
  }

  state.events = state.events.filter((event) => event.id !== id);
  saveEvents();
  closeForm();
  render();
}

function applyFilters(events) {
  return [...events]
    .filter((event) => {
      if (state.activeCategory !== "all" && event.category !== state.activeCategory) {
        return false;
      }

      if (!state.searchTerm) {
        return true;
      }

      const searchable = `${event.title} ${event.location} ${event.notes}`.toLowerCase();
      return searchable.includes(state.searchTerm);
    })
    .sort(compareEvents);
}

function getEventsForDay(date) {
  return state.events.filter((event) => event.date === date).sort(compareEvents);
}

function getEventsForWeek(anchorDate) {
  const weekDates = new Set(getWeekDates(anchorDate));
  return state.events.filter((event) => weekDates.has(event.date)).sort(compareEvents);
}

function getNextEvent() {
  const now = new Date();
  return [...state.events]
    .sort(compareEvents)
    .find((event) => new Date(`${event.date}T${event.start}:00`) >= now && !event.completed);
}

function compareEvents(left, right) {
  return `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`);
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedEvents();
  } catch (error) {
    console.error("Failed to load stored events", error);
    return seedEvents();
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
}

function seedEvents() {
  const today = todayString();
  return [
    {
      id: crypto.randomUUID(),
      title: "Morning planning",
      date: today,
      category: "work",
      start: "09:00",
      end: "09:30",
      location: "Desk",
      completed: false,
      notes: "Review priorities and clear blockers.",
    },
    {
      id: crypto.randomUUID(),
      title: "Workout block",
      date: today,
      category: "health",
      start: "18:00",
      end: "19:00",
      location: "Gym",
      completed: false,
      notes: "",
    },
  ];
}

function getWeekDates(anchorDate) {
  const date = new Date(`${anchorDate}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return isoDate(current);
  });
}

function formatWeekRange(weekDates) {
  const start = new Date(`${weekDates[0]}T00:00:00`);
  const end = new Date(`${weekDates[6]}T00:00:00`);
  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function formatLongDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShortWeekday(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function formatTimeRange(start, end) {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHourLabel(hour) {
  return new Date(2024, 0, 1, hour).toLocaleTimeString([], {
    hour: "numeric",
  });
}

function getHourFromTime(time) {
  return Number(time.split(":")[0]);
}

function getDurationHours(start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60;
}

function trimHours(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function categoryLabel(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.label || "Other";
}

function todayString() {
  return isoDate(new Date());
}

function offsetDate(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
