const STORAGE_KEY = "pulse-planner-v2";
const AUTH_KEY = "pulse-planner-auth-v1";
const SESSION_KEY = "pulse-planner-session-v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLOR_MATCH_PREFIXES = ["class", "event", "homework", "exam", "reminder"];
const DONE_DISAPPEAR_DELAY_MS = 30000;
const NOTIFICATION_CHECK_INTERVAL_MS = 60000;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_SAVE_DELAY_MS = 1000;
const FOREVER_REPEAT_YEARS = 5;
const SUPABASE_TABLE = "planner_profiles";
const PLANNER_TABS = ["calendar", "todo", "classes", "events", "homework", "exams", "reminders", "settings"];

if (new URLSearchParams(window.location.search).get("scriptable") === "1") {
  document.documentElement.classList.add("scriptable-webview");
}

let completionSweepTimer = null;
let notificationTimer = null;
let autoSyncTimer = null;
let cloudSaveTimer = null;
let realtimeChannel = null;
let lastLocalSaveAt = 0;
let syncInProgress = false;
let schoolImportItems = [];
let detectedScheduleClasses = [];
let detectedHomeworkItems = [];
let detectedExamItems = [];
let detectedEventItems = [];
let pendingFirstLogin = null;
let lastCloudSyncMessage = "";
let supabaseSetupMessage = "";
let todoTypeFilter = "all";
let todoClassFilter = "all";
const supabaseClient = createSupabaseClient();
clearLegacyLocalLogin();
const savedAuthProfile = null;
let authMode = "login";

const state = {
  activeTab: getInitialTab(),
  selectedDate: todayString(),
  visibleMonth: startOfMonth(todayString()),
  calendarView: "week",
  calendarFilter: "all",
  data: loadData(),
};

const authState = {
  profile: savedAuthProfile,
  userId: "",
  isAuthenticated: supabaseClient
    ? false
    : Boolean(savedAuthProfile && localStorage.getItem(SESSION_KEY) === "active"),
};

const elements = {
  authScreen: document.querySelector("#auth-screen"),
  authTitle: document.querySelector("#auth-title"),
  loginForm: document.querySelector("#login-form"),
  loginEmail: document.querySelector("#login-email"),
  loginPassword: document.querySelector("#login-password"),
  loginSubmit: document.querySelector("#login-submit"),
  loginStatus: document.querySelector("#login-status"),
  authModeButtons: Array.from(document.querySelectorAll(".auth-mode-button")),
  profileSetupForm: document.querySelector("#profile-setup-form"),
  setupName: document.querySelector("#setup-name"),
  setupPhone: document.querySelector("#setup-phone"),
  setupStatus: document.querySelector("#setup-status"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
  statButtons: Array.from(document.querySelectorAll(".stat-button")),
  openSettings: document.querySelector("#open-settings"),
  openCanvas: document.querySelector("#open-canvas"),
  mobileQuickAdd: document.querySelector("#mobile-quick-add"),
  jumpToday: document.querySelector("#jump-today"),
  calendarToday: document.querySelector("#calendar-today"),
  quickAdd: document.querySelector("#quick-add"),
  quickAddDialog: document.querySelector("#quick-add-dialog"),
  quickAddType: document.querySelector("#quick-add-type"),
  quickAddContinue: document.querySelector("#quick-add-continue"),
  topbarSync: document.querySelector("#topbar-sync"),
  tabShell: document.querySelector(".tab-shell"),
  homeworkCount: document.querySelector("#homework-count"),
  examCount: document.querySelector("#exam-count"),
  todayClassesCount: document.querySelector("#today-classes-count"),
  reminderCount: document.querySelector("#reminder-count"),
  calendarMonthLabel: document.querySelector("#calendar-month-label"),
  calendarWeekdays: document.querySelector("#calendar-weekdays"),
  calendarGrid: document.querySelector("#calendar-grid"),
  selectedDateTitle: document.querySelector("#selected-date-title"),
  calendarDaySummary: document.querySelector("#calendar-day-summary"),
  todoList: document.querySelector("#todo-list"),
  todoCount: document.querySelector("#todo-count"),
  todoTypeFilter: document.querySelector("#todo-type-filter"),
  todoClassFilter: document.querySelector("#todo-class-filter"),
  prevMonth: document.querySelector("#prev-month"),
  nextMonth: document.querySelector("#next-month"),
  calendarViewButtons: Array.from(document.querySelectorAll("[data-calendar-view]")),
  calendarFilter: document.querySelector("#calendar-filter"),
  daySchedulerTitle: document.querySelector("#day-scheduler-title"),
  daySchedulerSummary: document.querySelector("#day-scheduler-summary"),
  classList: document.querySelector("#class-list"),
  eventList: document.querySelector("#event-list"),
  homeworkList: document.querySelector("#homework-list"),
  examList: document.querySelector("#exam-list"),
  reminderList: document.querySelector("#reminder-list"),
  itemTemplate: document.querySelector("#item-card-template"),
  classForm: document.querySelector("#class-form"),
  classId: document.querySelector("#class-id"),
  classTitle: document.querySelector("#class-title"),
  classOnline: document.querySelector("#class-online"),
  onlineClassHint: document.querySelector("#online-class-hint"),
  classDateLocationRow: document.querySelector("#class-date-location-row"),
  classTimeRow: document.querySelector("#class-time-row"),
  classRepeatBox: document.querySelector("#class-repeat-box"),
  classDate: document.querySelector("#class-date"),
  classLocation: document.querySelector("#class-location"),
  classStart: document.querySelector("#class-start"),
  classEnd: document.querySelector("#class-end"),
  classColor: document.querySelector("#class-color"),
  classRepeat: document.querySelector("#class-repeat"),
  classRepeatOptions: document.querySelector("#class-repeat-options"),
  classRepeatMode: document.querySelector("#class-repeat-mode"),
  classRepeatWeekdays: document.querySelector("#class-repeat-weekdays"),
  classRepeatDays: Array.from(document.querySelectorAll('input[name="class-repeat-day"]')),
  classRepeatUntil: document.querySelector("#class-repeat-until"),
  classRepeatForever: document.querySelector("#class-repeat-forever"),
  classMatchColor: document.querySelector("#class-match-color"),
  classMatchOptions: document.querySelector("#class-match-options"),
  classMatchSource: document.querySelector("#class-match-source"),
  classNotes: document.querySelector("#class-notes"),
  classReset: document.querySelector("#class-reset"),
  eventForm: document.querySelector("#event-form"),
  eventId: document.querySelector("#event-id"),
  eventTitle: document.querySelector("#event-title"),
  eventDate: document.querySelector("#event-date"),
  eventLocation: document.querySelector("#event-location"),
  eventStart: document.querySelector("#event-start"),
  eventEnd: document.querySelector("#event-end"),
  eventColor: document.querySelector("#event-color"),
  eventRepeat: document.querySelector("#event-repeat"),
  eventRepeatOptions: document.querySelector("#event-repeat-options"),
  eventRepeatMode: document.querySelector("#event-repeat-mode"),
  eventRepeatWeekdays: document.querySelector("#event-repeat-weekdays"),
  eventRepeatDays: Array.from(document.querySelectorAll('input[name="event-repeat-day"]')),
  eventRepeatUntil: document.querySelector("#event-repeat-until"),
  eventRepeatForever: document.querySelector("#event-repeat-forever"),
  eventMatchColor: document.querySelector("#event-match-color"),
  eventMatchOptions: document.querySelector("#event-match-options"),
  eventMatchSource: document.querySelector("#event-match-source"),
  eventNotes: document.querySelector("#event-notes"),
  eventReset: document.querySelector("#event-reset"),
  homeworkForm: document.querySelector("#homework-form"),
  homeworkId: document.querySelector("#homework-id"),
  homeworkTitle: document.querySelector("#homework-title"),
  homeworkClass: document.querySelector("#homework-class"),
  homeworkDate: document.querySelector("#homework-date"),
  homeworkTime: document.querySelector("#homework-time"),
  homeworkStatus: document.querySelector("#homework-status"),
  homeworkColor: document.querySelector("#homework-color"),
  homeworkPriority: document.querySelector("#homework-priority"),
  homeworkMatchColor: document.querySelector("#homework-match-color"),
  homeworkMatchOptions: document.querySelector("#homework-match-options"),
  homeworkMatchSource: document.querySelector("#homework-match-source"),
  homeworkRepeat: document.querySelector("#homework-repeat"),
  homeworkRepeatOptions: document.querySelector("#homework-repeat-options"),
  homeworkRepeatMode: document.querySelector("#homework-repeat-mode"),
  homeworkRepeatWeekdays: document.querySelector("#homework-repeat-weekdays"),
  homeworkRepeatDays: Array.from(document.querySelectorAll('input[name="homework-repeat-day"]')),
  homeworkRepeatUntil: document.querySelector("#homework-repeat-until"),
  homeworkRepeatForever: document.querySelector("#homework-repeat-forever"),
  homeworkNotes: document.querySelector("#homework-notes"),
  homeworkReset: document.querySelector("#homework-reset"),
  examForm: document.querySelector("#exam-form"),
  examId: document.querySelector("#exam-id"),
  examTitle: document.querySelector("#exam-title"),
  examCourse: document.querySelector("#exam-course"),
  examDate: document.querySelector("#exam-date"),
  examTime: document.querySelector("#exam-time"),
  examColor: document.querySelector("#exam-color"),
  examPriority: document.querySelector("#exam-priority"),
  examMatchColor: document.querySelector("#exam-match-color"),
  examMatchOptions: document.querySelector("#exam-match-options"),
  examMatchSource: document.querySelector("#exam-match-source"),
  examNotes: document.querySelector("#exam-notes"),
  examReset: document.querySelector("#exam-reset"),
  reminderForm: document.querySelector("#reminder-form"),
  reminderId: document.querySelector("#reminder-id"),
  reminderTitle: document.querySelector("#reminder-title"),
  reminderDate: document.querySelector("#reminder-date"),
  reminderTime: document.querySelector("#reminder-time"),
  reminderColor: document.querySelector("#reminder-color"),
  reminderPriority: document.querySelector("#reminder-priority"),
  reminderMatchColor: document.querySelector("#reminder-match-color"),
  reminderMatchOptions: document.querySelector("#reminder-match-options"),
  reminderMatchSource: document.querySelector("#reminder-match-source"),
  reminderRepeat: document.querySelector("#reminder-repeat"),
  reminderRepeatOptions: document.querySelector("#reminder-repeat-options"),
  reminderRepeatMode: document.querySelector("#reminder-repeat-mode"),
  reminderRepeatWeekdays: document.querySelector("#reminder-repeat-weekdays"),
  reminderRepeatDays: Array.from(document.querySelectorAll('input[name="reminder-repeat-day"]')),
  reminderRepeatUntil: document.querySelector("#reminder-repeat-until"),
  reminderRepeatForever: document.querySelector("#reminder-repeat-forever"),
  reminderNotes: document.querySelector("#reminder-notes"),
  reminderReset: document.querySelector("#reminder-reset"),
  settingsForm: document.querySelector("#settings-form"),
  settingsName: document.querySelector("#settings-name"),
  settingsEmail: document.querySelector("#settings-email"),
  settingsPhone: document.querySelector("#settings-phone"),
  settingsCurrentPassword: document.querySelector("#settings-current-password"),
  settingsNewPassword: document.querySelector("#settings-new-password"),
  settingsChangePassword: document.querySelector("#settings-change-password"),
  settingsSchoolAccountId: document.querySelector("#settings-school-account-id"),
  settingsSchool: document.querySelector("#settings-school"),
  settingsCanvasUrl: document.querySelector("#settings-canvas-url"),
  settingsCanvasFeed: document.querySelector("#settings-canvas-feed"),
  settingsCanvasShortcutSchool: document.querySelector("#settings-canvas-shortcut-school"),
  settingsCanvasShortcutUrl: document.querySelector("#settings-canvas-shortcut-url"),
  syncCanvasFeed: document.querySelector("#sync-canvas-feed"),
  canvasFeedStatus: document.querySelector("#canvas-feed-status"),
  settingsConnectCanvas: document.querySelector("#settings-connect-canvas"),
  settingsConnectClassroom: document.querySelector("#settings-connect-classroom"),
  settingsCanvasToken: document.querySelector("#settings-canvas-token"),
  settingsClassroomToken: document.querySelector("#settings-classroom-token"),
  settingsSchoolUsername: document.querySelector("#settings-school-username"),
  settingsSchoolPassword: document.querySelector("#settings-school-password"),
  settingsAddSchoolAccount: document.querySelector("#settings-add-school-account"),
  settingsClearSchoolAccount: document.querySelector("#settings-clear-school-account"),
  notificationPreference: Array.from(document.querySelectorAll('input[name="notification-preference"]')),
  notificationFrequency: Array.from(document.querySelectorAll('input[name="notification-frequency"]')),
  sendDaySchedulePdf: document.querySelector("#send-day-schedule-pdf"),
  widgetDefaultView: document.querySelector("#widget-default-view"),
  scriptableStartScreen: document.querySelector("#scriptable-start-screen"),
  widgetPlannerUrl: document.querySelector("#widget-planner-url"),
  widgetDaysAhead: document.querySelector("#widget-days-ahead"),
  widgetItemLimit: document.querySelector("#widget-item-limit"),
  widgetShowClasses: document.querySelector("#widget-show-classes"),
  widgetShowHomework: document.querySelector("#widget-show-homework"),
  widgetShowEvents: document.querySelector("#widget-show-events"),
  widgetShowExams: document.querySelector("#widget-show-exams"),
  widgetShowReminders: document.querySelector("#widget-show-reminders"),
  notifyHomework: document.querySelector("#notify-homework"),
  notifyEvents: document.querySelector("#notify-events"),
  notifyClasses: document.querySelector("#notify-classes"),
  notifyExams: document.querySelector("#notify-exams"),
  notifyReminders: document.querySelector("#notify-reminders"),
  notifyDayScheduler: document.querySelector("#notify-day-scheduler"),
  notifySchoolAccounts: document.querySelector("#notify-school-accounts"),
  notifySchoolImports: document.querySelector("#notify-school-imports"),
  notifySettings: document.querySelector("#notify-settings"),
  notifyCalendar: document.querySelector("#notify-calendar"),
  settingsLogout: document.querySelector("#settings-logout"),
  settingsReset: document.querySelector("#settings-reset"),
  settingsStatus: document.querySelector("#settings-status"),
  settingsSummaryTitle: document.querySelector("#settings-summary-title"),
  settingsSummary: document.querySelector("#settings-summary"),
  syncNow: document.querySelector("#sync-now"),
  passwordSummary: document.querySelector("#password-summary"),
  schoolAccountSummary: document.querySelector("#school-account-summary"),
  schoolImportPanels: Array.from(document.querySelectorAll("[data-school-import-panel]")),
  clearSchoolImports: Array.from(document.querySelectorAll("[data-clear-school-imports]")),
};

initialize();

async function initialize() {
  pruneExpiredCompletedItems();
  renderWeekdays();
  bindEvents();
  setupClassScheduleImport();
  setupHomeworkPhotoImport();
  setupExamPhotoImport();
  setupEventPhotoImport();
  setupWidgetSettingsPreview();
  setupWeeklyScheduleReminderSettings();
  setupSettingsAccordions();
  setupDesktopAddAccordions();
  setupMobileAddForms();
  await restoreSupabaseSession();
  syncSettingsFromAuthProfile();
  toggleRepeatOptions("class");
  toggleRepeatOptions("event");
  toggleRepeatOptions("homework");
  toggleRepeatOptions("reminder");
  toggleOnlineClassFields();
  COLOR_MATCH_PREFIXES.forEach((prefix) => {
    toggleMatchOptions(prefix);
  });
  render();
  updateAuthView();
  scheduleCompletionSweep();
  scheduleNotificationCheck();
  scheduleAutomaticSync();
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLoginSubmit();
  });

  elements.profileSetupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    finishFirstLoginSetup();
  });

  elements.authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authMode);
    });
  });

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab);
    });
  });

  elements.statButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });

  elements.openSettings.addEventListener("click", () => {
    setActiveTab("settings");
    elements.tabShell?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.openCanvas.addEventListener("click", openCanvasShortcut);

  const jumpToToday = () => {
    state.selectedDate = todayString();
    state.visibleMonth = startOfMonth(state.selectedDate);
    setActiveTab("calendar");
    render();
    elements.tabShell?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  elements.jumpToday.addEventListener("click", jumpToToday);
  elements.calendarToday.addEventListener("click", jumpToToday);

  elements.quickAdd.addEventListener("click", () => {
    elements.quickAddDialog.showModal();
  });
  elements.mobileQuickAdd?.addEventListener("click", () => {
    elements.quickAddDialog.showModal();
  });

  elements.quickAddContinue.addEventListener("click", (event) => {
    event.preventDefault();
    const tabId = elements.quickAddType.value;
    elements.quickAddDialog.close();
    setActiveTab(tabId);
    openMobileAddForm(tabId);
    getPrimaryFieldForTab(tabId)?.focus();
    elements.tabShell?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.prevMonth.addEventListener("click", () => {
    navigateCalendar(-1);
  });

  elements.nextMonth.addEventListener("click", () => {
    navigateCalendar(1);
  });
  setupCalendarSwipe();

  elements.calendarViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarView = button.dataset.calendarView;
      if (state.calendarView === "month") state.visibleMonth = startOfMonth(state.selectedDate);
      renderCalendar();
    });
  });
  elements.calendarFilter?.addEventListener("change", () => {
    state.calendarFilter = elements.calendarFilter.value;
    renderCalendar();
    renderSelectedDayViews();
  });

  elements.classForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveClassItem();
  });

  elements.classReset.addEventListener("click", resetClassForm);
  elements.classOnline.addEventListener("change", toggleOnlineClassFields);
  elements.classRepeat.addEventListener("change", () => {
    toggleRepeatOptions("class");
    ensureRepeatSelection("class");
  });
  elements.classRepeatMode.addEventListener("change", () => {
    toggleRepeatOptions("class");
    ensureRepeatSelection("class");
  });
  elements.classDate.addEventListener("change", () => syncRepeatSelectionWithDate("class"));
  elements.classMatchColor.addEventListener("change", () => toggleMatchOptions("class"));
  elements.classMatchSource.addEventListener("change", () => updateMatchedColorPreview("class"));
  elements.classRepeatForever.addEventListener("change", () => toggleRepeatOptions("class"));

  elements.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEventItem();
  });

  elements.eventReset.addEventListener("click", resetEventForm);
  elements.eventRepeat.addEventListener("change", () => {
    toggleRepeatOptions("event");
    ensureRepeatSelection("event");
  });
  elements.eventRepeatMode.addEventListener("change", () => {
    toggleRepeatOptions("event");
    ensureRepeatSelection("event");
  });
  elements.eventDate.addEventListener("change", () => syncRepeatSelectionWithDate("event"));
  elements.eventMatchColor.addEventListener("change", () => toggleMatchOptions("event"));
  elements.eventMatchSource.addEventListener("change", () => updateMatchedColorPreview("event"));
  elements.eventRepeatForever.addEventListener("change", () => toggleRepeatOptions("event"));

  elements.homeworkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveHomework();
  });

  elements.homeworkReset.addEventListener("click", resetHomeworkForm);
  elements.homeworkRepeat.addEventListener("change", () => {
    toggleRepeatOptions("homework");
    ensureRepeatSelection("homework");
  });
  elements.homeworkRepeatMode.addEventListener("change", () => {
    toggleRepeatOptions("homework");
    ensureRepeatSelection("homework");
  });
  elements.homeworkDate.addEventListener("change", () => syncRepeatSelectionWithDate("homework"));
  elements.homeworkMatchColor.addEventListener("change", () => toggleMatchOptions("homework"));
  elements.homeworkMatchSource.addEventListener("change", () => updateMatchedColorPreview("homework"));
  elements.homeworkRepeatForever.addEventListener("change", () => toggleRepeatOptions("homework"));
  elements.homeworkClass.addEventListener("change", () => applySelectedClassColor("homework"));
  elements.todoTypeFilter.addEventListener("change", () => { todoTypeFilter = elements.todoTypeFilter.value; renderTodoList(); });
  elements.todoClassFilter.addEventListener("change", () => { todoClassFilter = elements.todoClassFilter.value; renderTodoList(); });

  elements.examForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveExam();
  });

  elements.examReset.addEventListener("click", resetExamForm);
  elements.examMatchColor.addEventListener("change", () => toggleMatchOptions("exam"));
  elements.examMatchSource.addEventListener("change", () => updateMatchedColorPreview("exam"));
  elements.examCourse.addEventListener("change", () => applySelectedClassColor("exam"));

  elements.reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveReminder();
  });

  elements.reminderReset.addEventListener("click", resetReminderForm);
  elements.reminderRepeat.addEventListener("change", () => {
    toggleRepeatOptions("reminder");
    ensureRepeatSelection("reminder");
  });
  elements.reminderRepeatMode.addEventListener("change", () => {
    toggleRepeatOptions("reminder");
    ensureRepeatSelection("reminder");
  });
  elements.reminderDate.addEventListener("change", () => syncRepeatSelectionWithDate("reminder"));
  elements.reminderMatchColor.addEventListener("change", () => toggleMatchOptions("reminder"));
  elements.reminderMatchSource.addEventListener("change", () => updateMatchedColorPreview("reminder"));
  elements.reminderRepeatForever.addEventListener("change", () => toggleRepeatOptions("reminder"));

  elements.settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
  });

  elements.settingsReset.addEventListener("click", resetSettingsForm);
  elements.settingsLogout.addEventListener("click", logout);
  elements.settingsChangePassword.addEventListener("click", changeLoginPassword);
  elements.settingsAddSchoolAccount.addEventListener("click", saveSchoolAccountFromForm);
  elements.settingsClearSchoolAccount.addEventListener("click", clearSchoolAccountForm);
  elements.sendDaySchedulePdf.addEventListener("click", sendDaySchedulePdf);
  elements.syncNow.addEventListener("click", syncNow);
  elements.syncCanvasFeed.addEventListener("click", syncCanvasCalendarFeed);
  elements.schoolImportPanels.forEach((panel) => panel.addEventListener("toggle", () => {
    if (panel.open) refreshSchoolImports();
  }));
  elements.clearSchoolImports.forEach((button) => button.addEventListener("click", () => {
    schoolImportItems = [];
    renderSchoolImportItems("Import results cleared.");
  }));

  window.addEventListener("focus", () => {
    refreshCloudData();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      automaticSync();
    }
  });

  window.addEventListener("online", automaticSync);
}

function setupMobileAddForms() {
  if (!document.body.classList.contains("mobile-preview") && !window.matchMedia("(max-width: 760px)").matches) {
    return;
  }

  const labels = {
    classes: "class",
    events: "event",
    homework: "homework",
    exams: "exam",
    reminders: "reminder",
  };

  Object.entries(labels).forEach(([tabId, label]) => {
    const form = document.querySelector(`#${label === "class" ? "class" : label}-form`);
    if (!form) {
      return;
    }

    const originalParent = form.parentElement;
    const dialog = document.createElement("dialog");
    dialog.className = "mobile-form-dialog";
    dialog.dataset.formDialog = tabId;
    const dialogCard = document.createElement("div");
    dialogCard.className = "mobile-form-dialog-card";
    const dialogHeader = document.createElement("div");
    dialogHeader.className = "mobile-form-dialog-header";
    dialogHeader.innerHTML = `<strong>Add ${label}</strong>`;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-button";
    close.setAttribute("aria-label", `Close add ${label} popup`);
    close.textContent = "×";
    close.addEventListener("click", () => dialog.close());
    dialogHeader.appendChild(close);
    dialog.appendChild(dialogCard);
    dialogCard.append(dialogHeader, form);
    document.body.appendChild(dialog);
    form.classList.add("mobile-dialog-form");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "primary-button mobile-add-toggle";
    toggle.dataset.addForm = tabId;
    toggle.setAttribute("aria-controls", form.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = `Add ${label}`;
    toggle.addEventListener("click", () => {
      setMobileAddFormState(tabId, true);
      getPrimaryFieldForTab(tabId)?.focus();
    });

    originalParent.insertBefore(toggle, originalParent.firstChild);
    form.addEventListener("submit", () => {
      window.setTimeout(() => {
        if (dialog.open) dialog.close();
      }, 0);
    });
  });
}

function setupWidgetSettingsPreview() {
  const widgetSettings = elements.widgetDefaultView?.closest(".widget-settings");
  if (!widgetSettings || document.querySelector("#open-widget-preview")) return;
  const button = document.createElement("button"); button.id = "open-widget-preview"; button.type = "button"; button.className = "ghost-button widget-preview-button"; button.textContent = "Preview my widget";
  widgetSettings.appendChild(button);
  const dialog = document.createElement("dialog"); dialog.className = "widget-preview-dialog";
  dialog.innerHTML = `<div class="widget-preview-dialog-header"><div><p class="panel-label">Live preview</p><h3>Your widget</h3></div><button class="icon-button" type="button" aria-label="Close widget preview">×</button></div><iframe title="Daily Planner widget preview" src="widget-preview.html?embedded=1"></iframe>`;
  document.body.appendChild(dialog);
  button.addEventListener("click", () => { const frame = dialog.querySelector("iframe"); frame.src = `widget-preview.html?embedded=1&t=${Date.now()}`; dialog.showModal(); });
  dialog.querySelector("button").addEventListener("click", () => dialog.close());
}

function setupWeeklyScheduleReminderSettings() {
  const widgetSettings = elements.widgetDefaultView?.closest(".widget-settings");
  if (!widgetSettings || document.querySelector("#weekly-schedule-reminder")) return;
  const section = document.createElement("div"); section.className = "subsection weekly-reminder-settings";
  section.innerHTML = `<div class="subsection-header"><div><p class="panel-label">Weekly reminder</p><h3>Remember to review your schedule</h3></div></div><label class="checkbox-row"><input id="weekly-schedule-reminder" type="checkbox" /><span>Send me a reminder every week</span></label><div class="weekly-reminder-options"><div class="field-row"><label class="field"><span>Send by</span><select id="weekly-reminder-delivery"><option value="email">Email</option><option value="text">Text</option><option value="both">Email and text</option></select></label><label class="field"><span>Day</span><select id="weekly-reminder-day"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label><label class="field"><span>Time</span><input id="weekly-reminder-time" type="time" value="18:00" /></label></div><p class="settings-note">Email requires a valid email above. Text messages require a valid mobile number and may be subject to carrier messaging rates.</p></div>`;
  widgetSettings.parentElement.insertBefore(section, widgetSettings);
  section.querySelector("#weekly-schedule-reminder").addEventListener("change", toggleWeeklyReminderOptions);
}

function toggleWeeklyReminderOptions() {
  const enabled = document.querySelector("#weekly-schedule-reminder")?.checked;
  document.querySelector(".weekly-reminder-options")?.classList.toggle("is-disabled", !enabled);
  document.querySelectorAll(".weekly-reminder-options input, .weekly-reminder-options select").forEach((input) => { input.disabled = !enabled; });
}

function setupSettingsAccordions() {
  document.querySelectorAll("#panel-settings .subsection").forEach((section, index) => {
    if (section.closest("details.settings-accordion")) return;
    const heading = section.querySelector(".subsection-header .panel-label, .subsection-header h3")?.textContent?.trim() || `Settings group ${index + 1}`;
    const details = document.createElement("details");
    details.className = "settings-accordion";
    if (index === 0) details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = heading;
    section.parentElement.insertBefore(details, section);
    details.append(summary, section);
  });
}

function setupDesktopAddAccordions() {
  if (document.body.classList.contains("mobile-preview") || window.matchMedia("(max-width: 760px)").matches) return;
  const labels = { "class-form": "Add a class", "event-form": "Add an event", "homework-form": "Add homework", "exam-form": "Add an exam", "reminder-form": "Add a reminder" };
  Object.entries(labels).forEach(([formId, label]) => {
    const form = document.querySelector(`#${formId}`);
    if (!form || form.closest("details")) return;
    const details = document.createElement("details"); details.className = "desktop-add-accordion";
    const summary = document.createElement("summary"); summary.textContent = label;
    form.parentElement.insertBefore(details, form); details.append(summary, form);
    details.parentElement.classList.add("has-desktop-add-accordion");
  });
  const importer = document.querySelector("#schedule-import-card");
  if (importer && !importer.closest("details")) {
    const details = document.createElement("details"); details.className = "desktop-add-accordion schedule-import-accordion";
    const summary = document.createElement("summary"); summary.textContent = "Import a class schedule and school dates";
    importer.parentElement.insertBefore(details, importer); details.append(summary, importer);
  }
  document.querySelectorAll("[data-desktop-accordion-label]").forEach((section) => {
    if (section.closest("details")) return;
    const details = document.createElement("details"); details.className = "desktop-add-accordion";
    const summary = document.createElement("summary"); summary.textContent = section.dataset.desktopAccordionLabel;
    section.parentElement.insertBefore(details, section); details.append(summary, section);
  });
}

function setupHomeworkPhotoImport() {
  const homeworkPanel = elements.homeworkForm?.closest(".panel-card");
  if (!homeworkPanel || document.querySelector("#homework-photo-importer")) return;
  const importer = document.createElement("section");
  importer.id = "homework-photo-importer";
  importer.className = "homework-photo-importer";
  importer.dataset.desktopAccordionLabel = "Import homework from Canvas screenshots";
  importer.innerHTML = `
    <div class="subsection-header"><div><p class="panel-label">Canvas screenshots</p><h3>Import homework from photos</h3></div><button class="small-button homework-photo-help" id="homework-photo-help" type="button">How to do it</button></div>
    <p class="settings-note">Choose Canvas Grades, Assignments, Agenda, or To Do screenshots. Homework, discussions, quizzes, and exams can be detected together. Review every item before saving.</p>
    <label class="field"><span>Canvas screenshots</span><input id="homework-photo-files" type="file" accept="image/*" multiple /></label>
    <button class="primary-button" id="read-homework-photos" type="button">Read screenshots</button>
    <p class="settings-note" id="homework-photo-status" role="status"></p>
    <div id="homework-photo-review" hidden><div class="subsection-header"><div><p class="panel-label">Review</p><h3>Coursework found</h3></div></div><div id="detected-homework-list" class="detected-class-list"></div><button class="primary-button" id="save-detected-homework" type="button">Add reviewed coursework</button></div>`;
  homeworkPanel.insertBefore(importer, elements.homeworkForm);
  const helpDialog = document.createElement("dialog"); helpDialog.className = "quick-add-dialog homework-help-dialog";
  helpDialog.innerHTML = `<div class="quick-add-card"><div class="panel-header"><div><p class="panel-label">Best results</p><h3>How to screenshot Canvas</h3></div><button class="icon-button" type="button" aria-label="Close">×</button></div><ol><li>Open Canvas Grades, Assignments, Agenda, or the To Do list.</li><li>Keep each date heading, course name, assignment title, and due time visible.</li><li>Use clear, uncropped screenshots without menus covering the rows.</li><li>Take multiple screenshots if the list is long (up to four at once).</li><li>Review each detected type, class, and date before adding it.</li></ol></div>`;
  document.body.appendChild(helpDialog);
  helpDialog.querySelector("button").addEventListener("click", () => helpDialog.close());
  document.querySelector("#homework-photo-help").addEventListener("click", () => helpDialog.showModal());
  document.querySelector("#read-homework-photos").addEventListener("click", readHomeworkPhotos);
  document.querySelector("#save-detected-homework").addEventListener("click", saveDetectedHomework);
  setupMobileSectionPopup(importer, homeworkPanel, "Import Canvas homework");
}

async function readHomeworkPhotos() {
  const files = Array.from(document.querySelector("#homework-photo-files").files || []);
  const status = document.querySelector("#homework-photo-status");
  if (!files.length) { status.textContent = "Choose at least one Canvas screenshot."; return; }
  if (files.length > 4) { status.textContent = "Choose up to 4 screenshots at a time."; return; }
  const button = document.querySelector("#read-homework-photos"); button.disabled = true; status.textContent = "Reading Canvas rows and due dates…";
  try {
    if (window.location.protocol === "file:") throw new Error("Photo import needs the deployed Netlify site or Netlify Dev.");
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Sign in before importing Canvas screenshots.");
    const images = [];
    for (const file of files) images.push(await resizeImageForImport(file));
    const classes = getImportableClasses();
    const response = await fetch("/.netlify/functions/homework-photo-import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ images, currentDate: todayString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", knownCourses: classes.map((course) => course.title) }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error("The homework-photo-import function is not deployed yet. Redeploy the latest project first.");
    if (!response.ok) throw new Error(result.error || `Canvas screenshot import failed (${response.status}).`);
    const found = Array.isArray(result.items) ? result.items.map((item) => {
      const match = findMatchingImportedClass(item.course || "", classes);
      return { ...item, kind: item.kind === "exam" ? "exam" : "homework", course: match?.title || "", color: match?.color || "#7eaed6", notes: item.notes || "Imported from a Canvas screenshot." };
    }) : [];
    detectedHomeworkItems = dedupeDetectedHomework(found);
    if (!detectedHomeworkItems.length) throw new Error("No incomplete coursework with readable due dates was found. Keep the date heading, course, title, and due time visible.");
    renderDetectedHomework(); document.querySelector("#homework-photo-review").hidden = false;
    status.textContent = `Found ${detectedHomeworkItems.length} coursework item${detectedHomeworkItems.length === 1 ? "" : "s"}. Review the type, class, and due date before adding.`;
  } catch (error) { status.textContent = error.message || "The screenshots could not be read."; }
  finally { button.disabled = false; }
}

function getImportableClasses() {
  const map = new Map();
  state.data.courses.forEach((item) => {
    const key = importedCourseKey(item.title);
    if (!map.has(key)) map.set(key, { key, title: item.title, color: normalizeColor(item.color, "#7eaed6"), online: true });
  });
  state.data.schedule.filter((item) => item.type === "class").forEach((item) => {
    const key = importedCourseKey(item.title);
    if (!map.has(key)) map.set(key, { key, title: item.title, color: getStoredItemColor("schedule", item) });
  });
  return Array.from(map.values());
}

function renderClassCourseOptions() {
  const classes = getImportableClasses();
  [elements.homeworkClass, elements.examCourse].forEach((select) => {
    const current = select.value;
    select.innerHTML = '<option value="">Choose a class</option>';
    classes.forEach((course) => {
      const option = document.createElement("option");
      option.value = course.title;
      option.textContent = course.title;
      select.appendChild(option);
    });
    if (classes.some((course) => course.title === current)) select.value = current;
  });
}

function applySelectedClassColor(kind) {
  const select = kind === "homework" ? elements.homeworkClass : elements.examCourse;
  const colorInput = kind === "homework" ? elements.homeworkColor : elements.examColor;
  const course = getImportableClasses().find((item) => item.title === select.value);
  if (!course) return;
  colorInput.value = course.color;
  setMatchSelection(kind, "");
}

function colorForSelectedClass(courseTitle, fallback) {
  return getImportableClasses().find((item) => item.title === courseTitle)?.color || fallback;
}

function parseCanvasHomeworkText(text) {
  const lines = text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const classes = getImportableClasses();
  const items = [];
  lines.forEach((line, index) => {
    if (!/\b(due|available until|deadline)\b/i.test(line)) return;
    const dueText = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
    const due = parseHomeworkDueDate(dueText);
    if (!due.date) return;
    const nearby = lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 3));
    const classMatch = findMatchingImportedClass(nearby.join(" "), classes);
    const candidates = lines.slice(Math.max(0, index - 3), index).filter((value) => !/\b(due|points?|available|submitted|missing|assignment)\b/i.test(value) && !findMatchingImportedClass(value, classes));
    const title = candidates[candidates.length - 1] || lines[Math.max(0, index - 1)] || "Canvas assignment";
    items.push({ title, course: classMatch?.title || "", date: due.date, time: due.time, color: classMatch?.color || "#7eaed6", notes: "Imported from a Canvas screenshot." });
  });
  return items;
}

function parseHomeworkDueDate(value) {
  const numeric = value.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  const named = value.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  let year = new Date().getFullYear(), month, day;
  if (numeric) { month = Number(numeric[1]); day = Number(numeric[2]); if (numeric[3]) { year = Number(numeric[3]); if (year < 100) year += 2000; } }
  if (named) { month = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(named[1].slice(0, 3).toLowerCase()) + 1; day = Number(named[2]); if (named[3]) year = Number(named[3]); }
  if (!month || !day) return { date: "", time: "" };
  let date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!numeric?.[3] && !named?.[3] && date < todayString()) date = `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeMatch = value.match(/\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  return { date, time: timeMatch ? normalizeImportedTime(timeMatch[1]) : "" };
}

function importedCourseKey(value) {
  return (value.match(/([A-Z]{2,}(?:\s+[A-Z])?\s*\d+[A-Z]?)/i)?.[1] || value).replace(/\s+/g, " ").trim().toLowerCase();
}

function findMatchingImportedClass(text, classes = getImportableClasses()) {
  const normalized = text.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const canvasCode = importedCanvasCourseCode(text);
  return classes.find((item) => canvasCode && importedCanvasCourseCode(item.title) === canvasCode)
    || classes.find((item) => normalized.includes(item.key.replace(/[^a-z0-9]/gi, "")))
    || classes.find((item) => normalized.includes(item.title.replace(/[^a-z0-9]/gi, "").toLowerCase()));
}

function importedCanvasCourseCode(value) {
  const match = String(value || "").match(/\b([a-z]{2,})\s*[- ]?([a-z]?)\s*(\d{2,4})\b/i);
  return match ? `${match[1]}${match[2]}${match[3]}`.toLowerCase() : "";
}

function dedupeDetectedHomework(items) {
  const seen = new Set();
  return items.filter((item) => { const key = `${item.title.toLowerCase()}|${item.date}|${item.course.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function renderDetectedHomework() {
  const list = document.querySelector("#detected-homework-list");
  const classes = getImportableClasses(); list.innerHTML = "";
  detectedHomeworkItems.forEach((item, index) => {
    const card = document.createElement("article"); card.className = "detected-class-card";
    card.innerHTML = `<div class="field-row"><label class="field"><span>Coursework</span><input data-homework-field="title" value="${escapeHtml(item.title)}" /></label><label class="field"><span>Type</span><select data-homework-field="kind"><option value="homework"${item.kind !== "exam" ? " selected" : ""}>Homework</option><option value="exam"${item.kind === "exam" ? " selected" : ""}>Exam or quiz</option></select></label></div><div class="field-row"><label class="field"><span>Class</span><select data-homework-field="course"><option value="">Choose a class</option>${classes.map((course) => `<option value="${escapeHtml(course.title)}"${course.title === item.course ? " selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}</select></label><label class="field color-field"><span>Matching color</span><input data-homework-field="color" type="color" value="${item.color}" /></label></div><div class="field-row"><label class="field"><span>Due date</span><input data-homework-field="date" type="date" value="${item.date}" /></label><label class="field"><span>Due time</span><input data-homework-field="time" type="time" value="${item.time}" /></label></div><button class="small-button" type="button" data-remove-homework="${index}">Remove</button>`;
    card.querySelectorAll("[data-homework-field]").forEach((input) => input.addEventListener("input", () => {
      const field = input.dataset.homeworkField; detectedHomeworkItems[index][field] = input.value;
      if (field === "course") { const match = classes.find((course) => course.title === input.value); if (match) { detectedHomeworkItems[index].color = match.color; card.querySelector('[data-homework-field="color"]').value = match.color; } }
    }));
    card.querySelector("[data-remove-homework]").addEventListener("click", () => { detectedHomeworkItems.splice(index, 1); renderDetectedHomework(); });
    list.appendChild(card);
  });
}

function saveDetectedHomework() {
  const invalid = detectedHomeworkItems.find((item) => !item.title.trim() || !item.course || !item.date);
  const status = document.querySelector("#homework-photo-status");
  if (invalid) { status.textContent = "Each item needs a title, matching class, and due date."; return; }
  detectedHomeworkItems.forEach((item) => {
    const record = { id: crypto.randomUUID(), title: item.title.trim(), course: item.course, date: item.date, time: item.time, status: "pending", color: item.color, notes: item.notes, priority: false };
    (item.kind === "exam" ? state.data.exams : state.data.homework).push(record);
  });
  const count = detectedHomeworkItems.length; detectedHomeworkItems = [];
  document.querySelector("#homework-photo-review").hidden = true; persistAndRender();
  status.textContent = `${count} coursework item${count === 1 ? "" : "s"} added with matching class colors.`;
}

function setupEventPhotoImport() {
  const eventPanel = elements.eventForm?.closest(".panel-card");
  if (!eventPanel || document.querySelector("#event-photo-importer")) return;
  const importer = document.createElement("section");
  importer.id = "event-photo-importer";
  importer.className = "homework-photo-importer";
  importer.dataset.desktopAccordionLabel = "Import events from screenshots";
  importer.innerHTML = `
    <div class="subsection-header"><div><p class="panel-label">Event screenshots</p><h3>Import an event schedule</h3></div></div>
    <p class="settings-note">Upload screenshots of a sports, club, work, or other event schedule. The photo reader finds event names, dates, times, and locations. Review every event before saving.</p>
    <label class="field"><span>Schedule screenshots</span><input id="event-photo-files" type="file" accept="image/*" multiple /></label>
    <button class="primary-button" id="read-event-photos" type="button">Read event schedule</button>
    <p class="settings-note" id="event-photo-status" role="status"></p>
    <div id="event-photo-review" hidden><div class="subsection-header"><div><p class="panel-label">Review</p><h3>Events found</h3></div></div><div id="detected-event-list" class="detected-class-list"></div><button class="primary-button" id="save-detected-events" type="button">Add reviewed events</button></div>`;
  eventPanel.insertBefore(importer, elements.eventForm);
  document.querySelector("#read-event-photos").addEventListener("click", readEventPhotos);
  document.querySelector("#save-detected-events").addEventListener("click", saveDetectedEvents);
  setupMobileSectionPopup(importer, eventPanel, "Import event schedule");
}

function setupExamPhotoImport() {
  const examPanel = elements.examForm?.closest(".panel-card");
  if (!examPanel || document.querySelector("#exam-photo-importer")) return;
  const importer = document.createElement("section");
  importer.id = "exam-photo-importer";
  importer.className = "homework-photo-importer";
  importer.dataset.desktopAccordionLabel = "Import exams and quizzes from Canvas screenshots";
  importer.innerHTML = `<div class="subsection-header"><div><p class="panel-label">Canvas screenshots</p><h3>Import exams &amp; quizzes</h3></div></div><p class="settings-note">Choose Canvas screenshots that show the exam or quiz name, class, and date. Review every result before saving.</p><label class="field"><span>Canvas screenshots</span><input id="exam-photo-files" type="file" accept="image/*" multiple /></label><button class="primary-button" id="read-exam-photos" type="button">Read screenshots</button><p class="settings-note" id="exam-photo-status" role="status"></p><div id="exam-photo-review" hidden><div id="detected-exam-list" class="detected-class-list"></div><button class="primary-button" id="save-detected-exams" type="button">Add reviewed exams</button></div>`;
  examPanel.insertBefore(importer, elements.examForm);
  document.querySelector("#read-exam-photos").addEventListener("click", readExamPhotos);
  document.querySelector("#save-detected-exams").addEventListener("click", saveDetectedExams);
  setupMobileSectionPopup(importer, examPanel, "Import Canvas exams");
}

async function readExamPhotos() {
  const files = Array.from(document.querySelector("#exam-photo-files").files || []);
  const status = document.querySelector("#exam-photo-status");
  if (!files.length) { status.textContent = "Choose at least one Canvas screenshot."; return; }
  const button = document.querySelector("#read-exam-photos"); button.disabled = true; status.textContent = "Reading screenshots…";
  try {
    await loadExternalScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const found = [];
    for (const file of files) {
      const result = await window.Tesseract.recognize(file, "eng");
      found.push(...parseCanvasHomeworkText(result.data.text).filter((item) => /exam|quiz|test|midterm|final/i.test(item.title)));
    }
    detectedExamItems = dedupeDetectedHomework(found);
    if (!detectedExamItems.length) throw new Error("No dated exams or quizzes were found. Include the title and due date in the screenshot.");
    renderDetectedExams(); document.querySelector("#exam-photo-review").hidden = false;
    status.textContent = `Found ${detectedExamItems.length} exam or quiz item${detectedExamItems.length === 1 ? "" : "s"}.`;
  } catch (error) { status.textContent = error.message || "The screenshots could not be read."; }
  finally { button.disabled = false; }
}

function renderDetectedExams() {
  const list = document.querySelector("#detected-exam-list");
  const classes = getImportableClasses(); list.innerHTML = "";
  detectedExamItems.forEach((item, index) => {
    const card = document.createElement("article"); card.className = "detected-class-card";
    card.innerHTML = `<label class="field"><span>Exam or quiz</span><input data-exam-field="title" value="${escapeHtml(item.title)}"></label><div class="field-row"><label class="field"><span>Class</span><select data-exam-field="course"><option value="">Choose a class</option>${classes.map((course) => `<option value="${escapeHtml(course.title)}"${course.title === item.course ? " selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}</select></label><label class="field"><span>Date</span><input data-exam-field="date" type="date" value="${item.date}"></label><label class="field"><span>Time</span><input data-exam-field="time" type="time" value="${item.time}"></label></div><button class="small-button" type="button">Remove</button>`;
    card.querySelectorAll("[data-exam-field]").forEach((input) => input.addEventListener("input", () => { detectedExamItems[index][input.dataset.examField] = input.value; }));
    card.querySelector("button").addEventListener("click", () => { detectedExamItems.splice(index, 1); renderDetectedExams(); });
    list.appendChild(card);
  });
}

function saveDetectedExams() {
  const status = document.querySelector("#exam-photo-status");
  if (detectedExamItems.some((item) => !item.title.trim() || !item.course || !item.date)) { status.textContent = "Each item needs a title, class, and date."; return; }
  detectedExamItems.forEach((item) => state.data.exams.push({ id: crypto.randomUUID(), title: item.title.trim(), course: item.course, date: item.date, time: item.time, status: "pending", color: colorForSelectedClass(item.course, "#6d9fd0"), notes: "Imported from a Canvas screenshot." }));
  const count = detectedExamItems.length; detectedExamItems = []; document.querySelector("#exam-photo-review").hidden = true; persistAndRender(); status.textContent = `${count} exam or quiz item${count === 1 ? "" : "s"} added.`;
}

async function readEventPhotos() {
  const files = Array.from(document.querySelector("#event-photo-files").files || []);
  const status = document.querySelector("#event-photo-status");
  const button = document.querySelector("#read-event-photos");
  if (!files.length) { status.textContent = "Choose at least one schedule screenshot."; return; }
  if (files.length > 4) { status.textContent = "Choose up to 4 screenshots at a time."; return; }
  button.disabled = true;
  status.textContent = "Reading event names, dates, times, and locations…";
  try {
    if (window.location.protocol === "file:") throw new Error("Photo import needs the deployed Netlify site or Netlify Dev.");
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Sign in before importing an event schedule.");
    const images = [];
    for (const file of files) images.push(await resizeImageForImport(file));
    const response = await fetch("/.netlify/functions/event-photo-import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ images, currentDate: todayString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error("The event-photo-import function is not deployed yet. Redeploy the latest project first.");
    if (!response.ok) throw new Error(result.error || `Event schedule import failed (${response.status}).`);
    detectedEventItems = Array.isArray(result.events) ? result.events.map((item, index) => ({ ...item, color: classColorForIndex(index), notes: item.notes || "Imported from an event schedule screenshot." })) : [];
    if (!detectedEventItems.length) throw new Error("No dated events were found. Try a clearer screenshot that includes the schedule heading and dates.");
    renderDetectedEvents();
    document.querySelector("#event-photo-review").hidden = false;
    status.textContent = `Found ${detectedEventItems.length} event${detectedEventItems.length === 1 ? "" : "s"}. Review them before adding.`;
  } catch (error) {
    status.textContent = error.message || "The event screenshots could not be read.";
  } finally {
    button.disabled = false;
  }
}

function resizeImageForImport(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Could not read ${file.name}.`)); };
    image.src = objectUrl;
  });
}

function renderDetectedEvents() {
  const list = document.querySelector("#detected-event-list");
  list.innerHTML = "";
  detectedEventItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "detected-class-card";
    card.innerHTML = `<label class="field"><span>Event</span><input data-event-field="title" value="${escapeHtml(item.title || "")}" /></label><div class="field-row"><label class="field"><span>Date</span><input data-event-field="date" type="date" value="${item.date || ""}" /></label><label class="field"><span>Location</span><input data-event-field="location" value="${escapeHtml(item.location || "")}" /></label></div><div class="field-row"><label class="field"><span>Start</span><input data-event-field="start" type="time" value="${item.start || ""}" /></label><label class="field"><span>End</span><input data-event-field="end" type="time" value="${item.end || ""}" /></label><label class="field color-field"><span>Color</span><input data-event-field="color" type="color" value="${item.color}" /></label></div><label class="field"><span>Notes</span><textarea data-event-field="notes" rows="2">${escapeHtml(item.notes || "")}</textarea></label><button class="small-button" type="button" data-remove-event="${index}">Remove</button>`;
    card.querySelectorAll("[data-event-field]").forEach((input) => input.addEventListener("input", () => { detectedEventItems[index][input.dataset.eventField] = input.value; }));
    card.querySelector("[data-remove-event]").addEventListener("click", () => { detectedEventItems.splice(index, 1); renderDetectedEvents(); });
    list.appendChild(card);
  });
}

function saveDetectedEvents() {
  const invalid = detectedEventItems.find((item) => !item.title?.trim() || !item.date || !item.start || !item.end || item.end <= item.start);
  const status = document.querySelector("#event-photo-status");
  if (invalid) { status.textContent = "Each event needs a name, date, and an end time after its start time."; return; }
  detectedEventItems.forEach((item) => state.data.schedule.push({ id: crypto.randomUUID(), type: "event", title: item.title.trim(), date: item.date, start: item.start, end: item.end, location: (item.location || "").trim(), color: normalizeColor(item.color, "#7eaed6"), status: "pending", notes: (item.notes || "").trim() }));
  const count = detectedEventItems.length;
  detectedEventItems = [];
  document.querySelector("#event-photo-review").hidden = true;
  persistAndRender();
  status.textContent = `${count} event${count === 1 ? "" : "s"} added to your schedule.`;
}

function setupMobileSectionPopup(section, panel, label) {
  if (!document.body.classList.contains("mobile-preview") && !window.matchMedia("(max-width: 760px)").matches) return;
  const dialog = document.createElement("dialog"); dialog.className = "mobile-form-dialog";
  const card = document.createElement("div"); card.className = "mobile-form-dialog-card";
  const header = document.createElement("div"); header.className = "mobile-form-dialog-header"; header.innerHTML = `<strong>${label}</strong>`;
  const close = document.createElement("button"); close.type = "button"; close.className = "icon-button"; close.textContent = "×"; close.setAttribute("aria-label", `Close ${label}`); close.addEventListener("click", () => dialog.close());
  header.appendChild(close); card.append(header, section); dialog.appendChild(card); document.body.appendChild(dialog);
  const open = document.createElement("button"); open.type = "button"; open.className = "ghost-button mobile-import-toggle"; open.textContent = label; open.addEventListener("click", () => dialog.showModal()); panel.insertBefore(open, panel.firstChild);
}

function setupClassScheduleImport() {
  const classPanel = elements.classForm?.closest(".panel-card");
  if (!classPanel || document.querySelector("#schedule-import-card")) return;

  const importer = document.createElement("section");
  importer.id = "schedule-import-card";
  importer.className = "schedule-import-card";
  importer.innerHTML = `
    <div class="subsection-header"><div><p class="panel-label">Schedule importer</p><h3>Upload your class schedule</h3></div></div>
    <p class="settings-note">Upload a PDF, photo, or text file. You will review everything before classes are added.</p>
    <div class="schedule-import-primary-fields">
      <label class="field"><span>School name</span><input id="academic-school-name" type="text" placeholder="University or school name" /></label>
      <label class="field"><span>Academic year</span><input id="academic-year" type="text" placeholder="2026-2027" /></label>
      <label class="field"><span>Schedule system</span><select id="academic-term-system"><option value="semester">Semester</option><option value="quarter">Quarter</option><option value="trimester">Trimester</option></select></label>
      <label class="field"><span>Term name</span><input id="academic-term-name" type="text" placeholder="Fall 2026" /></label>
    </div>
    <div class="form-actions"><button class="ghost-button" id="find-school-calendar" type="button">Research and autofill official dates</button><button class="ghost-button" id="search-school-calendar-manually" type="button">Find calendar manually</button></div>
    <div id="academic-calendar-sources" class="academic-calendar-sources"></div>
    <p class="settings-note">The backend searches official school sources, fills the dates below, and leaves them editable for your review.</p>
    <div class="field-row">
      <label class="field"><span>Term starts</span><input id="semester-start" type="date" required /></label>
      <label class="field"><span>Term ends</span><input id="semester-end" type="date" required /></label>
    </div>
    <div class="subsection-header"><div><p class="panel-label">No-class dates</p><h3>Named breaks</h3></div><button class="ghost-button" id="add-academic-break" type="button">Add break</button></div>
    <div id="academic-break-list" class="academic-break-list"></div>
    <label class="field"><span>Schedule files</span><input id="schedule-files" type="file" accept=".pdf,image/*,.txt,.csv,.tsv" multiple /></label>
    <div class="form-actions"><button class="ghost-button" id="save-academic-calendar" type="button">Save school dates</button><button class="primary-button" id="extract-schedule" type="button">Read schedule files</button></div>
    <p class="settings-note" id="schedule-import-status" role="status"></p>
    <div id="schedule-extraction-review" hidden>
      <label class="field"><span>Extracted text — correct anything that was read incorrectly</span><textarea id="schedule-extracted-text" rows="8"></textarea></label>
      <button class="ghost-button" id="detect-schedule-classes" type="button">Find classes in this text</button>
    </div>
    <div id="schedule-class-review" hidden>
      <div class="subsection-header"><div><p class="panel-label">Review</p><h3>Classes found</h3></div></div>
      <div id="detected-class-list" class="detected-class-list"></div>
      <button class="primary-button" id="save-detected-classes" type="button">Add reviewed classes</button>
    </div>`;
  classPanel.insertBefore(importer, elements.classForm);

  document.querySelector("#extract-schedule").addEventListener("click", extractScheduleFiles);
  document.querySelector("#save-academic-calendar").addEventListener("click", saveAcademicCalendar);
  document.querySelector("#add-academic-break").addEventListener("click", () => addAcademicBreakRow());
  document.querySelector("#find-school-calendar").addEventListener("click", researchOfficialSchoolCalendar);
  document.querySelector("#search-school-calendar-manually").addEventListener("click", searchOfficialSchoolCalendarManually);
  document.querySelector("#detect-schedule-classes").addEventListener("click", detectScheduleClasses);
  document.querySelector("#save-detected-classes").addEventListener("click", saveDetectedClasses);
  syncAcademicCalendarInputs();
  setupMobileImporterPopup(importer, classPanel);
  checkAcademicCalendarBackend();
}

async function checkAcademicCalendarBackend() {
  const status = document.querySelector("#schedule-import-status");
  try {
    const response = await fetch("/.netlify/functions/academic-calendar", { headers: { Accept: "application/json" } });
    if (response.status === 404) { status.textContent = "Automatic research backend was not deployed. Redeploy the site with Netlify Functions enabled."; return; }
    const result = await response.json();
    if (!result.configured) status.textContent = `Automatic research is missing these Netlify environment variables: ${(result.missing || []).join(", ") || "backend configuration"}.`;
  } catch (_) {
    status.textContent = "Automatic research is unavailable in this local/static preview. It works through the deployed Netlify backend.";
  }
}

function setupMobileImporterPopup(importer, classPanel) {
  if (!document.body.classList.contains("mobile-preview") && !window.matchMedia("(max-width: 760px)").matches) return;
  const dialog = document.createElement("dialog");
  dialog.className = "mobile-form-dialog schedule-import-dialog";
  const card = document.createElement("div");
  card.className = "mobile-form-dialog-card";
  const header = document.createElement("div");
  header.className = "mobile-form-dialog-header";
  header.innerHTML = "<strong>Import class schedule</strong>";
  const close = document.createElement("button"); close.type = "button"; close.className = "icon-button"; close.textContent = "×"; close.setAttribute("aria-label", "Close schedule importer"); close.addEventListener("click", () => dialog.close());
  header.appendChild(close); card.append(header, importer); dialog.appendChild(card); document.body.appendChild(dialog);
  const open = document.createElement("button"); open.type = "button"; open.className = "ghost-button mobile-import-toggle"; open.textContent = "Import schedule"; open.addEventListener("click", () => dialog.showModal());
  classPanel.insertBefore(open, classPanel.firstChild);
}

function readAcademicCalendarInputs() {
  const start = document.querySelector("#semester-start").value;
  const end = document.querySelector("#semester-end").value;
  const breaks = Array.from(document.querySelectorAll(".academic-break-row")).map((row) => ({ name: row.querySelector('[data-break="name"]').value.trim(), start: row.querySelector('[data-break="start"]').value, end: row.querySelector('[data-break="end"]').value })).filter((range) => range.start && range.end);
  return { schoolName: document.querySelector("#academic-school-name").value.trim(), academicYear: document.querySelector("#academic-year").value.trim(), termSystem: document.querySelector("#academic-term-system").value, termName: document.querySelector("#academic-term-name").value.trim(), start, end, breaks };
}

function saveAcademicCalendar() {
  const calendar = readAcademicCalendarInputs();
  const status = document.querySelector("#schedule-import-status");
  if (!calendar.start || !calendar.end || calendar.end < calendar.start) {
    status.textContent = "Enter a valid semester start and end date.";
    return false;
  }
  if (calendar.breaks.some((range) => !range.name || range.end < range.start)) {
    status.textContent = "Each break needs a name and a valid start and end date.";
    return false;
  }
  state.data.settings.academicCalendar = calendar;
  state.data.schedule = state.data.schedule.filter((item) => item.type !== "class" || isActiveClassDate(item.date, calendar));
  persistAndRender();
  status.textContent = "School dates saved. Classes during breaks or after the semester were removed; other events were untouched.";
  return true;
}

function isActiveClassDate(date, calendar = state.data.settings.academicCalendar) {
  if (!calendar?.start || !calendar?.end) return true;
  if (date < calendar.start || date > calendar.end) return false;
  return !(calendar.breaks || []).some((range) => date >= range.start && date <= range.end);
}

function syncAcademicCalendarInputs() {
  const calendar = state.data.settings.academicCalendar || {};
  document.querySelector("#semester-start").value = calendar.start || "";
  document.querySelector("#semester-end").value = calendar.end || "";
  document.querySelector("#academic-school-name").value = calendar.schoolName || "";
  document.querySelector("#academic-year").value = calendar.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  document.querySelector("#academic-term-system").value = calendar.termSystem || "semester";
  document.querySelector("#academic-term-name").value = calendar.termName || "";
  const list = document.querySelector("#academic-break-list"); list.innerHTML = "";
  (calendar.breaks || []).forEach(addAcademicBreakRow);
  if (!(calendar.breaks || []).length) addAcademicBreakRow();
}

function addAcademicBreakRow(range = {}) {
  const list = document.querySelector("#academic-break-list");
  const row = document.createElement("div"); row.className = "academic-break-row";
  row.innerHTML = `<label class="field"><span>Break name</span><input data-break="name" value="${escapeHtml(range.name || "")}" placeholder="Winter break" /></label><label class="field"><span>Starts</span><input data-break="start" type="date" value="${range.start || ""}" /></label><label class="field"><span>Ends</span><input data-break="end" type="date" value="${range.end || ""}" /></label><button class="small-button" type="button">Delete</button>`;
  row.querySelector("button").addEventListener("click", () => row.remove()); list.appendChild(row);
}

async function researchOfficialSchoolCalendar() {
  const school = document.querySelector("#academic-school-name").value.trim();
  const academicYear = document.querySelector("#academic-year").value.trim();
  const term = document.querySelector("#academic-term-name").value.trim();
  const status = document.querySelector("#schedule-import-status");
  const button = document.querySelector("#find-school-calendar");
  if (!school || !academicYear) { status.textContent = "Enter your school name and academic year first."; return; }
  button.disabled = true; status.textContent = "Researching official school sources…";
  try {
    if (window.location.protocol === "file:") throw new Error("Research needs the Netlify backend. Open the deployed Netlify site, or run the project with Netlify Dev instead of opening the HTML file directly.");
    const accessToken = await getValidAccessToken();
    if (!accessToken) throw new Error("Sign in before researching a school calendar.");
    const response = await fetch("/.netlify/functions/academic-calendar", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ schoolName: school, academicYear, termSystem: document.querySelector("#academic-term-system").value, termName: term }) });
    const result = await response.json().catch(() => ({}));
    if (response.status === 404) throw new Error("The academic-calendar Netlify Function was not deployed. Trigger a new Netlify deploy from the latest code.");
    if (!response.ok) throw new Error(result.error || `School-calendar research failed (${response.status}).`);
    document.querySelector("#academic-school-name").value = result.schoolName || school;
    document.querySelector("#academic-year").value = result.academicYear || academicYear;
    document.querySelector("#academic-term-system").value = result.termSystem;
    document.querySelector("#academic-term-name").value = result.termName;
    document.querySelector("#semester-start").value = result.start;
    document.querySelector("#semester-end").value = result.end;
    const list = document.querySelector("#academic-break-list"); list.innerHTML = ""; result.breaks.forEach(addAcademicBreakRow); if (!result.breaks.length) addAcademicBreakRow();
    document.querySelector("#academic-calendar-sources").innerHTML = `<p class="settings-note"><strong>Confidence:</strong> ${escapeHtml(result.confidence)}. ${escapeHtml(result.notes)}</p>${result.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`).join("")}`;
    status.textContent = "Official dates found and autofilled. Review them, then save school dates.";
  } catch (error) { status.textContent = error.message || "School-calendar research failed."; }
  finally { button.disabled = false; }
}

function searchOfficialSchoolCalendarManually() {
  const school = document.querySelector("#academic-school-name").value.trim();
  const academicYear = document.querySelector("#academic-year").value.trim();
  const term = document.querySelector("#academic-term-name").value.trim();
  const status = document.querySelector("#schedule-import-status");
  if (!school || !academicYear) {
    status.textContent = "Enter your school name and academic year first.";
    return;
  }
  const query = [school, academicYear, term, "official academic calendar term dates breaks"].filter(Boolean).join(" ");
  const searchWindow = window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
  if (!searchWindow) {
    status.textContent = "Your browser blocked the search tab. Allow pop-ups for this site and try again.";
    return;
  }
  searchWindow.opener = null;
  status.textContent = "Official-calendar search opened. Use the school's own website, then enter the term dates and named breaks below and click Save school dates.";
}

async function extractScheduleFiles() {
  const files = Array.from(document.querySelector("#schedule-files").files || []);
  const status = document.querySelector("#schedule-import-status");
  if (!files.length) { status.textContent = "Choose at least one schedule file."; return; }
  status.textContent = "Reading your schedule…";
  try {
    const parts = [];
    for (const file of files) parts.push(await extractTextFromScheduleFile(file));
    document.querySelector("#schedule-extracted-text").value = parts.filter(Boolean).join("\n\n");
    document.querySelector("#schedule-extraction-review").hidden = false;
    status.textContent = "Schedule read. Review the extracted text, then find classes.";
  } catch (error) {
    status.textContent = error.message || "The schedule could not be read.";
  }
}

async function extractTextFromScheduleFile(file) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error("PDF reader did not load. Try a photo or text file.");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      pages.push(pdfTextItemsToLines(content.items));
    }
    return pages.join("\n");
  }
  if (file.type.startsWith("image/")) {
    await loadExternalScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    if (!window.Tesseract) throw new Error("Photo reader did not load. Try a PDF or text file.");
    const result = await window.Tesseract.recognize(file, "eng");
    return result.data.text;
  }
  return file.text();
}

function pdfTextItemsToLines(items) {
  const lines = [];
  items.filter((item) => item.str?.trim()).forEach((item) => {
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let line = lines.find((candidate) => Math.abs(candidate.y - y) < 2.5);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, text: item.str.trim() });
  });
  return lines.sort((a, b) => b.y - a.y).map((line) => line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ")).join("\n");
}

function detectScheduleClasses() {
  const text = document.querySelector("#schedule-extracted-text").value.trim();
  const status = document.querySelector("#schedule-import-status");
  if (!text) { status.textContent = "There is no schedule text to review."; return; }
  detectedScheduleClasses = parseClassScheduleText(text);
  if (!detectedScheduleClasses.length) {
    detectedScheduleClasses = [{ title: "", days: [], start: "", end: "", location: "", color: classColorForIndex(0) }];
    status.textContent = "No complete class rows were detected. Add or correct a class below.";
  } else {
    status.textContent = `Found ${detectedScheduleClasses.length} class${detectedScheduleClasses.length === 1 ? "" : "es"}. Review before adding.`;
  }
  renderDetectedClasses();
  document.querySelector("#schedule-class-review").hidden = false;
}

function parseClassScheduleText(text) {
  const weeklyTable = parseWeeklyScheduleTable(text);
  if (weeklyTable.length) return applyConsistentImportedClassColors(weeklyTable);
  const dayPattern = "(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?|MWF|TR|TTh|MW|WF)";
  const timePattern = "(\\d{1,2}(?::\\d{2})?\\s*(?:AM|PM)?)";
  const detected = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const daysMatch = line.match(new RegExp(`\\b(${dayPattern}(?:[\\s,\\/&-]+${dayPattern})*)\\b`, "i"));
    const times = [...line.matchAll(new RegExp(timePattern, "gi"))].map((match) => normalizeImportedTime(match[1])).filter(Boolean);
    if (!daysMatch || times.length < 1) return null;
    const title = line.slice(0, daysMatch.index).replace(/[|,;:-]+$/, "").trim() || `Class ${index + 1}`;
    const remainder = line.slice((daysMatch.index || 0) + daysMatch[0].length).replace(new RegExp(timePattern, "gi"), "").replace(/^[\s|,;:-]+/, "").trim();
    return { title, days: parseImportedDays(daysMatch[0]), start: times[0], end: times[1] || offsetTime(times[0], 60), location: remainder, color: classColorForIndex(index) };
  }).filter(Boolean);
  return applyConsistentImportedClassColors(detected);
}

function parseWeeklyScheduleTable(text) {
  const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  let currentDay = null;
  const occurrences = [];
  text.split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).forEach((line) => {
    const dayHeader = line.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)(?:\s+[A-Z][a-z]+)?(?:\s+\d{1,2})?$/i);
    if (dayHeader) { currentDay = dayMap[dayHeader[1].toLowerCase()]; return; }
    if (currentDay === null) return;
    const row = line.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s+(.+)$/i);
    if (!row) return;
    const statusMatch = row[2].match(/\s+Status:\s*(\w+)/i);
    const status = (statusMatch?.[1] || "enrolled").toLowerCase();
    if (!["enrolled", "active", "registered"].includes(status)) return;
    const withoutStatus = row[2].replace(/\s+Status:\s*\w+.*$/i, "").trim();
    const roomSplit = withoutStatus.match(/^(.+?)\s+Room:\s*(.+)$/i);
    const title = (roomSplit?.[1] || withoutStatus).trim();
    const location = (roomSplit?.[2] || "").trim();
    const start = normalizeImportedTime(row[1]);
    if (start && title) occurrences.push({ title, day: currentDay, start, end: offsetTime(start, 60), location });
  });
  const grouped = new Map();
  occurrences.forEach((item) => {
    const key = `${item.title.toLowerCase()}|${item.start}|${item.location.toLowerCase()}`;
    if (!grouped.has(key)) grouped.set(key, { title: item.title, days: [], start: item.start, end: item.end, location: item.location });
    grouped.get(key).days.push(item.day);
  });
  return Array.from(grouped.values()).map((item) => ({ ...item, days: [...new Set(item.days)].sort() }));
}

function applyConsistentImportedClassColors(items) {
  const colors = new Map();
  return items.map((item) => {
    const courseMatch = item.title.match(/^([A-Z]{2,}(?:\s+[A-Z])?\s*\d+[A-Z]?)/i);
    const key = (courseMatch?.[1] || item.title).replace(/\s+/g, " ").trim().toLowerCase();
    if (!colors.has(key)) colors.set(key, classColorForIndex(colors.size));
    return { ...item, color: colors.get(key) };
  });
}

function parseImportedDays(value) {
  const compact = value.replace(/\s+/g, "").toLowerCase();
  if (compact === "mwf") return [1, 3, 5];
  if (["tr", "tth"].includes(compact)) return [2, 4];
  if (compact === "mw") return [1, 3];
  if (compact === "wf") return [3, 5];
  const map = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
  return [...new Set(value.toLowerCase().split(/[\s,\/&-]+/).map((part) => map[part]).filter((day) => day !== undefined))];
}

function normalizeImportedTime(value) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (match[3]?.toLowerCase() === "pm" && hour < 12) hour += 12;
  if (match[3]?.toLowerCase() === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function offsetTime(value, minutes) {
  const [hour, minute] = value.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function classColorForIndex(index) {
  return ["#7eaed6", "#3f8091", "#9b78c6", "#d08a65", "#6f9d72", "#b58b3f", "#667fc4", "#b36f8d"][index % 8];
}

function renderDetectedClasses() {
  const list = document.querySelector("#detected-class-list");
  list.innerHTML = "";
  detectedScheduleClasses.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "detected-class-card";
    row.innerHTML = `
      <label class="field"><span>Class name</span><input data-import-field="title" value="${escapeHtml(item.title)}" /></label>
      <div class="field-row"><label class="field"><span>Days (Mon, Wed, Fri)</span><input data-import-field="days" value="${escapeHtml(item.days.map((day) => WEEKDAYS[day]).join(", "))}" /></label><label class="field"><span>Location</span><input data-import-field="location" value="${escapeHtml(item.location)}" /></label></div>
      <div class="field-row"><label class="field"><span>Start</span><input data-import-field="start" type="time" value="${item.start}" /></label><label class="field"><span>End</span><input data-import-field="end" type="time" value="${item.end}" /></label><label class="field color-field"><span>Color</span><input data-import-field="color" type="color" value="${item.color}" /></label></div>
      <button class="small-button" type="button" data-remove-import="${index}">Remove</button>`;
    row.querySelectorAll("[data-import-field]").forEach((input) => input.addEventListener("input", () => {
      const field = input.dataset.importField;
      detectedScheduleClasses[index][field] = field === "days" ? parseImportedDays(input.value) : input.value;
    }));
    row.querySelector("[data-remove-import]").addEventListener("click", () => { detectedScheduleClasses.splice(index, 1); renderDetectedClasses(); });
    list.appendChild(row);
  });
  const add = document.createElement("button");
  add.type = "button"; add.className = "ghost-button"; add.textContent = "Add another class";
  add.addEventListener("click", () => { detectedScheduleClasses.push({ title: "", days: [], start: "", end: "", location: "", color: classColorForIndex(detectedScheduleClasses.length) }); renderDetectedClasses(); });
  list.appendChild(add);
}

function saveDetectedClasses() {
  if (!saveAcademicCalendar()) return;
  const calendar = state.data.settings.academicCalendar;
  const invalid = detectedScheduleClasses.find((item) => !item.title.trim() || !item.days.length || !item.start || !item.end);
  if (invalid) {
    document.querySelector("#schedule-import-status").textContent = "Every class needs a name, at least one weekday, a start time, and an end time.";
    return;
  }
  detectedScheduleClasses.forEach((item) => {
    const seriesId = crypto.randomUUID();
    let date = new Date(`${calendar.start}T12:00:00`);
    const end = new Date(`${calendar.end}T12:00:00`);
    while (date <= end) {
      const dateString = isoDate(date);
      if (item.days.includes(date.getDay()) && isActiveClassDate(dateString, calendar)) {
        state.data.schedule.push({ id: crypto.randomUUID(), type: "class", title: item.title.trim(), date: dateString, start: item.start, end: item.end, location: item.location.trim(), color: item.color, notes: "Imported from uploaded class schedule.", status: "pending", repeatMode: "weekly", repeatForever: false, seriesId });
      }
      date.setDate(date.getDate() + 1);
    }
  });
  const count = detectedScheduleClasses.length;
  detectedScheduleClasses = [];
  document.querySelector("#schedule-class-review").hidden = true;
  persistAndRender();
  document.querySelector("#schedule-import-status").textContent = `${count} class${count === 1 ? "" : "es"} added with consistent colors and school breaks excluded.`;
}

function loadExternalScript(src, isModule = false) {
  if (document.querySelector(`script[data-schedule-reader="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.dataset.scheduleReader = src;
    if (isModule) script.type = "module";
    script.onload = resolve;
    script.onerror = () => reject(new Error("The file reader could not load. Check your connection."));
    document.head.appendChild(script);
  });
}

function openMobileAddForm(tabId) {
  const formIds = {
    classes: "class-form",
    events: "event-form",
    homework: "homework-form",
    exams: "exam-form",
    reminders: "reminder-form",
  };
  const form = document.querySelector(`#${formIds[tabId] || ""}`);
  const desktopDropdown = form?.closest("details.desktop-add-accordion");
  if (desktopDropdown) {
    desktopDropdown.open = true;
    window.setTimeout(() => {
      desktopDropdown.scrollIntoView({ behavior: "smooth", block: "start" });
      getPrimaryFieldForTab(tabId)?.focus({ preventScroll: true });
    }, 0);
    return;
  }
  setMobileAddFormState(tabId, true);
}

function setMobileAddFormState(tabId, isOpen) {
  const formIds = {
    classes: "class-form",
    events: "event-form",
    homework: "homework-form",
    exams: "exam-form",
    reminders: "reminder-form",
  };
  const labels = {
    classes: "class",
    events: "event",
    homework: "homework",
    exams: "exam",
    reminders: "reminder",
  };
  const form = document.querySelector(`#${formIds[tabId] || ""}`);
  const toggle = document.querySelector(`[data-add-form="${tabId}"]`);
  const dialog = document.querySelector(`[data-form-dialog="${tabId}"]`);

  if (!form || !toggle) {
    return;
  }

  if (isOpen && dialog && !dialog.open) dialog.showModal();
  if (!isOpen && dialog?.open) dialog.close();
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.textContent = `Add ${labels[tabId]}`;
}

async function handleLoginSubmit() {
  const email = elements.loginEmail.value.trim().toLowerCase();
  const password = elements.loginPassword.value;

  elements.loginStatus.textContent = "";

  if (!isValidEmail(email)) {
    elements.loginStatus.textContent = "Enter a valid email address.";
    elements.loginEmail.focus();
    return;
  }

  if (password.trim().length < 6) {
    elements.loginStatus.textContent = "Password needs at least 6 characters.";
    elements.loginPassword.focus();
    return;
  }

  if (authMode === "signup") {
    pendingFirstLogin = { email, password };
    elements.loginForm.hidden = true;
    elements.profileSetupForm.hidden = false;
    elements.authTitle.textContent = "Finish your profile";
    elements.setupName.value = getSettings().name;
    elements.setupPhone.value = getSettings().phone;
    elements.setupName.focus();
    return;
  }

  if (!supabaseClient) {
    elements.loginStatus.textContent =
      supabaseSetupMessage || "Supabase is not connected. Check the site scripts and config.";
    setAuthMode("login", { keepStatus: true });
    return;
  }

  await loginWithSupabase(email, password);
}

async function finishFirstLoginSetup() {
  const fullName = elements.setupName.value.trim();
  const phone = elements.setupPhone.value.trim();

  elements.setupStatus.textContent = "";

  if (!pendingFirstLogin) {
    elements.setupStatus.textContent = "Start with your email and password first.";
    elements.loginForm.hidden = false;
    elements.profileSetupForm.hidden = true;
    elements.loginEmail.focus();
    return;
  }

  if (!fullName) {
    elements.setupStatus.textContent = "Enter your full name.";
    elements.setupName.focus();
    return;
  }

  if (!phone) {
    elements.setupStatus.textContent = "Enter your phone number.";
    elements.setupPhone.focus();
    return;
  }

  if (!supabaseClient) {
    elements.setupStatus.textContent =
      supabaseSetupMessage || "Supabase is not connected. Check the site scripts and config.";
    return;
  }

  await signUpWithSupabase(fullName, phone);
}

async function logout() {
  authState.isAuthenticated = false;
  authState.userId = "";
  pendingFirstLogin = null;
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  localStorage.removeItem(SESSION_KEY);
  elements.loginPassword.value = "";
  elements.loginStatus.textContent = "Logged out.";
  updateAuthView();
}

function setAuthMode(mode, options = {}) {
  if (!["login", "signup"].includes(mode)) {
    return;
  }

  authMode = mode;
  pendingFirstLogin = null;
  elements.loginForm.hidden = false;
  elements.profileSetupForm.hidden = true;

  if (!options.keepStatus) {
    elements.loginStatus.textContent = "";
    elements.setupStatus.textContent = "";
  }

  updateAuthView();
}

function updateAuthView() {
  document.body.classList.toggle("is-authenticated", authState.isAuthenticated);

  if (authState.isAuthenticated) {
    return;
  }

  elements.loginForm.hidden = false;
  elements.profileSetupForm.hidden = true;
  elements.authTitle.textContent = authMode === "login" ? "Welcome back" : "Create your login";
  elements.loginSubmit.textContent = authMode === "login" ? "Log in" : "Continue";
  elements.authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === authMode);
    button.setAttribute("aria-pressed", String(button.dataset.authMode === authMode));
  });

  if (authMode === "login" && authState.profile) {
    elements.loginEmail.value = authState.profile.email;
  } else if (!elements.loginEmail.value) {
    elements.loginEmail.value = getSettings().email;
  }

  elements.loginPassword.setAttribute(
    "autocomplete",
    authMode === "login" ? "current-password" : "new-password",
  );
  elements.loginEmail.focus();
}

function createSupabaseClient() {
  const config = window.DAILY_PLANNER_SUPABASE || {};
  const hasConfig =
    typeof config.url === "string" &&
    typeof config.anonKey === "string" &&
    config.url.startsWith("https://") &&
    !config.url.includes("PASTE_") &&
    !config.anonKey.includes("PASTE_");

  if (!hasConfig) {
    supabaseSetupMessage = "Supabase config is missing on this deployed site.";
    return null;
  }

  if (!window.supabase?.createClient) {
    supabaseSetupMessage = "Supabase library did not load. Check the deployed script/CDN.";
    return null;
  }

  return window.supabase.createClient(config.url, config.anonKey);
}

async function restoreSupabaseSession() {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.user) {
    return;
  }

  await applySupabaseUser(data.session.user);
}

async function getValidAccessToken() {
  if (!supabaseClient) return "";
  let { data } = await supabaseClient.auth.getSession();
  const expiresSoon = !data.session?.expires_at || data.session.expires_at * 1000 < Date.now() + 60000;
  if (expiresSoon) {
    const refreshed = await supabaseClient.auth.refreshSession();
    data = refreshed.data;
  }
  return data.session?.access_token || "";
}

async function loginWithSupabase(email, password) {
  elements.loginSubmit.disabled = true;
  elements.loginStatus.textContent = "Logging in...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  elements.loginSubmit.disabled = false;

  if (error || !data.user) {
    elements.loginStatus.textContent = error?.message || "Login failed.";
    return;
  }

  await applySupabaseUser(data.user);
  saveLoginSession();
  elements.loginStatus.textContent = "";
  renderSettings("Logged in.");
  updateAuthView();
}

async function signUpWithSupabase(fullName, phone) {
  elements.setupStatus.textContent = "Creating account...";

  const { data, error } = await supabaseClient.auth.signUp({
    email: pendingFirstLogin.email,
    password: pendingFirstLogin.password,
    options: {
      data: {
        name: fullName,
        phone,
      },
    },
  });

  if (error || !data.user) {
    elements.setupStatus.textContent = error?.message || "Sign up failed.";
    return;
  }

  authState.profile = {
    email: data.user.email || pendingFirstLogin.email,
    name: fullName,
    phone,
    createdAt: data.user.created_at || new Date().toISOString(),
  };
  authState.userId = data.user.id;
  authState.isAuthenticated = Boolean(data.session);
  pendingFirstLogin = null;
  authMode = "login";
  syncSettingsFromAuthProfile();

  if (!data.session) {
    elements.loginForm.hidden = false;
    elements.profileSetupForm.hidden = true;
    elements.loginStatus.textContent = "Check your email to confirm your account, then log in.";
    updateAuthView();
    return;
  }

  await saveDataToSupabase();
  saveLoginSession();
  renderSettings("Profile details were added from login.");
  updateAuthView();
}

async function applySupabaseUser(user) {
  authState.userId = user.id;
  authState.profile = {
    email: user.email || "",
    name: user.user_metadata?.name || "",
    phone: user.user_metadata?.phone || "",
    createdAt: user.created_at || "",
  };
  authState.isAuthenticated = true;
  authMode = "login";

  const cloudData = await loadDataFromSupabase(user.id);
  if (cloudData) {
    state.data = cloudData;
  } else {
    syncSettingsFromAuthProfile();
    await saveDataToSupabase();
  }

  syncSettingsFromAuthProfile();
  saveDataLocally();
  lastCloudSyncMessage = `Cloud sync active for ${authState.profile.email}.`;
  subscribeToPlannerChanges();
}

function subscribeToPlannerChanges() {
  if (!supabaseClient || !authState.userId) return;
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient
    .channel(`planner-${authState.userId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: SUPABASE_TABLE, filter: `user_id=eq.${authState.userId}` }, (payload) => {
      if (cloudSaveTimer || Date.now() - lastLocalSaveAt < 1500 || !payload.new?.data) return;
      state.data = normalizePlannerData(payload.new.data);
      saveDataLocally();
      lastCloudSyncMessage = "Updated instantly from another device.";
      render();
    })
    .subscribe();
}

async function loadDataFromSupabase(userId) {
  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("profile,data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load Supabase planner data", error);
    lastCloudSyncMessage = "Cloud sync could not load. Check Supabase setup.";
    return null;
  }

  if (!data?.data) {
    return null;
  }

  if (data.profile) {
    authState.profile = {
      ...authState.profile,
      ...normalizeCloudProfile(data.profile),
    };
  }

  return normalizePlannerData(data.data);
}

async function saveDataToSupabase() {
  if (!supabaseClient || !authState.userId) {
    lastCloudSyncMessage = supabaseClient
      ? "Cloud is connected, but you are not logged in."
      : "Device only - Supabase is not configured.";
    return;
  }

  lastLocalSaveAt = Date.now();
  const { error } = await supabaseClient.from(SUPABASE_TABLE).upsert({
    user_id: authState.userId,
    profile: {
      email: authState.profile?.email || getSettings().email,
      name: authState.profile?.name || getSettings().name,
      phone: authState.profile?.phone || getSettings().phone,
    },
    data: state.data,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to save Supabase planner data", error);
    lastCloudSyncMessage = `Cloud save failed: ${error.message}`;
    elements.settingsStatus.textContent = lastCloudSyncMessage;
    return;
  }

  lastCloudSyncMessage = `Cloud synced ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}.`;
}

async function syncNow() {
  if (syncInProgress) {
    return;
  }

  if (!supabaseClient) {
    renderSettings("Supabase is not connected. Add the URL and anon key in js/config.js.");
    return;
  }

  if (!authState.isAuthenticated || !authState.userId) {
    renderSettings("Log in before syncing.");
    return;
  }

  syncInProgress = true;
  const hadPendingLocalChanges = Boolean(cloudSaveTimer);
  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  setSyncButtonsDisabled(true);
  elements.settingsStatus.textContent = "Syncing...";
  if (hadPendingLocalChanges) await saveDataToSupabase();
  const cloudData = await loadDataFromSupabase(authState.userId);
  if (cloudData) {
    state.data = cloudData;
    syncSettingsFromAuthProfile();
    saveDataLocally();
  }

  setSyncButtonsDisabled(false);
  syncInProgress = false;
  render();
  renderSettings(lastCloudSyncMessage || "Cloud changes loaded.");
}

function setSyncButtonsDisabled(isDisabled) {
  elements.syncNow.disabled = isDisabled;
  if (elements.topbarSync) {
    elements.topbarSync.disabled = isDisabled;
  }
}

function scheduleAutomaticSync() {
  if (autoSyncTimer) {
    window.clearInterval(autoSyncTimer);
  }

  autoSyncTimer = window.setInterval(automaticSync, AUTO_SYNC_INTERVAL_MS);
}

async function automaticSync() {
  if (document.hidden || !navigator.onLine || syncInProgress) {
    return;
  }

  if (!supabaseClient || !authState.isAuthenticated || !authState.userId) {
    return;
  }

  await syncNow();
}

function getPrimaryFieldForTab(tabId) {
  return {
    classes: elements.classTitle,
    events: elements.eventTitle,
    homework: elements.homeworkTitle,
    exams: elements.examTitle,
    reminders: elements.reminderTitle,
  }[tabId];
}

async function refreshCloudData() {
  if (!supabaseClient || !authState.isAuthenticated || !authState.userId) {
    return;
  }

  const cloudData = await loadDataFromSupabase(authState.userId);
  if (!cloudData) {
    return;
  }

  state.data = cloudData;
  syncSettingsFromAuthProfile();
  saveDataLocally();
  lastCloudSyncMessage = `Cloud refreshed ${new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}.`;
  render();
}

function normalizeCloudProfile(profile) {
  return {
    email: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "",
    name: typeof profile.name === "string" ? profile.name : "",
    phone: typeof profile.phone === "string" ? profile.phone : "",
  };
}

function syncSettingsFromAuthProfile() {
  if (!authState.profile) {
    return;
  }

  const settings = getSettings();
  state.data.settings = {
    ...settings,
    name: authState.profile.name || settings.name,
    email: authState.profile.email || settings.email,
    phone: authState.profile.phone || settings.phone,
  };
}

function syncAuthProfileFromSettings() {
  if (!authState.profile) {
    return;
  }

  const settings = getSettings();
  authState.profile = {
    ...authState.profile,
    email: settings.email.trim().toLowerCase() || authState.profile.email,
    name: settings.name || authState.profile.name,
    phone: settings.phone || authState.profile.phone,
  };

  if (!supabaseClient) {
    return;
  }

  supabaseClient.auth.updateUser({
    data: {
      name: authState.profile.name,
      phone: authState.profile.phone,
    },
  });
}

function saveLoginSession() {
  localStorage.removeItem(SESSION_KEY);
}

function clearLegacyLocalLogin() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function render() {
  renderTabs();
  renderHeaderStats();
  renderCalendar();
  renderTodoList();
  renderClassList();
  renderEventList();
  renderHomeworkList();
  renderExamList();
  renderReminderList();
  renderColorMatchOptions();
  renderSelectedDayViews();
  renderSettings();
  renderSchoolImportItems();
  prefillForms();
}

function renderTodoList() {
  const allItems = [
    ...getNextVisibleOccurrences(state.data.homework, todayString()).map((item) => ({ ...item, color: getStoredItemColor("homework", item), kind: "homework", label: item.course || "Homework" })),
    ...state.data.exams.filter((item) => item.date >= todayString()).map((item) => ({ ...item, color: getStoredItemColor("exams", item), kind: "exam", label: item.course || "Exam" })),
    ...getNextVisibleOccurrences(state.data.reminders, todayString()).map((item) => ({ ...item, color: getStoredItemColor("reminders", item), kind: "reminder", label: "Reminder" })),
  ].filter((item) => !isExpiredCompletedItem(item));

  const courses = [...new Set(allItems.map((item) => item.course).filter(Boolean))].sort();
  const selectedCourse = courses.includes(todoClassFilter) ? todoClassFilter : "all";
  todoClassFilter = selectedCourse;
  elements.todoClassFilter.innerHTML = '<option value="all">All classes</option>' + courses.map((course) => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join("");
  elements.todoClassFilter.value = selectedCourse;
  elements.todoTypeFilter.value = todoTypeFilter;

  const items = allItems
    .filter((item) => todoTypeFilter === "all" || item.kind === todoTypeFilter)
    .filter((item) => selectedCourse === "all" || item.course === selectedCourse)
    .sort(compareByDateTime);

  elements.todoList.innerHTML = "";
  elements.todoCount.textContent = `${items.filter((item) => item.status !== "done").length} left`;
  if (!items.length) {
    elements.todoList.innerHTML = '<div class="empty-state">Nothing upcoming. You’re all caught up.</div>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = `todo-item${item.status === "done" ? " is-complete" : ""}`;
    applyItemColor(row, item.color);
    row.innerHTML = `<button class="todo-check" type="button" aria-label="${item.status === "done" ? "Mark pending" : "Mark done"}">${item.status === "done" ? "✓" : ""}</button><div class="todo-copy"><div class="todo-title-line"><strong>${escapeHtml(item.title)}</strong>${item.priority ? '<span class="priority-label">Priority</span>' : ""}</div><span>${escapeHtml(item.label)} · ${formatShortDate(item.date)}${item.time ? ` · ${formatTime(item.time)}` : ""}</span></div>`;
    row.querySelector(".todo-check").addEventListener("click", () => {
      if (item.kind === "homework") toggleHomeworkStatus(item.id);
      else if (item.kind === "exam") toggleExamStatus(item.id);
      else toggleReminderStatus(item.id);
    });
    elements.todoList.appendChild(row);
  });
}

function renderTabs() {
  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === state.activeTab);
  });
}

function renderWeekdays() {
  elements.calendarWeekdays.innerHTML = "";
  WEEKDAYS.forEach((day) => {
    const label = document.createElement("div");
    label.className = "weekday-pill";
    label.textContent = day;
    elements.calendarWeekdays.appendChild(label);
  });
}

function renderHeaderStats() {
  const today = state.selectedDate;
  elements.homeworkCount.textContent = String(
    getNextVisibleOccurrences(state.data.homework).filter((item) => item.status !== "done").length,
  );
  elements.examCount.textContent = String(state.data.exams.filter((item) => item.status !== "done" && item.date >= todayString()).length);
  elements.todayClassesCount.textContent = String(countGroupedItemsOnDate("class", today));
  elements.reminderCount.textContent = String(
    groupReminderEntries().filter((item) => item.status !== "done").length,
  );
}

function renderCalendar() {
  const monthDate = new Date(`${state.visibleMonth}T00:00:00`);
  const anchor = new Date(`${state.selectedDate}T00:00:00`);
  const view = state.calendarView || "month";
  const isMobileCalendar = document.body.classList.contains("mobile-preview") || window.matchMedia("(max-width: 760px)").matches;
  elements.calendarViewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.calendarView === view);
  });
  elements.calendarGrid.dataset.view = view;
  elements.calendarWeekdays.hidden = view === "day";
  elements.calendarGrid.innerHTML = "";

  let firstDay = new Date(monthDate);
  let cellCount = 42;
  if (view === "month") {
    elements.calendarMonthLabel.textContent = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());
  } else if (view === "week") {
    firstDay = new Date(anchor);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());
    const lastDay = new Date(firstDay);
    lastDay.setDate(lastDay.getDate() + 6);
    elements.calendarMonthLabel.textContent = `${formatShortDate(isoDate(firstDay))} – ${formatShortDate(isoDate(lastDay))}`;
    cellCount = 7;
  } else {
    firstDay = anchor;
    elements.calendarMonthLabel.textContent = formatLongDate(state.selectedDate);
    cellCount = 1;
  }

  for (let index = 0; index < cellCount; index += 1) {
    const current = new Date(firstDay);
    current.setDate(firstDay.getDate() + index);
    const dateString = isoDate(current);
    const items = filterCalendarItems(getItemsForDate(dateString));
    const button = document.createElement("button");
    const isSelected = dateString === state.selectedDate;
    const isToday = dateString === todayString();
    const isOtherMonth = current.getMonth() !== monthDate.getMonth();

    button.type = "button";
    button.dataset.calendarDate = dateString;
    button.title = `${formatLongDate(dateString)} — tap for Day view, hold to add`;
    button.className = [
      "calendar-day",
      isSelected ? "is-selected" : "",
      isToday ? "is-today" : "",
      isOtherMonth ? "is-other-month" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = isMobileCalendar && view !== "month"
      ? current.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : String(current.getDate());
    button.appendChild(number);

    const markers = document.createElement("div");
    markers.className = "calendar-markers";

    const markerLimit = isMobileCalendar && view === "month" ? 3 : isMobileCalendar ? items.length : view === "month" ? 3 : items.length;
    items.slice(0, markerLimit).forEach((item) => {
      const marker = document.createElement("div");
      marker.className = `calendar-marker marker-${item.kind}`;
      const monthTime = item.displayTime ? `<span class="calendar-marker-time">${escapeHtml(item.displayTime)}</span>` : "";
      marker.innerHTML = `<span class="calendar-marker-title">${escapeHtml(item.title)}</span>${monthTime}`;
      applyItemColor(marker, item.color);
      markers.appendChild(marker);
    });

    if (items.length > markerLimit) {
      const extra = document.createElement("div");
      extra.className = "calendar-marker";
      extra.textContent = `+${items.length - markerLimit} more`;
      markers.appendChild(extra);
    }

    button.appendChild(markers);
    button.addEventListener("click", () => {
      state.selectedDate = dateString;
      state.visibleMonth = startOfMonth(dateString);
      state.calendarView = "day";
      renderHeaderStats();
      renderCalendar();
      renderSelectedDayViews();
      prefillForms();
    });

    elements.calendarGrid.appendChild(button);
  }

  if (!elements.calendarGrid.children.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty-month";
    empty.textContent = "Nothing planned this month yet.";
    elements.calendarGrid.appendChild(empty);
  }
}

function shiftCalendar(direction) {
  const view = state.calendarView || "month";
  if (view === "month") {
    state.visibleMonth = offsetMonth(state.visibleMonth, direction);
    return;
  }
  const current = new Date(`${state.selectedDate}T12:00:00`);
  current.setDate(current.getDate() + direction * (view === "week" ? 7 : 1));
  state.selectedDate = isoDate(current);
  state.visibleMonth = startOfMonth(state.selectedDate);
}

function navigateCalendar(direction) {
  shiftCalendar(direction);
  renderHeaderStats();
  renderCalendar();
  renderSelectedDayViews();
  prefillForms();
}

function setupCalendarSwipe() {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let activePointer = null;
  let suppressNextTap = false;
  let holdTimer = null;
  let holdDay = null;
  let holdTriggered = false;

  const cancelHold = () => {
    if (holdTimer) window.clearTimeout(holdTimer);
    holdTimer = null;
    holdDay = null;
  };

  elements.calendarGrid.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    activePointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    startTime = Date.now();
    elements.calendarGrid.classList.add("is-dragging");
    holdTriggered = false;
    holdDay = event.target.closest("[data-calendar-date]");
    if (holdDay) {
      const heldDate = holdDay.dataset.calendarDate;
      holdTimer = window.setTimeout(() => {
        holdTriggered = true;
        suppressNextTap = true;
        state.selectedDate = heldDate;
        state.visibleMonth = startOfMonth(heldDate);
        renderHeaderStats();
        renderSelectedDayViews();
        prefillForms();
        elements.quickAddDialog.showModal();
        window.navigator.vibrate?.(20);
        holdTimer = null;
      }, 600);
    }
  });

  elements.calendarGrid.addEventListener("pointermove", (event) => {
    if (activePointer === null || event.pointerId !== activePointer) return;
    if (Math.abs(event.clientX - startX) > 12 || Math.abs(event.clientY - startY) > 12) cancelHold();
  });

  const finishSwipe = (event) => {
    if (activePointer === null || event.pointerId !== activePointer) return;
    activePointer = null;
    elements.calendarGrid.classList.remove("is-dragging");
    cancelHold();
    if (holdTriggered) {
      renderCalendar();
      window.setTimeout(() => { suppressNextTap = false; }, 250);
      return;
    }
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const isSwipe = Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && Date.now() - startTime < 1200;
    if (!isSwipe) return;
    suppressNextTap = true;
    navigateCalendar(deltaX < 0 ? 1 : -1);
    window.setTimeout(() => { suppressNextTap = false; }, 250);
  };

  elements.calendarGrid.addEventListener("pointerup", finishSwipe);
  elements.calendarGrid.addEventListener("pointercancel", () => {
    activePointer = null;
    cancelHold();
    elements.calendarGrid.classList.remove("is-dragging");
  });
  elements.calendarGrid.addEventListener("contextmenu", (event) => {
    if (event.target.closest("[data-calendar-date]")) event.preventDefault();
  });
  elements.calendarGrid.addEventListener("click", (event) => {
    if (!suppressNextTap) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

function renderSelectedDayViews() {
  const formattedDate = formatLongDate(state.selectedDate);
  elements.selectedDateTitle.textContent = formattedDate;
  if (elements.daySchedulerTitle) elements.daySchedulerTitle.textContent = formattedDate;

  const items = filterCalendarItems(getItemsForDate(state.selectedDate));
  renderDaySummary(elements.calendarDaySummary, items);
  if (elements.daySchedulerSummary) renderDaySummary(elements.daySchedulerSummary, items);
}

function filterCalendarItems(items) {
  const filter = state.calendarFilter || "all";
  return filter === "all" ? items : items.filter((item) => item.kind === filter);
}

function renderDaySummary(target, items) {
  target.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nothing is scheduled or due on this day yet.";
    target.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `day-card day-card-${item.kind}${item.status === "done" ? " is-complete" : ""}`;
    applyItemColor(card, item.color);
    card.innerHTML = `
      <p class="item-category">${item.label}</p>
      <h4>${escapeHtml(item.title)}</h4>
      <p class="item-meta">${escapeHtml(item.meta)}</p>
      ${item.notes ? `<p class="item-notes">${escapeHtml(item.notes)}</p>` : ""}
    `;

    const action = buildDayStatusButton(item);
    const deleteButton = buildDayDeleteButton(item);
    if (action || deleteButton) {
      const actionRow = document.createElement("div");
      actionRow.className = "day-card-actions";
      if (action) {
        actionRow.appendChild(action);
      }
      if (deleteButton) {
        actionRow.appendChild(deleteButton);
      }
      card.appendChild(actionRow);
    }

    target.appendChild(card);
  });
}

function sendDaySchedulePdf() {
  const date = state.selectedDate || todayString();
  const items = getItemsForDate(date);
  const printWindow = window.open("", "_blank", "width=820,height=1000");

  if (!printWindow) {
    elements.settingsStatus.textContent = "Allow pop-ups, then try the PDF button again.";
    return;
  }

  printWindow.document.write(buildDaySchedulePdfHtml(date, items));
  printWindow.document.close();
  elements.settingsStatus.textContent = "Day schedule PDF is ready. Choose Save as PDF in the print window.";

  printWindow.addEventListener("load", () => {
    printWindow.focus();
    printWindow.print();
  });
}

function buildDaySchedulePdfHtml(date, items) {
  const rows = items.length
    ? items
        .map(
          (item) => `
            <article class="schedule-item">
              <p>${escapeHtml(item.label)}</p>
              <h2>${escapeHtml(item.title)}</h2>
              <div>${escapeHtml(item.meta)}</div>
              ${item.notes ? `<div class="notes">${escapeHtml(item.notes)}</div>` : ""}
            </article>
          `,
        )
        .join("")
    : `<p class="empty">Nothing is scheduled or due on this day yet.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Day Schedule PDF</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 40px;
        color: #171717;
        font-family: "Avenir Next", "Segoe UI", Arial, sans-serif;
        background: #ffffff;
      }
      header {
        margin-bottom: 28px;
        padding-bottom: 18px;
        border-bottom: 2px solid #d9e5ef;
      }
      .eyebrow {
        margin: 0 0 8px;
        color: #2f5f8e;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-family: Georgia, serif;
        font-size: 34px;
      }
      .schedule-item {
        break-inside: avoid;
        margin-bottom: 14px;
        padding: 16px;
        border: 1px solid #dfe6ee;
        border-left: 5px solid #7eaed6;
        border-radius: 12px;
      }
      .schedule-item p {
        margin: 0 0 6px;
        color: #2f5f8e;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .schedule-item h2 {
        margin: 0 0 8px;
        font-size: 20px;
      }
      .schedule-item div,
      .empty {
        color: #4d5565;
        line-height: 1.5;
      }
      .notes {
        margin-top: 8px;
      }
      @media print {
        body { padding: 0.5in; }
      }
    </style>
  </head>
  <body>
    <header>
      <p class="eyebrow">Daily Planner</p>
      <h1>${escapeHtml(formatLongDate(date))}</h1>
    </header>
    <main>${rows}</main>
  </body>
</html>`;
}

function buildDayStatusButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-button day-status-button";

  if (item.kind === "homework") {
    button.textContent = item.status === "done" ? "Mark pending" : "Mark done";
    button.addEventListener("click", () => toggleHomeworkStatus(item.sourceId));
    return button;
  }

  if (item.kind === "exam") {
    button.textContent = item.status === "done" ? "Mark pending" : "Mark done";
    button.addEventListener("click", () => toggleExamStatus(item.sourceId));
    return button;
  }

  if (item.kind === "class" && item.sourceType === "event") {
    button.textContent = item.status === "done" ? "Mark pending" : "Mark done";
    button.addEventListener("click", () => toggleEventStatus(item.sourceId));
    return button;
  }

  if (item.kind === "reminder") {
    button.textContent = item.status === "done" ? "Mark pending" : "Mark done";
    button.addEventListener("click", () => toggleReminderStatus(item.sourceId));
    return button;
  }

  return null;
}

function buildDayDeleteButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-button day-status-button";
  button.textContent = "Delete";

  if (item.kind === "homework") {
    button.addEventListener("click", () => deleteHomework(item.sourceId));
    return button;
  }

  if (item.kind === "exam") {
    button.addEventListener("click", () => deleteExam(item.sourceId));
    return button;
  }

  if (item.kind === "class") {
    button.addEventListener("click", () => {
      if (item.sourceType === "event") {
        deleteEventItem(item.sourceId);
      } else {
        deleteClassItem(item.sourceId);
      }
    });
    return button;
  }

  if (item.kind === "reminder") {
    button.addEventListener("click", () => deleteReminder(item.sourceId));
    return button;
  }

  return null;
}

function renderHomeworkList() {
  const sorted = getNextVisibleOccurrences(state.data.homework)
    .sort(compareByDateTime)
    .map((item) => ({ ...item, effectiveColor: getStoredItemColor("homework", item) }));
  renderCollection({
    target: elements.homeworkList,
    items: sorted,
    emptyMessage: "No homework added yet.",
    config: {
      category: "Homework",
      meta: (item) =>
        `${item.course} • Due ${formatShortDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ""}${item.seriesId ? ` • ${formatRepeatSummary(item)}` : ""} • ${capitalize(item.status)}`,
      notes: (item) => item.notes,
      onEdit: editHomework,
      onDelete: deleteHomework,
      onToggleStatus: toggleHomeworkStatus,
    },
  });
}

function getNextVisibleOccurrences(collection, fromDate = "") {
  const singles = [];
  const series = new Map();

  collection.forEach((item) => {
    if (fromDate && item.date < fromDate) return;
    if (!item.seriesId) {
      singles.push(item);
      return;
    }
    if (!series.has(item.seriesId)) series.set(item.seriesId, []);
    series.get(item.seriesId).push(item);
  });

  const nextInEachSeries = Array.from(series.values())
    .map((items) => [...items].sort(compareByDateTime).find((item) => item.status !== "done"))
    .filter(Boolean);

  return [...singles, ...nextInEachSeries];
}

function renderExamList() {
  const sorted = [...state.data.exams]
    .filter((item) => !isTimedItemPast(item.date, item.time))
    .sort(compareByDateTime)
    .map((item) => ({ ...item, effectiveColor: getStoredItemColor("exams", item) }));
  renderCollection({
    target: elements.examList,
    items: sorted,
    emptyMessage: "No exams added yet.",
    config: {
      category: "Exam",
      meta: (item) =>
        `${item.course} • ${formatShortDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ""} • ${capitalize(item.status || "pending")}`,
      notes: (item) => item.notes,
      onEdit: editExam,
      onDelete: deleteExam,
      onToggleStatus: toggleExamStatus,
    },
  });
}

function renderClassList() {
  const sorted = groupScheduleEntries("class").filter((item) => !isScheduleGroupPast(item, "class"));
  const online = state.data.courses.map((item) => ({ ...item, online: true, status: "pending" }));
  renderCollection({
    target: elements.classList,
    items: [...online, ...sorted],
    emptyMessage: "No classes added yet.",
    config: {
      category: "Class",
      meta: (item) =>
        item.online
          ? "Online · No scheduled meeting time"
          : item.grouped
          ? `${item.repeatSummary} • ${formatShortDate(item.date)} - ${formatShortDate(item.lastDate)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}`
          : `${formatShortDate(item.date)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}`,
      notes: (item) => item.notes,
      onEdit: editClassItem,
      onDelete: deleteClassItem,
    },
  });
}

function renderEventList() {
  const sorted = groupScheduleEntries("event").filter((item) => !isScheduleGroupPast(item, "event"));
  renderCollection({
    target: elements.eventList,
    items: sorted,
    emptyMessage: "No other events added yet.",
    config: {
      category: "Event",
      meta: (item) =>
        item.grouped
          ? `${item.repeatSummary} • ${formatShortDate(item.date)} - ${formatShortDate(item.lastDate)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""} • ${capitalize(item.status || "pending")}`
          : `${formatShortDate(item.date)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""} • ${capitalize(item.status || "pending")}`,
      notes: (item) => item.notes,
      onEdit: editEventItem,
      onDelete: deleteEventItem,
      onToggleStatus: toggleEventStatus,
    },
  });
}

function isScheduleGroupPast(item, type) {
  if (item.grouped && item.actionKey) {
    return !state.data.schedule.some((entry) => entry.type === type && entry.seriesId === item.actionKey && !isTimedItemPast(entry.date, entry.end || entry.start));
  }
  return isTimedItemPast(item.date, item.end || item.start);
}

function isTimedItemPast(date, time = "23:59") {
  const value = new Date(`${date}T${time || "23:59"}:00`);
  return !Number.isNaN(value.getTime()) && value.getTime() < Date.now();
}

function renderReminderList() {
  const sorted = groupReminderEntries();
  renderCollection({
    target: elements.reminderList,
    items: sorted,
    emptyMessage: "No reminders added yet.",
    config: {
      category: "Reminder",
      meta: (item) =>
        item.grouped
          ? `${item.repeatSummary} • ${formatShortDate(item.date)} - ${formatShortDate(item.lastDate)}${item.time ? ` at ${formatTime(item.time)}` : ""} • ${capitalize(item.status || "pending")}`
          : `${formatShortDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ""}${item.seriesId ? ` • ${formatRepeatSummary(item)}` : ""} • ${capitalize(item.status || "pending")}`,
      notes: (item) => item.notes,
      onEdit: editReminder,
      onDelete: deleteReminder,
      onToggleStatus: toggleReminderStatus,
    },
  });
}

function groupReminderEntries() {
  const singles = [];
  const seriesMap = new Map();

  state.data.reminders
    .sort(compareByDateTime)
    .forEach((item) => {
      if (!item.seriesId) {
        singles.push({
          ...item,
          effectiveColor: getStoredItemColor("reminders", item),
        });
        return;
      }

      if (!seriesMap.has(item.seriesId)) {
        seriesMap.set(item.seriesId, []);
      }

      seriesMap.get(item.seriesId).push(item);
    });

  const grouped = Array.from(seriesMap.entries()).map(([seriesId, items]) => {
    const sortedItems = [...items].sort(compareByDateTime);
    const activeItem = sortedItems.find((item) => item.status !== "done") || sortedItems[0];
    const last = sortedItems[sortedItems.length - 1];

    return {
      ...activeItem,
      actionKey: seriesId,
      grouped: true,
      lastDate: last.date,
      repeatSummary: formatRepeatDaysFromItems(sortedItems),
      effectiveColor: getStoredItemColor("reminders", activeItem),
      status: sortedItems.every((item) => item.status === "done") ? "done" : "pending",
    };
  });

  return [...grouped, ...singles].sort(compareByDateTime);
}

function groupScheduleEntries(type) {
  const singles = [];
  const seriesMap = new Map();

  state.data.schedule
    .filter((item) => item.type === type)
    .sort(compareByDateTime)
    .forEach((item) => {
      if (!item.seriesId) {
        singles.push({
          ...item,
          effectiveColor: getStoredItemColor("schedule", item),
        });
        return;
      }

      if (!seriesMap.has(item.seriesId)) {
        seriesMap.set(item.seriesId, []);
      }

      seriesMap.get(item.seriesId).push(item);
    });

  const grouped = Array.from(seriesMap.entries()).map(([seriesId, items]) => {
    const sortedItems = [...items].sort(compareByDateTime);
    const first = sortedItems.find((item) => !isTimedItemPast(item.date, item.end || item.start)) || sortedItems[0];
    const last = sortedItems[sortedItems.length - 1];

    return {
      ...first,
      actionKey: seriesId,
      grouped: true,
      lastDate: last.date,
      repeatSummary: formatRepeatDaysFromItems(sortedItems),
      effectiveColor: getStoredItemColor("schedule", first),
      status:
        type === "event"
          ? sortedItems.every((item) => item.status === "done")
            ? "done"
            : "pending"
          : "pending",
    };
  });

  return [...grouped, ...singles].sort(compareByDateTime);
}

function countGroupedItemsOnDate(type, date) {
  const seriesIds = new Set();
  let count = 0;

  state.data.schedule
    .filter((item) => item.type === type && item.date === date)
    .forEach((item) => {
      if (!item.seriesId) {
        count += 1;
        return;
      }

      seriesIds.add(item.seriesId);
    });

  return count + seriesIds.size;
}

function renderCollection({ target, items, emptyMessage, config }) {
  target.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    target.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const fragment = elements.itemTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".item-card");
    const category = fragment.querySelector(".item-category");
    const title = fragment.querySelector(".item-title");
    const meta = fragment.querySelector(".item-meta");
    const notes = fragment.querySelector(".item-notes");
    const editButton = fragment.querySelector(".edit-button");
    const deleteButton = fragment.querySelector(".delete-button");
    const statusButton = fragment.querySelector(".status-button");

    category.textContent = config.category;
    title.textContent = item.title;
    meta.textContent = config.meta(item);
    notes.textContent = config.notes(item) || "No notes";
    applyItemColor(card, item.effectiveColor || item.color);
    card.classList.toggle("is-complete", item.status === "done");

    const actionKey = item.actionKey || item.id;
    editButton.addEventListener("click", () => config.onEdit(actionKey));
    deleteButton.addEventListener("click", () => config.onDelete(actionKey));

    if (config.onToggleStatus) {
      statusButton.hidden = false;
      statusButton.textContent = item.status === "done" ? "Mark pending" : "Mark done";
      statusButton.addEventListener("click", () => config.onToggleStatus(actionKey));
    }

    target.appendChild(card);
  });
}

function saveClassItem() {
  const editingSeriesId = elements.classForm.dataset.seriesId || "";
  const id = elements.classId.value || crypto.randomUUID();
  const item = {
    id,
    title: elements.classTitle.value.trim(),
    date: elements.classDate.value,
    type: "class",
    repeatMode: elements.classRepeatMode.value,
    start: elements.classStart.value,
    end: elements.classEnd.value,
    location: elements.classLocation.value.trim(),
    color: normalizeColor(elements.classColor.value, "#7eaed6"),
    matchSourceKey: getMatchSourceValue("class"),
    notes: elements.classNotes.value.trim(),
  };

  if (elements.classOnline.checked) {
    if (!item.title) return;
    state.data.schedule = state.data.schedule.filter((entry) => entry.id !== id && entry.seriesId !== editingSeriesId);
    const course = { id, title: item.title, color: item.color, notes: item.notes, online: true };
    upsertItem(state.data.courses, course);
    persistAndRender();
    resetClassForm();
    return;
  }

  if (!item.title || !item.date || !item.start || !item.end) {
    return;
  }

  state.data.courses = state.data.courses.filter((course) => course.id !== id);

  if (item.end <= item.start) {
    window.alert("End time needs to be after the start time.");
    return;
  }

  if (editingSeriesId) {
    state.data.schedule = state.data.schedule.filter(
      (entry) => !(entry.type === "class" && entry.seriesId === editingSeriesId),
    );

    if (elements.classRepeat.checked) {
      const repeatedItems = buildRepeatedScheduleItems(item, "class", editingSeriesId);
      if (!repeatedItems) {
        return;
      }

      state.data.schedule.push(...repeatedItems);
    } else {
      state.data.schedule.push({
        ...item,
        id,
      });
    }
  } else if (!elements.classId.value && elements.classRepeat.checked) {
    const repeatedItems = buildRepeatedScheduleItems(item, "class");
    if (!repeatedItems) {
      return;
    }

    state.data.schedule.push(...repeatedItems);
  } else {
    upsertItem(state.data.schedule, item);
  }

  state.selectedDate = item.date;
  state.visibleMonth = startOfMonth(item.date);
  persistAndRender();
  resetClassForm();
}

function saveEventItem() {
  const editingSeriesId = elements.eventForm.dataset.seriesId || "";
  const id = elements.eventId.value || crypto.randomUUID();
  const status = getExistingStatus(state.data.schedule, elements.eventId.value);
  const item = {
    id,
    title: elements.eventTitle.value.trim(),
    date: elements.eventDate.value,
    type: "event",
    repeatMode: elements.eventRepeatMode.value,
    start: elements.eventStart.value,
    end: elements.eventEnd.value,
    location: elements.eventLocation.value.trim(),
    color: normalizeColor(elements.eventColor.value, "#7eaed6"),
    status,
    completedAt: getExistingCompletedAt(
      state.data.schedule.filter((entry) => entry.type === "event"),
      elements.eventId.value,
      status,
    ),
    matchSourceKey: getMatchSourceValue("event"),
    notes: elements.eventNotes.value.trim(),
  };

  if (!item.title || !item.date || !item.start || !item.end) {
    return;
  }

  if (item.end <= item.start) {
    window.alert("End time needs to be after the start time.");
    return;
  }

  if (editingSeriesId) {
    state.data.schedule = state.data.schedule.filter(
      (entry) => !(entry.type === "event" && entry.seriesId === editingSeriesId),
    );

    if (elements.eventRepeat.checked) {
      const repeatedItems = buildRepeatedScheduleItems(item, "event", editingSeriesId);
      if (!repeatedItems) {
        return;
      }

      state.data.schedule.push(...repeatedItems);
    } else {
      state.data.schedule.push({
        ...item,
        id,
      });
    }
  } else if (!elements.eventId.value && elements.eventRepeat.checked) {
    const repeatedItems = buildRepeatedScheduleItems(item, "event");
    if (!repeatedItems) {
      return;
    }

    state.data.schedule.push(...repeatedItems);
  } else {
    upsertItem(state.data.schedule, item);
  }

  state.selectedDate = item.date;
  state.visibleMonth = startOfMonth(item.date);
  persistAndRender();
  resetEventForm();
}

function saveHomework() {
  const editingSeriesId = elements.homeworkForm.dataset.seriesId || "";
  const id = elements.homeworkId.value || crypto.randomUUID();
  const item = {
    id,
    title: elements.homeworkTitle.value.trim(),
    course: elements.homeworkClass.value.trim(),
    date: elements.homeworkDate.value,
    time: elements.homeworkTime.value,
    status: elements.homeworkStatus.value,
    completedAt: getExistingCompletedAt(
      state.data.homework,
      elements.homeworkId.value,
      elements.homeworkStatus.value,
    ),
    color: colorForSelectedClass(elements.homeworkClass.value, normalizeColor(elements.homeworkColor.value, "#7eaed6")),
    priority: elements.homeworkPriority.checked,
    repeatMode: elements.homeworkRepeatMode.value,
    matchSourceKey: getMatchSourceValue("homework"),
    notes: elements.homeworkNotes.value.trim(),
  };

  if (!item.title || !item.course || !item.date) {
    return;
  }

  if (editingSeriesId) {
    state.data.homework = state.data.homework.filter((entry) => entry.seriesId !== editingSeriesId);

    if (elements.homeworkRepeat.checked) {
      const repeatedItems = buildRepeatedCollectionItems(item, "homework", editingSeriesId);
      if (!repeatedItems) {
        return;
      }

      state.data.homework.push(...repeatedItems);
    } else {
      state.data.homework.push({
        ...item,
        id,
      });
    }
  } else if (!elements.homeworkId.value && elements.homeworkRepeat.checked) {
    const repeatedItems = buildRepeatedCollectionItems(item, "homework");
    if (!repeatedItems) {
      return;
    }

    state.data.homework.push(...repeatedItems);
  } else {
    upsertItem(state.data.homework, item);
  }

  state.selectedDate = item.date;
  state.visibleMonth = startOfMonth(item.date);
  persistAndRender();
  resetHomeworkForm();
}

function saveExam() {
  const id = elements.examId.value || crypto.randomUUID();
  const status = getExistingStatus(state.data.exams, elements.examId.value);
  const item = {
    id,
    title: elements.examTitle.value.trim(),
    course: elements.examCourse.value.trim(),
    date: elements.examDate.value,
    time: elements.examTime.value,
    color: colorForSelectedClass(elements.examCourse.value, normalizeColor(elements.examColor.value, "#7eaed6")),
    priority: elements.examPriority.checked,
    status,
    completedAt: getExistingCompletedAt(state.data.exams, elements.examId.value, status),
    matchSourceKey: getMatchSourceValue("exam"),
    notes: elements.examNotes.value.trim(),
  };

  if (!item.title || !item.course || !item.date) {
    return;
  }

  upsertItem(state.data.exams, item);
  state.selectedDate = item.date;
  state.visibleMonth = startOfMonth(item.date);
  persistAndRender();
  resetExamForm();
}

function saveReminder() {
  const editingSeriesId = elements.reminderForm.dataset.seriesId || "";
  const id = elements.reminderId.value || crypto.randomUUID();
  const status = getExistingStatus(state.data.reminders, elements.reminderId.value);
  const item = {
    id,
    title: elements.reminderTitle.value.trim(),
    date: elements.reminderDate.value,
    time: elements.reminderTime.value,
    color: normalizeColor(elements.reminderColor.value, "#7eaed6"),
    priority: elements.reminderPriority.checked,
    status,
    completedAt: getExistingCompletedAt(state.data.reminders, elements.reminderId.value, status),
    repeatMode: elements.reminderRepeatMode.value,
    matchSourceKey: getMatchSourceValue("reminder"),
    notes: elements.reminderNotes.value.trim(),
  };

  if (!item.title || !item.date) {
    return;
  }

  if (editingSeriesId) {
    state.data.reminders = state.data.reminders.filter((entry) => entry.seriesId !== editingSeriesId);

    if (elements.reminderRepeat.checked) {
      const repeatedItems = buildRepeatedCollectionItems(item, "reminder", editingSeriesId);
      if (!repeatedItems) {
        return;
      }

      state.data.reminders.push(...repeatedItems);
    } else {
      state.data.reminders.push({
        ...item,
        id,
      });
    }
  } else if (!elements.reminderId.value && elements.reminderRepeat.checked) {
    const repeatedItems = buildRepeatedCollectionItems(item, "reminder");
    if (!repeatedItems) {
      return;
    }

    state.data.reminders.push(...repeatedItems);
  } else {
    upsertItem(state.data.reminders, item);
  }

  state.selectedDate = item.date;
  state.visibleMonth = startOfMonth(item.date);
  persistAndRender();
  resetReminderForm();
}

function editHomework(id) {
  const directMatch = state.data.homework.find((entry) => entry.id === id);
  if (!directMatch) {
    return;
  }

  const matches = directMatch.seriesId
    ? state.data.homework.filter((entry) => entry.seriesId === directMatch.seriesId)
    : [directMatch];
  const sortedMatches = [...matches].sort(compareByDateTime);
  const item = sortedMatches[0];

  setActiveTab("homework");
  openMobileAddForm("homework");
  elements.homeworkForm.dataset.seriesId = item.seriesId || "";
  elements.homeworkId.value = item.id;
  elements.homeworkTitle.value = item.title;
  elements.homeworkClass.value = item.course;
  elements.homeworkDate.value = item.date;
  elements.homeworkTime.value = item.time || "";
  elements.homeworkStatus.value = item.status;
  elements.homeworkColor.value = normalizeColor(item.color, "#7eaed6");
  elements.homeworkPriority.checked = Boolean(item.priority);
  setMatchSelection("homework", item.matchSourceKey || "");
  elements.homeworkRepeat.checked = Boolean(item.seriesId);
  elements.homeworkRepeatMode.value = item.repeatMode || "weekly";
  elements.homeworkRepeatForever.checked = Boolean(item.repeatForever);
  elements.homeworkRepeatUntil.value = item.seriesId
    ? item.repeatForever
      ? ""
      : sortedMatches[sortedMatches.length - 1].date
    : "";
  setRepeatDaysFromSeries("homework", sortedMatches);
  toggleRepeatOptions("homework");
  elements.homeworkNotes.value = item.notes || "";
}

function editExam(id) {
  const item = state.data.exams.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  setActiveTab("exams");
  openMobileAddForm("exams");
  elements.examId.value = item.id;
  elements.examTitle.value = item.title;
  elements.examCourse.value = item.course;
  elements.examDate.value = item.date;
  elements.examTime.value = item.time || "";
  elements.examColor.value = normalizeColor(item.color, "#7eaed6");
  elements.examPriority.checked = Boolean(item.priority);
  setMatchSelection("exam", item.matchSourceKey || "");
  elements.examNotes.value = item.notes || "";
}

function editClassItem(id) {
  const onlineCourse = state.data.courses.find((item) => item.id === id);
  if (onlineCourse) {
    setActiveTab("classes");
    openMobileAddForm("classes");
    resetClassForm();
    elements.classId.value = onlineCourse.id;
    elements.classTitle.value = onlineCourse.title;
    elements.classColor.value = normalizeColor(onlineCourse.color, "#7eaed6");
    elements.classNotes.value = onlineCourse.notes || "";
    elements.classOnline.checked = true;
    toggleOnlineClassFields();
    return;
  }
  const matches = state.data.schedule.filter(
    (entry) => entry.type === "class" && (entry.id === id || entry.seriesId === id),
  );
  if (!matches.length) {
    return;
  }

  const sortedMatches = [...matches].sort(compareByDateTime);
  const item = sortedMatches[0];

  setActiveTab("classes");
  openMobileAddForm("classes");
  elements.classOnline.checked = false;
  toggleOnlineClassFields();
  elements.classForm.dataset.seriesId = item.seriesId || "";
  elements.classId.value = item.id;
  elements.classTitle.value = item.title;
  elements.classDate.value = item.date;
  elements.classStart.value = item.start;
  elements.classEnd.value = item.end;
  elements.classLocation.value = item.location || "";
  elements.classColor.value = normalizeColor(item.color, "#7eaed6");
  setMatchSelection("class", item.matchSourceKey || "");
  elements.classRepeat.checked = Boolean(item.seriesId);
  elements.classRepeatMode.value = item.repeatMode || "weekly";
  elements.classRepeatForever.checked = Boolean(item.repeatForever);
  elements.classRepeatUntil.value = item.seriesId
    ? item.repeatForever
      ? ""
      : sortedMatches[sortedMatches.length - 1].date
    : "";
  setRepeatDaysFromSeries("class", sortedMatches);
  toggleRepeatOptions("class");
  elements.classNotes.value = item.notes || "";
}

function editEventItem(id) {
  const matches = state.data.schedule.filter(
    (entry) => entry.type === "event" && (entry.id === id || entry.seriesId === id),
  );
  if (!matches.length) {
    return;
  }

  const sortedMatches = [...matches].sort(compareByDateTime);
  const item = sortedMatches[0];

  setActiveTab("events");
  openMobileAddForm("events");
  elements.eventForm.dataset.seriesId = item.seriesId || "";
  elements.eventId.value = item.id;
  elements.eventTitle.value = item.title;
  elements.eventDate.value = item.date;
  elements.eventStart.value = item.start;
  elements.eventEnd.value = item.end;
  elements.eventLocation.value = item.location || "";
  elements.eventColor.value = normalizeColor(item.color, "#7eaed6");
  setMatchSelection("event", item.matchSourceKey || "");
  elements.eventRepeat.checked = Boolean(item.seriesId);
  elements.eventRepeatMode.value = item.repeatMode || "weekly";
  elements.eventRepeatForever.checked = Boolean(item.repeatForever);
  elements.eventRepeatUntil.value = item.seriesId
    ? item.repeatForever
      ? ""
      : sortedMatches[sortedMatches.length - 1].date
    : "";
  setRepeatDaysFromSeries("event", sortedMatches);
  toggleRepeatOptions("event");
  elements.eventNotes.value = item.notes || "";
}

function editReminder(id) {
  const matches = state.data.reminders.filter(
    (entry) => entry.id === id || entry.seriesId === id,
  );
  if (!matches.length) {
    return;
  }

  const sortedMatches = [...matches].sort(compareByDateTime);
  const item = sortedMatches[0];

  setActiveTab("reminders");
  openMobileAddForm("reminders");
  elements.reminderForm.dataset.seriesId = item.seriesId || "";
  elements.reminderId.value = item.id;
  elements.reminderTitle.value = item.title;
  elements.reminderDate.value = item.date;
  elements.reminderTime.value = item.time || "";
  elements.reminderColor.value = normalizeColor(item.color, "#7eaed6");
  elements.reminderPriority.checked = Boolean(item.priority);
  setMatchSelection("reminder", item.matchSourceKey || "");
  elements.reminderRepeat.checked = Boolean(item.seriesId);
  elements.reminderRepeatMode.value = item.repeatMode || "weekly";
  elements.reminderRepeatForever.checked = Boolean(item.repeatForever);
  elements.reminderRepeatUntil.value = item.seriesId
    ? item.repeatForever
      ? ""
      : sortedMatches[sortedMatches.length - 1].date
    : "";
  setRepeatDaysFromSeries("reminder", sortedMatches);
  toggleRepeatOptions("reminder");
  elements.reminderNotes.value = item.notes || "";
}

function deleteHomework(id) {
  const match = state.data.homework.find((item) => item.id === id || item.seriesId === id);
  const seriesId = match?.seriesId || (state.data.homework.some((item) => item.seriesId === id) ? id : "");
  state.data.homework = state.data.homework.filter((item) => seriesId ? item.seriesId !== seriesId : item.id !== id);
  persistAndRender();
  resetHomeworkForm();
}

function toggleHomeworkStatus(id) {
  const item = state.data.homework.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  setItemStatus(item, item.status === "done" ? "pending" : "done");
  persistAndRender();
}

function deleteExam(id) {
  state.data.exams = state.data.exams.filter((item) => item.id !== id);
  persistAndRender();
  resetExamForm();
}

function toggleExamStatus(id) {
  const item = state.data.exams.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  setItemStatus(item, item.status === "done" ? "pending" : "done");
  persistAndRender();
}

function deleteReminder(id) {
  const match = state.data.reminders.find((item) => item.id === id || item.seriesId === id);
  const seriesId = match?.seriesId || (state.data.reminders.some((item) => item.seriesId === id) ? id : "");
  state.data.reminders = state.data.reminders.filter((item) => seriesId ? item.seriesId !== seriesId : item.id !== id);
  persistAndRender();
  resetReminderForm();
}

function toggleReminderStatus(id) {
  const directMatch = state.data.reminders.find((entry) => entry.id === id);
  if (directMatch) {
    setItemStatus(directMatch, directMatch.status === "done" ? "pending" : "done");
    persistAndRender();
    return;
  }

  const seriesMatches = state.data.reminders
    .filter((entry) => entry.seriesId === id)
    .sort(compareByDateTime);

  if (!seriesMatches.length) {
    return;
  }

  const target =
    seriesMatches.find((item) => item.date === state.selectedDate && item.status !== "done") ||
    seriesMatches.find((item) => item.status !== "done") ||
    seriesMatches[0];

  const nextStatus = target.status === "done" ? "pending" : "done";
  setItemStatus(target, nextStatus);

  if (nextStatus === "done") {
    const nextItem = seriesMatches.find(
      (item) => item.id !== target.id && item.date > target.date && item.status !== "done",
    );

    if (nextItem) {
      state.selectedDate = nextItem.date;
      state.visibleMonth = startOfMonth(nextItem.date);
    }
  }

  persistAndRender();
}

function deleteClassItem(id) {
  if (state.data.courses.some((item) => item.id === id)) {
    state.data.courses = state.data.courses.filter((item) => item.id !== id);
    persistAndRender();
    resetClassForm();
    return;
  }
  deleteScheduleEntryOrSeries(id, "class");
  persistAndRender();
  resetClassForm();
}

function deleteEventItem(id) {
  deleteScheduleEntryOrSeries(id, "event");
  persistAndRender();
  resetEventForm();
}

function deleteScheduleEntryOrSeries(id, type) {
  const match = state.data.schedule.find((item) => item.type === type && (item.id === id || item.seriesId === id));
  const seriesId = match?.seriesId || (state.data.schedule.some((item) => item.type === type && item.seriesId === id) ? id : "");
  state.data.schedule = state.data.schedule.filter((item) => {
    if (item.type !== type) return true;
    return seriesId ? item.seriesId !== seriesId : item.id !== id;
  });
}

function toggleEventStatus(id) {
  const matches = state.data.schedule.filter(
    (entry) => entry.type === "event" && (entry.id === id || entry.seriesId === id),
  );
  if (!matches.length) {
    return;
  }

  const nextStatus = matches.every((item) => item.status === "done") ? "pending" : "done";
  matches.forEach((item) => {
    setItemStatus(item, nextStatus);
  });
  persistAndRender();
}

function getScheduleDeleteTarget(id, type) {
  const directMatch = state.data.schedule.find((item) => item.id === id && item.type === type);
  if (directMatch) {
    return directMatch.id;
  }

  const seriesMatches = state.data.schedule
    .filter((item) => item.seriesId === id && item.type === type)
    .sort(compareByDateTime);

  if (!seriesMatches.length) {
    return id;
  }

  const selectedDayMatch = seriesMatches.find((item) => item.date === state.selectedDate);
  return (selectedDayMatch || seriesMatches[0]).id;
}

function getCollectionDeleteTarget(collection, id) {
  const directMatch = collection.find((item) => item.id === id);
  if (directMatch) {
    return directMatch.id;
  }

  const seriesMatches = collection.filter((item) => item.seriesId === id).sort(compareByDateTime);
  if (!seriesMatches.length) {
    return id;
  }

  const selectedDayMatch = seriesMatches.find((item) => item.date === state.selectedDate);
  return (selectedDayMatch || seriesMatches[0]).id;
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  renderTabs();
}

function prefillForms() {
  if (!elements.classDate.value) {
    elements.classDate.value = state.selectedDate;
  }

  if (!elements.eventDate.value) {
    elements.eventDate.value = state.selectedDate;
  }

  if (!elements.homeworkDate.value) {
    elements.homeworkDate.value = state.selectedDate;
  }

  if (!elements.reminderDate.value) {
    elements.reminderDate.value = state.selectedDate;
  }

  if (!elements.examDate.value) {
    elements.examDate.value = state.selectedDate;
  }

  syncRepeatSelectionWithDate("class");
  syncRepeatSelectionWithDate("event");
  syncRepeatSelectionWithDate("homework");
  syncRepeatSelectionWithDate("reminder");
}

function renderColorMatchOptions() {
  renderClassCourseOptions();
  const sources = getColorSourceItems().filter((source, index, all) =>
    all.findIndex((candidate) => candidate.label.trim().toLowerCase() === source.label.trim().toLowerCase()) === index,
  );

  COLOR_MATCH_PREFIXES.forEach((prefix) => {
    const select = getElementByPrefix(prefix, "MatchSource");
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select a saved plan</option>';

    sources.forEach((source) => {
      const option = document.createElement("option");
      option.value = source.key;
      option.textContent = source.label;
      select.appendChild(option);
    });

    if (sources.some((source) => source.key === currentValue)) {
      select.value = currentValue;
    }

    toggleMatchOptions(prefix);
  });
}

function resetClassForm() {
  elements.classForm.reset();
  toggleOnlineClassFields();
  delete elements.classForm.dataset.seriesId;
  elements.classId.value = "";
  elements.classDate.value = state.selectedDate;
  elements.classColor.value = "#7eaed6";
  setMatchSelection("class", "");
  elements.classRepeat.checked = false;
  elements.classRepeatMode.value = "weekly";
  elements.classRepeatUntil.value = "";
  elements.classRepeatForever.checked = false;
  clearRepeatDays("class");
  toggleRepeatOptions("class");
}

function toggleOnlineClassFields() {
  const online = elements.classOnline.checked;
  elements.onlineClassHint.hidden = !online;
  elements.classDateLocationRow.hidden = online;
  elements.classTimeRow.hidden = online;
  elements.classRepeatBox.hidden = online;
  elements.classDate.required = !online;
  elements.classStart.required = !online;
  elements.classEnd.required = !online;
  if (online) elements.classRepeat.checked = false;
}

function resetEventForm() {
  elements.eventForm.reset();
  delete elements.eventForm.dataset.seriesId;
  elements.eventId.value = "";
  elements.eventDate.value = state.selectedDate;
  elements.eventColor.value = "#7eaed6";
  setMatchSelection("event", "");
  elements.eventRepeat.checked = false;
  elements.eventRepeatMode.value = "weekly";
  elements.eventRepeatUntil.value = "";
  elements.eventRepeatForever.checked = false;
  clearRepeatDays("event");
  toggleRepeatOptions("event");
}

function resetHomeworkForm() {
  elements.homeworkForm.reset();
  delete elements.homeworkForm.dataset.seriesId;
  elements.homeworkId.value = "";
  elements.homeworkDate.value = state.selectedDate;
  elements.homeworkStatus.value = "pending";
  elements.homeworkColor.value = "#7eaed6";
  setMatchSelection("homework", "");
  elements.homeworkRepeat.checked = false;
  elements.homeworkRepeatMode.value = "weekly";
  elements.homeworkRepeatUntil.value = "";
  elements.homeworkRepeatForever.checked = false;
  clearRepeatDays("homework");
  toggleRepeatOptions("homework");
}

function resetExamForm() {
  elements.examForm.reset();
  elements.examId.value = "";
  elements.examDate.value = state.selectedDate;
  elements.examColor.value = "#7eaed6";
  setMatchSelection("exam", "");
}

function resetReminderForm() {
  elements.reminderForm.reset();
  delete elements.reminderForm.dataset.seriesId;
  elements.reminderId.value = "";
  elements.reminderDate.value = state.selectedDate;
  elements.reminderColor.value = "#7eaed6";
  setMatchSelection("reminder", "");
  elements.reminderRepeat.checked = false;
  elements.reminderRepeatMode.value = "weekly";
  elements.reminderRepeatUntil.value = "";
  elements.reminderRepeatForever.checked = false;
  clearRepeatDays("reminder");
  toggleRepeatOptions("reminder");
}

async function saveSettings() {
  const notificationPreference =
    elements.notificationPreference.find((input) => input.checked)?.value || "email";
  const notificationFrequency =
    elements.notificationFrequency.find((input) => input.checked)?.value || "daily";
  const currentSettings = getSettings();
  const canvasShortcutInput = elements.settingsCanvasShortcutUrl.value.trim();
  const canvasShortcutUrl = normalizeCanvasShortcutUrl(canvasShortcutInput);
  if (canvasShortcutInput && !canvasShortcutUrl) {
    elements.settingsStatus.textContent = "Enter a complete secure Canvas link beginning with https://.";
    elements.settingsCanvasShortcutUrl.focus();
    return;
  }

  state.data.settings = {
    name: elements.settingsName.value.trim(),
    email: elements.settingsEmail.value.trim(),
    phone: elements.settingsPhone.value.trim(),
    widgetPreferences: {
      defaultView: elements.widgetDefaultView.value,
      startScreen: elements.scriptableStartScreen.value,
      plannerUrl: elements.widgetPlannerUrl.value.trim(),
      daysAhead: elements.widgetDaysAhead.value === "all" ? "all" : Number(elements.widgetDaysAhead.value),
      itemLimit: Number(elements.widgetItemLimit.value),
      classes: elements.widgetShowClasses.checked,
      homework: elements.widgetShowHomework.checked,
      events: elements.widgetShowEvents.checked,
      exams: elements.widgetShowExams.checked,
      reminders: elements.widgetShowReminders.checked,
    },
    notificationPreference,
    academicCalendar: currentSettings.academicCalendar,
    notificationSchedule: {
      ...currentSettings.notificationSchedule,
      frequency: notificationFrequency,
      homework: elements.notifyHomework.checked,
      events: elements.notifyEvents.checked,
      classes: elements.notifyClasses.checked,
      exams: elements.notifyExams.checked,
      reminders: elements.notifyReminders.checked,
      dayScheduler: elements.notifyDayScheduler.checked,
      schoolAccounts: elements.notifySchoolAccounts.checked,
      schoolImports: elements.notifySchoolImports.checked,
      settings: elements.notifySettings.checked,
      calendar: elements.notifyCalendar.checked,
      weeklyScheduleReminder: {
        ...currentSettings.notificationSchedule.weeklyScheduleReminder,
        enabled: Boolean(document.querySelector("#weekly-schedule-reminder")?.checked),
        delivery: document.querySelector("#weekly-reminder-delivery")?.value || "email",
        day: Number(document.querySelector("#weekly-reminder-day")?.value || 0),
        time: document.querySelector("#weekly-reminder-time")?.value || "18:00",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
    },
    school: currentSettings.school,
    canvasUrl: currentSettings.canvasUrl,
    schoolUsername: currentSettings.schoolUsername,
    connections: currentSettings.connections,
    schoolAccounts: currentSettings.schoolAccounts,
    canvasFeedUrl: elements.settingsCanvasFeed.value.trim(),
    canvasShortcut: {
      school: elements.settingsCanvasShortcutSchool.value.trim(),
      url: canvasShortcutUrl,
    },
  };

  syncAuthProfileFromSettings();
  saveDataLocally();
  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  elements.settingsStatus.textContent = "Saving widget settings...";
  await saveDataToSupabase();
  requestBrowserNotificationPermission();
  scheduleNotificationCheck();
  renderSettings(
    authState.isAuthenticated && authState.userId
      ? lastCloudSyncMessage || "Widget settings saved."
      : "Settings saved on this device. Log in to sync them with Scriptable.",
  );
}

function resetSettingsForm() {
  state.data.settings = getDefaultSettings();
  saveData();
  renderSettings("Settings cleared.");
}

function renderSettings(statusMessage = "") {
  const settings = getSettings();

  elements.settingsName.value = settings.name;
  elements.settingsEmail.value = settings.email;
  elements.settingsPhone.value = settings.phone;
  elements.widgetDefaultView.value = settings.widgetPreferences.defaultView;
  elements.scriptableStartScreen.value = settings.widgetPreferences.startScreen;
  elements.widgetPlannerUrl.value = settings.widgetPreferences.plannerUrl || getCurrentPlannerUrl();
  elements.widgetDaysAhead.value = String(settings.widgetPreferences.daysAhead);
  elements.widgetItemLimit.value = String(settings.widgetPreferences.itemLimit);
  elements.widgetShowClasses.checked = settings.widgetPreferences.classes;
  elements.widgetShowHomework.checked = settings.widgetPreferences.homework;
  elements.widgetShowEvents.checked = settings.widgetPreferences.events;
  elements.widgetShowExams.checked = settings.widgetPreferences.exams;
  elements.widgetShowReminders.checked = settings.widgetPreferences.reminders;
  elements.settingsCanvasFeed.value = settings.canvasFeedUrl;
  elements.settingsCanvasShortcutSchool.value = settings.canvasShortcut.school;
  elements.settingsCanvasShortcutUrl.value = settings.canvasShortcut.url;
  renderCanvasShortcut();
  elements.settingsCurrentPassword.value = "";
  elements.settingsNewPassword.value = "";
  clearSchoolAccountForm();
  elements.notificationPreference.forEach((input) => {
    input.checked = input.value === settings.notificationPreference;
  });
  elements.notificationFrequency.forEach((input) => {
    input.checked = input.value === settings.notificationSchedule.frequency;
  });
  elements.notifyHomework.checked = settings.notificationSchedule.homework;
  elements.notifyEvents.checked = settings.notificationSchedule.events;
  elements.notifyClasses.checked = settings.notificationSchedule.classes;
  elements.notifyExams.checked = settings.notificationSchedule.exams;
  elements.notifyReminders.checked = settings.notificationSchedule.reminders;
  elements.notifyDayScheduler.checked = settings.notificationSchedule.dayScheduler;
  elements.notifySchoolAccounts.checked = settings.notificationSchedule.schoolAccounts;
  elements.notifySchoolImports.checked = settings.notificationSchedule.schoolImports;
  elements.notifySettings.checked = settings.notificationSchedule.settings;
  elements.notifyCalendar.checked = settings.notificationSchedule.calendar;
  const weeklyReminder = settings.notificationSchedule.weeklyScheduleReminder;
  document.querySelector("#weekly-schedule-reminder").checked = weeklyReminder.enabled;
  document.querySelector("#weekly-reminder-delivery").value = weeklyReminder.delivery;
  document.querySelector("#weekly-reminder-day").value = String(weeklyReminder.day);
  document.querySelector("#weekly-reminder-time").value = weeklyReminder.time;
  toggleWeeklyReminderOptions();

  elements.settingsSummaryTitle.textContent = settings.name || "Your planner";
  elements.settingsSummary.innerHTML = "";

  [
    ["Storage", getStorageStatus()],
    ["Automatic sync", authState.isAuthenticated ? "Within 1 second of changes" : "Available after login"],
    ["Last sync", lastCloudSyncMessage || "Waiting for first sync"],
    ["School accounts", String(settings.schoolAccounts.length)],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "settings-summary-row";
    row.innerHTML = `<span>${label}</span><strong>${escapeHtml(value)}</strong>`;
    elements.settingsSummary.appendChild(row);
  });

  renderPasswordSummary();
  renderSchoolAccountSummary();
  elements.settingsStatus.textContent = statusMessage || lastCloudSyncMessage;
}

function getStorageStatus() {
  if (!supabaseClient) {
    return supabaseSetupMessage || "Device only - add Supabase URL and anon key";
  }

  if (!authState.isAuthenticated) {
    return "Cloud ready - log in with the same account";
  }

  return lastCloudSyncMessage || `Cloud sync active for ${authState.profile?.email || "this account"}`;
}

function changeLoginPassword() {
  const nextPassword = elements.settingsNewPassword.value;

  if (!authState.profile) {
    renderSettings("Log in before changing your password.");
    return;
  }

  if (supabaseClient) {
    changeSupabasePassword(nextPassword);
    return;
  }

  elements.settingsStatus.textContent = "Supabase is not connected. Password changes are unavailable.";
}

async function changeSupabasePassword(nextPassword) {
  if (nextPassword.trim().length < 6) {
    elements.settingsStatus.textContent = "New password needs at least 6 characters.";
    elements.settingsNewPassword.focus();
    return;
  }

  elements.settingsChangePassword.disabled = true;
  elements.settingsStatus.textContent = "Updating password...";
  const { error } = await supabaseClient.auth.updateUser({ password: nextPassword });
  elements.settingsChangePassword.disabled = false;

  if (error) {
    elements.settingsStatus.textContent = error.message || "Password update failed.";
    return;
  }

  elements.settingsCurrentPassword.value = "";
  elements.settingsNewPassword.value = "";
  renderSettings("Login password changed.");
}

function saveSchoolAccountFromForm() {
  const settings = getSettings();
  const schoolAccount = {
    id: elements.settingsSchoolAccountId.value || crypto.randomUUID(),
    school: elements.settingsSchool.value.trim(),
    canvasUrl: normalizeUrl(elements.settingsCanvasUrl.value.trim()),
    username: elements.settingsSchoolUsername.value.trim(),
    password: elements.settingsSchoolPassword.value,
    canvasToken: elements.settingsCanvasToken.value.trim(),
    classroomToken: elements.settingsClassroomToken.value.trim(),
    connections: {
      canvas: elements.settingsConnectCanvas.checked,
      googleClassroom: elements.settingsConnectClassroom.checked,
    },
  };

  if (!schoolAccount.school) {
    elements.settingsStatus.textContent = "Add a school name before saving the account.";
    elements.settingsSchool.focus();
    return;
  }

  const existingIndex = settings.schoolAccounts.findIndex((account) => account.id === schoolAccount.id);
  if (existingIndex >= 0) {
    settings.schoolAccounts.splice(existingIndex, 1, schoolAccount);
  } else {
    settings.schoolAccounts.push(schoolAccount);
  }

  state.data.settings = {
    ...settings,
    school: settings.schoolAccounts[0]?.school || "",
    canvasUrl: settings.schoolAccounts[0]?.canvasUrl || "",
    schoolUsername: settings.schoolAccounts[0]?.username || "",
    connections: settings.schoolAccounts[0]?.connections || getDefaultSettings().connections,
  };

  saveData();
  renderSettings(`${schoolAccount.school} was saved.`);
}

function editSchoolAccount(accountId) {
  const account = getSettings().schoolAccounts.find((item) => item.id === accountId);
  if (!account) {
    return;
  }

  elements.settingsSchoolAccountId.value = account.id;
  elements.settingsSchool.value = account.school;
  elements.settingsCanvasUrl.value = account.canvasUrl;
  elements.settingsSchoolUsername.value = account.username;
  elements.settingsSchoolPassword.value = account.password;
  elements.settingsCanvasToken.value = account.canvasToken;
  elements.settingsClassroomToken.value = account.classroomToken;
  elements.settingsConnectCanvas.checked = account.connections.canvas;
  elements.settingsConnectClassroom.checked = account.connections.googleClassroom;
  elements.settingsStatus.textContent = `Editing ${account.school}.`;
}

function deleteSchoolAccount(accountId) {
  const settings = getSettings();
  settings.schoolAccounts = settings.schoolAccounts.filter((account) => account.id !== accountId);
  state.data.settings = {
    ...settings,
    school: settings.schoolAccounts[0]?.school || "",
    canvasUrl: settings.schoolAccounts[0]?.canvasUrl || "",
    schoolUsername: settings.schoolAccounts[0]?.username || "",
    connections: settings.schoolAccounts[0]?.connections || getDefaultSettings().connections,
  };
  saveData();
  renderSettings("School account removed.");
}

function clearSchoolAccountForm() {
  elements.settingsSchoolAccountId.value = "";
  elements.settingsSchool.value = "";
  elements.settingsCanvasUrl.value = "";
  elements.settingsSchoolUsername.value = "";
  elements.settingsSchoolPassword.value = "";
  elements.settingsCanvasToken.value = "";
  elements.settingsClassroomToken.value = "";
  elements.settingsConnectCanvas.checked = false;
  elements.settingsConnectClassroom.checked = false;
}

function renderPasswordSummary() {
  elements.passwordSummary.innerHTML = "";

  const row = document.createElement("div");
  row.className = "settings-summary-row";
  row.innerHTML = `<span>Login password</span><strong>${
    supabaseClient ? "Managed by Supabase" : "Supabase unavailable"
  }</strong>`;
  elements.passwordSummary.appendChild(row);
}

function renderSchoolAccountSummary() {
  const accounts = getSettings().schoolAccounts;
  elements.schoolAccountSummary.innerHTML = "";

  if (!accounts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No school accounts saved yet.";
    elements.schoolAccountSummary.appendChild(empty);
    return;
  }

  accounts.forEach((account) => {
    const card = document.createElement("article");
    card.className = "settings-account-card";
    card.innerHTML = `
      <div class="item-card-top">
        <div>
          <p class="item-category">${escapeHtml(formatSchoolConnections(account.connections))}</p>
          <h4 class="item-title">${escapeHtml(account.school)}</h4>
        </div>
        <div class="item-actions">
          <button class="small-button edit-school-account" type="button">Edit</button>
          <button class="small-button delete-school-account" type="button">Delete</button>
        </div>
      </div>
      <div class="settings-summary-row"><span>Canvas URL</span><strong>${escapeHtml(account.canvasUrl || "Not added")}</strong></div>
      <div class="settings-summary-row"><span>Canvas API</span><strong>${account.canvasToken ? "Connected" : "Not connected"}</strong></div>
      <div class="settings-summary-row"><span>Google Classroom API</span><strong>${account.classroomToken ? "Connected" : "Not connected"}</strong></div>
    `;

    card.querySelector(".edit-school-account").addEventListener("click", () => editSchoolAccount(account.id));
    card.querySelector(".delete-school-account").addEventListener("click", () => deleteSchoolAccount(account.id));
    elements.schoolAccountSummary.appendChild(card);
  });
}

function scheduleNotificationCheck() {
  if (notificationTimer) {
    window.clearInterval(notificationTimer);
  }

  notificationTimer = window.setInterval(checkScheduledNotifications, NOTIFICATION_CHECK_INTERVAL_MS);
  checkScheduledNotifications();
}

function checkScheduledNotifications() {
  const settings = getSettings();
  const schedule = settings.notificationSchedule;

  if (!authState.isAuthenticated || !hasNotificationTopics(schedule) || !isNotificationDue(schedule)) {
    return;
  }

  const title = "Daily Planner check-in";
  const message = buildNotificationMessage(schedule);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message });
  } else {
    elements.settingsStatus.textContent = message;
  }

  schedule.lastNotifiedAt = new Date().toISOString();
  state.data.settings = settings;
  saveData();
}

function requestBrowserNotificationPermission() {
  const schedule = getSettings().notificationSchedule;
  if (!hasNotificationTopics(schedule) || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function hasNotificationTopics(schedule) {
  return getNotificationTopicLabels(schedule).length > 0;
}

function isNotificationDue(schedule) {
  if (!schedule.lastNotifiedAt) {
    return true;
  }

  const lastNotified = new Date(schedule.lastNotifiedAt);
  if (Number.isNaN(lastNotified.getTime())) {
    return true;
  }

  const now = new Date();
  const nextDue = new Date(lastNotified);

  if (schedule.frequency === "monthly") {
    nextDue.setMonth(nextDue.getMonth() + 1);
  } else if (schedule.frequency === "weekly") {
    nextDue.setDate(nextDue.getDate() + 7);
  } else {
    nextDue.setDate(nextDue.getDate() + 1);
  }

  return now >= nextDue;
}

function buildNotificationMessage(schedule) {
  return `Time to check ${formatList(getNotificationTopicLabels(schedule))}.`;
}

async function syncCanvasCalendarFeed() {
  const feedUrl = elements.settingsCanvasFeed.value.trim();
  if (!/^https:\/\/[^/]+\.instructure\.com\/feeds\/calendars\/[^/]+\.ics(?:\?.*)?$/i.test(feedUrl)) {
    elements.canvasFeedStatus.textContent = "Paste a valid private Canvas calendar feed ending in .ics.";
    return;
  }
  elements.syncCanvasFeed.disabled = true;
  elements.canvasFeedStatus.textContent = "Checking Canvas calendar…";
  try {
    const response = await fetch("/.netlify/functions/canvas-calendar-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedUrl }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Canvas calendar sync failed.");
    const items = parseCanvasCalendarFeed(result.ics || "");
    const classes = getImportableClasses();
    const savedByUid = new Map();
    state.data.homework.forEach((item) => { if (item.canvasFeedUid) savedByUid.set(item.canvasFeedUid, { record: item, kind: "homework" }); });
    state.data.exams.forEach((item) => { if (item.canvasFeedUid) savedByUid.set(item.canvasFeedUid, { record: item, kind: "exam" }); });
    const reviewItems = items.map((item) => {
      const match = findMatchingImportedClass(item.course, classes);
      const saved = savedByUid.get(item.uid);
      const course = match?.title || saved?.record.course || "";
      const changed = saved && (saved.record.title !== item.title || saved.record.course !== course || saved.record.date !== item.date || saved.record.time !== item.time || saved.kind !== item.kind);
      return { ...item, id: `canvas-feed:${item.uid}`, source: "Canvas calendar", course, color: match?.color || saved?.record.color || (item.kind === "exam" ? "#6d9fd0" : "#7eaed6"), operation: saved ? (changed ? "update" : "current") : "add", missingTime: !item.time, notes: `${match ? `Matched Canvas course “${item.rawCourse}” to ${match.title}.` : `Canvas course: ${item.rawCourse}. Choose the correct class before adding.`}${!item.time ? " Canvas did not provide a due time; enter it below." : ""}` };
    });
    schoolImportItems = [...schoolImportItems.filter((item) => item.source !== "Canvas calendar"), ...reviewItems];
    state.data.settings.canvasFeedUrl = feedUrl;
    saveData();
    const newCount = reviewItems.filter((item) => item.operation === "add").length;
    const updateCount = reviewItems.filter((item) => item.operation === "update").length;
    const missingCount = reviewItems.filter((item) => item.missingTime && item.operation !== "current").length;
    const reviewMessage = `Canvas returned ${reviewItems.length} upcoming item${reviewItems.length === 1 ? "" : "s"}: ${newCount} new, ${updateCount} changed.${missingCount ? ` ${missingCount} need${missingCount === 1 ? "s" : ""} a due time from you.` : ""}`;
    renderSchoolImportItems(reviewItems.length ? reviewMessage : "No upcoming Canvas items were found.");
    elements.canvasFeedStatus.textContent = reviewItems.length ? "Canvas results are ready in the School import dropdowns below." : "No upcoming Canvas items were found.";
  } catch (error) {
    elements.canvasFeedStatus.textContent = error.message || "Canvas calendar sync failed.";
  } finally {
    elements.syncCanvasFeed.disabled = false;
  }
}

function parseCanvasCalendarFeed(ics) {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  return unfolded.split("BEGIN:VEVENT").slice(1).map((block) => {
    const read = (name) => block.match(new RegExp(`(?:^|\\n)${name}(?:;[^:]*)?:(.*)`, "i"))?.[1]?.trim() || "";
    const decode = (value) => value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
    const summary = decode(read("SUMMARY"));
    const description = decode(read("DESCRIPTION"));
    const uid = read("UID") || `${summary}|${read("DTSTART")}`;
    const dateValue = read("DTSTART") || read("DUE");
    const match = dateValue.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
    if (!summary || !match) return null;
    const prefixCourse = summary.match(/^\[([^\]]+)\]\s*(.*)$/);
    const suffixCourse = summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    const describedCourse = description.match(/(?:^|\n)\s*(?:course|context)\s*:\s*([^\n]+)/i);
    const rawCourse = (prefixCourse?.[1] || suffixCourse?.[2] || describedCourse?.[1] || "Canvas").trim();
    const title = (prefixCourse?.[2] || suffixCourse?.[1] || summary).replace(/^assignment\s*:\s*/i, "").trim();
    const course = rawCourse;
    const kind = /\b(exam|quiz|test|midterm|final)\b/i.test(title) ? "exam" : "homework";
    return { uid, title, course, rawCourse, kind, date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : "" };
  }).filter((item) => item && item.date >= todayString());
}

async function fetchSchoolItems() {
  saveSettings();
  renderSchoolImportItems("Checking connected school accounts...");

  const settings = getSettings();
    const requests = [];

    settings.schoolAccounts.forEach((account) => {
      if (account.connections.canvas) {
        requests.push(fetchCanvasItems(account));
      }

      if (account.connections.googleClassroom) {
        requests.push(fetchGoogleClassroomItems(account));
      }
    });

    if (!requests.length) {
      renderSchoolImportItems("Add a school account with Canvas, Google Classroom, or both before checking.");
      return;
    }

    const results = await Promise.allSettled(requests);
    const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    const errors = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message || "A school import failed.");

    schoolImportItems = dedupeSchoolItems([
      ...schoolImportItems.filter((item) => item.source === "Canvas calendar"),
      ...items,
    ]);

    if (schoolImportItems.length) {
      renderSchoolImportItems(
        `Found ${schoolImportItems.length} item${schoolImportItems.length === 1 ? "" : "s"} to review.`,
      );
      return;
    }

    renderSchoolImportItems(errors[0] || "No upcoming school items were found.");
}

let schoolImportRefreshPromise = null;

function refreshSchoolImports() {
  if (schoolImportRefreshPromise) return schoolImportRefreshPromise;
  schoolImportRefreshPromise = (async () => {
    const settings = getSettings();
    const hasConnectedAccount = settings.schoolAccounts.some((account) => account.connections.canvas || account.connections.googleClassroom);
    const feedUrl = elements.settingsCanvasFeed.value.trim() || settings.canvasFeedUrl;
    if (!hasConnectedAccount && !feedUrl) {
      renderSchoolImportItems("Connect a school account or add a Canvas calendar feed in Settings first.");
      return;
    }
    if (hasConnectedAccount) await fetchSchoolItems();
    if (feedUrl) {
      elements.settingsCanvasFeed.value = feedUrl;
      await syncCanvasCalendarFeed();
    }
  })().finally(() => { schoolImportRefreshPromise = null; });
  return schoolImportRefreshPromise;
}

async function fetchCanvasItems(account) {
  const token = account.canvasToken;
  if (!account.canvasUrl || !token) {
    throw new Error("Canvas needs a Canvas URL and access token.");
  }

  const startDate = todayString();
  const endDate = offsetDate(startDate, 60);
  const url = new URL("/api/v1/planner/items", account.canvasUrl);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("per_page", "100");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Canvas did not return school items. Check the URL and token.");
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item) => mapCanvasPlannerItem(item, account)).filter(Boolean);
}

async function fetchGoogleClassroomItems(account) {
  const token = account.classroomToken;
  if (!token) {
    throw new Error("Google Classroom needs an OAuth access token.");
  }

  const coursesResponse = await fetch(
    "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!coursesResponse.ok) {
    throw new Error("Google Classroom did not return courses. Check the OAuth token.");
  }

  const coursesData = await coursesResponse.json();
  const courses = Array.isArray(coursesData.courses) ? coursesData.courses : [];
  const courseWorkResponses = await Promise.all(
    courses.map(async (course) => {
      const url = `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
        course.id,
      )}/courseWork?courseWorkStates=PUBLISHED&pageSize=50`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (Array.isArray(data.courseWork) ? data.courseWork : []).map((item) =>
        mapGoogleCourseWork(item, course, account),
      );
    }),
  );

  return courseWorkResponses.flat().filter(Boolean);
}

function mapCanvasPlannerItem(item, account) {
  const plannable = item.plannable || {};
  const dueAt = plannable.due_at || item.plannable_date;
  const dateParts = parseSchoolDateTime(dueAt);
  if (!dateParts) {
    return null;
  }

  const title = plannable.title || item.context_name || "Canvas item";
  return {
    id: `canvas:${item.plannable_type || "item"}:${item.plannable_id || plannable.id || dueAt}`,
    source: "Canvas",
    title,
    kind: /\b(exam|quiz|test|midterm|final)\b/i.test(title) ? "exam" : "homework",
    course: item.context_name || account.school || "Canvas",
    date: dateParts.date,
    time: dateParts.time,
    url: item.html_url || plannable.html_url || "",
    notes: `Imported from Canvas${account.school ? ` for ${account.school}` : ""}.`,
  };
}

function mapGoogleCourseWork(item, course, account) {
  const due = parseGoogleDueDate(item.dueDate, item.dueTime);
  if (!due) {
    return null;
  }

  const title = item.title || "Classroom assignment";
  return {
    id: `classroom:${course.id}:${item.id}`,
    source: "Google Classroom",
    title,
    kind: /\b(exam|quiz|test|midterm|final)\b/i.test(title) ? "exam" : "homework",
    course: course.name || account.school || "Google Classroom",
    date: due.date,
    time: due.time,
    url: item.alternateLink || "",
    notes: `Imported from Google Classroom${account.school ? ` for ${account.school}` : ""}.`,
  };
}

function renderSchoolImportItems(statusMessage = "") {
  const importableClasses = getImportableClasses();
  elements.schoolImportPanels.forEach((panel) => {
    const panelKind = panel.dataset.schoolImportPanel;
    const list = panel.querySelector("[data-school-import-list]");
    const status = panel.querySelector("[data-school-import-status]");
    if (statusMessage) status.textContent = statusMessage;
    list.innerHTML = "";
    const visibleItems = schoolImportItems
      .filter((item) => item.date >= todayString() && (item.kind || "homework") === panelKind)
      .sort(compareByDateTime);
    if (!visibleItems.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state compact-empty-state";
      empty.textContent = `No upcoming ${panelKind === "exam" ? "exams" : "homework"} found.`;
      list.appendChild(empty);
      return;
    }

    visibleItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "item-card school-import-card";
    const actionLabel = item.operation === "update" ? "Update planner item" : item.operation === "current" ? "Already current" : item.kind === "exam" ? "Add exam" : "Add homework";
    const cardContent = `
      <div class="item-card-top">
        <div>
          <p class="item-category">${escapeHtml(item.source)}</p>
          <h4 class="item-title">${escapeHtml(item.title)}</h4>
        </div>
        <div class="item-actions">
          <button class="small-button add-school-homework" type="button"${item.operation === "current" ? " disabled" : ""}>${actionLabel}</button>
          <button class="small-button add-school-reminder" type="button">Add reminder</button>
        </div>
      </div>
      <p class="item-meta">${escapeHtml(item.course || item.rawCourse || "Class not matched")} • ${formatShortDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ""}</p>
      <div class="field-row"><label class="field"><span>Name</span><input data-school-import-title value="${escapeHtml(item.title)}"></label><label class="field"><span>Save as</span><select data-school-import-kind><option value="homework"${item.kind !== "exam" ? " selected" : ""}>Homework</option><option value="exam"${item.kind === "exam" ? " selected" : ""}>Exam or quiz</option></select></label></div><div class="field-row"><label class="field"><span>Class</span><select data-school-import-course><option value="">Choose a class</option>${importableClasses.map((course) => `<option value="${escapeHtml(course.title)}"${course.title === item.course ? " selected" : ""}>${escapeHtml(course.title)}</option>`).join("")}</select></label><label class="field"><span>Due date</span><input data-school-import-date type="date" value="${item.date}"></label><label class="field"><span>Due time${item.missingTime ? " — not provided" : ""}</span><input data-school-import-time type="time" value="${item.time || ""}"></label></div>
      <p class="item-notes">${escapeHtml(item.url || item.notes)}</p>
    `;
    const stateLabel = item.operation === "update" ? "Changed" : item.operation === "current" ? "Current" : "New";
    card.innerHTML = `<details class="school-import-details"><summary><span>${escapeHtml(item.title)}</span><small>${formatShortDate(item.date)} · ${stateLabel}</small></summary><div class="school-import-details-body">${cardContent}</div></details>`;

    card.querySelector("[data-school-import-kind]")?.addEventListener("change", (event) => {
      item.kind = event.target.value;
      renderSchoolImportItems(`${item.title} moved to the ${item.kind === "exam" ? "Exams" : "Homework"} import list.`);
    });
    card.querySelector("[data-school-import-title]")?.addEventListener("input", (event) => { item.title = event.target.value; });
    card.querySelector("[data-school-import-date]")?.addEventListener("input", (event) => { item.date = event.target.value; });
    card.querySelector("[data-school-import-time]")?.addEventListener("input", (event) => { item.time = event.target.value; item.missingTime = !item.time; });
    card.querySelector("[data-school-import-course]")?.addEventListener("change", (event) => {
      item.course = event.target.value;
      const match = importableClasses.find((course) => course.title === item.course);
      if (match) item.color = match.color;
    });

    card.querySelector(".add-school-homework").addEventListener("click", () => {
      addSchoolItemAsHomework(item);
    });
    card.querySelector(".add-school-reminder").addEventListener("click", () => {
      addSchoolItemAsReminder(item);
    });
    list.appendChild(card);
    });
  });
}

function addSchoolItemAsHomework(item) {
  if (item.source === "Canvas calendar" && !item.course) {
    renderSchoolImportItems(`Choose a class for ${item.title} before adding it.`);
    return;
  }
  if (item.source === "Canvas calendar" && (!item.title.trim() || !item.date || !item.time)) {
    renderSchoolImportItems(`Enter the assignment name, due date, and due time for ${item.title || "this Canvas item"}.`);
    return;
  }
  const match = findMatchingImportedClass(item.course);
  const course = match?.title || item.course;
  const target = item.kind === "exam" ? state.data.exams : state.data.homework;
  const existingHomeworkIndex = state.data.homework.findIndex((saved) => saved.canvasFeedUid === item.uid);
  const existingExamIndex = state.data.exams.findIndex((saved) => saved.canvasFeedUid === item.uid);
  const existing = existingHomeworkIndex >= 0 ? state.data.homework[existingHomeworkIndex] : existingExamIndex >= 0 ? state.data.exams[existingExamIndex] : null;
  const record = {
    id: existing?.id || crypto.randomUUID(),
    title: item.title,
    course,
    date: item.date,
    time: item.time,
    status: existing?.status || "pending",
    color: match?.color || item.color || (item.kind === "exam" ? "#6d9fd0" : "#7eaed6"),
    priority: existing?.priority || false,
    notes: existing?.notes || [item.notes, item.url].filter(Boolean).join(" "),
    canvasFeedUid: item.uid || undefined,
  };
  if (existingHomeworkIndex >= 0) state.data.homework.splice(existingHomeworkIndex, 1);
  if (existingExamIndex >= 0) state.data.exams.splice(existingExamIndex, 1);
  target.push(record);
  removeImportedSchoolItem(item.id, `${item.title} was ${existing ? "updated" : `added as ${item.kind === "exam" ? "an exam" : "homework"}`}.`);
}

function addSchoolItemAsReminder(item) {
  state.data.reminders.push({
    id: crypto.randomUUID(),
    title: item.title,
    date: item.date,
    time: item.time,
    color: "#9abbd6",
    status: "pending",
    notes: [item.course, item.notes, item.url].filter(Boolean).join(" "),
  });
  removeImportedSchoolItem(item.id, `${item.title} was added as a reminder.`);
}

function removeImportedSchoolItem(itemId, statusMessage) {
  schoolImportItems = schoolImportItems.filter((item) => item.id !== itemId);
  persistAndRender();
  renderSchoolImportItems(statusMessage);
}

function persistAndRender() {
  pruneExpiredCompletedItems();
  saveData();
  render();
  scheduleCompletionSweep();
}

function saveData() {
  saveDataLocally();
  scheduleCloudSave();
}

function scheduleCloudSave() {
  if (cloudSaveTimer) {
    window.clearTimeout(cloudSaveTimer);
  }

  cloudSaveTimer = window.setTimeout(async () => {
    cloudSaveTimer = null;
    await saveDataToSupabase();
    if (state.activeTab === "settings") {
      elements.settingsStatus.textContent = lastCloudSyncMessage;
    }
  }, AUTO_SAVE_DELAY_MS);
}

function saveDataLocally() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return seedData();
    }

    const parsed = JSON.parse(stored);
    return normalizePlannerData(parsed);
  } catch (error) {
    console.error("Failed to load planner data", error);
    return seedData();
  }
}

function normalizePlannerData(data) {
  return {
    courses: Array.isArray(data?.courses) ? data.courses : [],
    homework: Array.isArray(data?.homework) ? data.homework.filter((item) => !isLegacyDemoItem(item)) : [],
    exams: Array.isArray(data?.exams) ? data.exams.filter((item) => !isLegacyDemoItem(item)) : [],
    schedule: Array.isArray(data?.schedule) ? data.schedule.filter((item) => !isLegacyDemoItem(item)) : [],
    reminders: Array.isArray(data?.reminders) ? data.reminders.filter((item) => !isLegacyDemoItem(item)) : [],
    settings: normalizeSettings(data?.settings),
  };
}

function isLegacyDemoItem(item) {
  return [
    "Finish questions 1 through 12.",
    "Upload the final PDF before class.",
    "Bring calculator and formula sheet.",
    "Bring lab notebook.",
    "Discuss slides and final edits.",
    "Ask about next semester registration.",
  ].includes(item?.notes);
}

function seedData() {
  return {
    courses: [],
    homework: [],
    exams: [],
    schedule: [],
    reminders: [],
    settings: getDefaultSettings(),
  };
}

function getSettings() {
  state.data.settings = normalizeSettings(state.data.settings);
  return state.data.settings;
}

function normalizeSettings(settings) {
  const defaults = getDefaultSettings();
  if (!settings || typeof settings !== "object") {
    return defaults;
  }

  const notificationPreference = ["email", "text", "both"].includes(
    settings.notificationPreference,
  )
    ? settings.notificationPreference
    : defaults.notificationPreference;

  return {
    name: typeof settings.name === "string" ? settings.name : defaults.name,
    email: typeof settings.email === "string" ? settings.email : defaults.email,
    phone: typeof settings.phone === "string" ? settings.phone : defaults.phone,
    widgetPreferences: normalizeWidgetPreferences(settings.widgetPreferences),
    notificationPreference,
    notificationSchedule: normalizeNotificationSchedule(settings.notificationSchedule),
    academicCalendar: normalizeAcademicCalendar(settings.academicCalendar),
    school: typeof settings.school === "string" ? settings.school : defaults.school,
    canvasUrl:
      typeof settings.canvasUrl === "string" ? normalizeUrl(settings.canvasUrl) : defaults.canvasUrl,
    schoolUsername:
      typeof settings.schoolUsername === "string"
        ? settings.schoolUsername
        : defaults.schoolUsername,
    connections: normalizeConnections(settings.connections),
    schoolAccounts: normalizeSchoolAccounts(settings),
    canvasFeedUrl: typeof settings.canvasFeedUrl === "string" ? settings.canvasFeedUrl : defaults.canvasFeedUrl,
    canvasShortcut: {
      school: typeof settings.canvasShortcut?.school === "string" ? settings.canvasShortcut.school : defaults.canvasShortcut.school,
      url: normalizeCanvasShortcutUrl(settings.canvasShortcut?.url) || defaults.canvasShortcut.url,
    },
  };
}

function getDefaultSettings() {
  return {
    name: "",
    email: "",
    phone: "",
    widgetPreferences: {
      defaultView: "today",
      startScreen: "calendar",
      plannerUrl: "",
      daysAhead: "all",
      itemLimit: 5,
      classes: true,
      homework: true,
      events: true,
      exams: true,
      reminders: true,
    },
    notificationPreference: "email",
    academicCalendar: { schoolName: "", academicYear: "", termSystem: "semester", termName: "", start: "", end: "", breaks: [] },
    notificationSchedule: {
      frequency: "daily",
      homework: true,
      events: true,
      classes: true,
      exams: true,
      reminders: true,
      dayScheduler: true,
      schoolAccounts: true,
      schoolImports: true,
      settings: true,
      calendar: true,
      lastNotifiedAt: "",
      weeklyScheduleReminder: { enabled: false, delivery: "email", day: 0, time: "18:00", timezone: "UTC", lastSentKey: "" },
    },
    school: "",
    canvasUrl: "",
    canvasShortcut: { school: "", url: "" },
    schoolUsername: "",
    connections: {
      canvas: false,
      googleClassroom: false,
    },
    schoolAccounts: [],
    canvasFeedUrl: "",
  };
}

function normalizeAcademicCalendar(calendar) {
  if (!calendar || typeof calendar !== "object") return { schoolName: "", academicYear: "", termSystem: "semester", termName: "", start: "", end: "", breaks: [] };
  return {
    schoolName: typeof calendar.schoolName === "string" ? calendar.schoolName : "",
    academicYear: typeof calendar.academicYear === "string" ? calendar.academicYear : "",
    termSystem: ["quarter", "semester", "trimester"].includes(calendar.termSystem) ? calendar.termSystem : "semester",
    termName: typeof calendar.termName === "string" ? calendar.termName : "",
    start: /^\d{4}-\d{2}-\d{2}$/.test(calendar.start || "") ? calendar.start : "",
    end: /^\d{4}-\d{2}-\d{2}$/.test(calendar.end || "") ? calendar.end : "",
    breaks: Array.isArray(calendar.breaks) ? calendar.breaks.filter((range) => /^\d{4}-\d{2}-\d{2}$/.test(range?.start || "") && /^\d{4}-\d{2}-\d{2}$/.test(range?.end || "")).map((range) => ({ name: typeof range.name === "string" ? range.name : "Break", start: range.start, end: range.end })) : [],
  };
}

function normalizeWidgetPreferences(preferences) {
  const defaults = getDefaultSettings().widgetPreferences;
  return {
    defaultView: ["all", "today", "classes", "homework", "reminders", "tasks", "exams", "events"].includes(preferences?.defaultView)
      ? preferences.defaultView
      : defaults.defaultView,
    startScreen: PLANNER_TABS.includes(preferences?.startScreen)
      ? preferences.startScreen
      : defaults.startScreen,
    plannerUrl: typeof preferences?.plannerUrl === "string"
      ? preferences.plannerUrl.trim().replace(/\/$/, "")
      : defaults.plannerUrl,
    daysAhead: preferences?.daysAhead === "all" || [1, 3, 7, 14].includes(Number(preferences?.daysAhead))
      ? (preferences.daysAhead === "all" ? "all" : Number(preferences.daysAhead))
      : defaults.daysAhead,
    itemLimit: [3, 5, 8, 10, 12, 14].includes(Number(preferences?.itemLimit))
      ? Number(preferences.itemLimit)
      : defaults.itemLimit,
    classes: typeof preferences?.classes === "boolean" ? preferences.classes : defaults.classes,
    homework: typeof preferences?.homework === "boolean" ? preferences.homework : defaults.homework,
    events: typeof preferences?.events === "boolean" ? preferences.events : defaults.events,
    exams: typeof preferences?.exams === "boolean" ? preferences.exams : defaults.exams,
    reminders: typeof preferences?.reminders === "boolean" ? preferences.reminders : defaults.reminders,
  };
}

function getInitialTab() {
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  return PLANNER_TABS.includes(requestedTab) ? requestedTab : "calendar";
}

function getCurrentPlannerUrl() {
  return /^https?:$/.test(window.location.protocol) ? window.location.origin : "";
}

function normalizeNotificationSchedule(schedule) {
  const defaults = getDefaultSettings().notificationSchedule;
  const frequency = ["daily", "weekly", "monthly"].includes(schedule?.frequency)
    ? schedule.frequency
    : defaults.frequency;

  return {
    frequency,
    homework:
      typeof schedule?.homework === "boolean" ? schedule.homework : defaults.homework,
    events: typeof schedule?.events === "boolean" ? schedule.events : defaults.events,
    classes: typeof schedule?.classes === "boolean" ? schedule.classes : defaults.classes,
    exams: typeof schedule?.exams === "boolean" ? schedule.exams : defaults.exams,
    reminders:
      typeof schedule?.reminders === "boolean" ? schedule.reminders : defaults.reminders,
    dayScheduler:
      typeof schedule?.dayScheduler === "boolean"
        ? schedule.dayScheduler
        : defaults.dayScheduler,
    schoolAccounts:
      typeof schedule?.schoolAccounts === "boolean"
        ? schedule.schoolAccounts
        : defaults.schoolAccounts,
    schoolImports:
      typeof schedule?.schoolImports === "boolean"
        ? schedule.schoolImports
        : defaults.schoolImports,
    settings:
      typeof schedule?.settings === "boolean" ? schedule.settings : defaults.settings,
    calendar:
      typeof schedule?.calendar === "boolean" ? schedule.calendar : defaults.calendar,
    lastNotifiedAt:
      typeof schedule?.lastNotifiedAt === "string" ? schedule.lastNotifiedAt : "",
    weeklyScheduleReminder: normalizeWeeklyScheduleReminder(schedule?.weeklyScheduleReminder, defaults.weeklyScheduleReminder),
  };
}

function normalizeWeeklyScheduleReminder(reminder, defaults) {
  return { enabled: typeof reminder?.enabled === "boolean" ? reminder.enabled : defaults.enabled, delivery: ["email", "text", "both"].includes(reminder?.delivery) ? reminder.delivery : defaults.delivery, day: Number.isInteger(reminder?.day) && reminder.day >= 0 && reminder.day <= 6 ? reminder.day : defaults.day, time: /^\d{2}:\d{2}$/.test(reminder?.time || "") ? reminder.time : defaults.time, timezone: typeof reminder?.timezone === "string" && reminder.timezone ? reminder.timezone : defaults.timezone, lastSentKey: typeof reminder?.lastSentKey === "string" ? reminder.lastSentKey : "" };
}

function normalizeSchoolAccounts(settings) {
  if (Array.isArray(settings?.schoolAccounts)) {
    return settings.schoolAccounts.map(normalizeSchoolAccount).filter((account) => account.school);
  }

  if (typeof settings?.school === "string" && settings.school) {
    return [
      normalizeSchoolAccount({
        school: settings.school,
        canvasUrl: settings.canvasUrl,
        username: settings.schoolUsername,
        connections: settings.connections,
      }),
    ];
  }

  return [];
}

function normalizeSchoolAccount(account) {
  return {
    id: typeof account.id === "string" && account.id ? account.id : crypto.randomUUID(),
    school: typeof account.school === "string" ? account.school : "",
    canvasUrl: typeof account.canvasUrl === "string" ? normalizeUrl(account.canvasUrl) : "",
    username: typeof account.username === "string" ? account.username : "",
    password: typeof account.password === "string" ? account.password : "",
    canvasToken: typeof account.canvasToken === "string" ? account.canvasToken : "",
    classroomToken: typeof account.classroomToken === "string" ? account.classroomToken : "",
    connections: normalizeConnections(account.connections),
  };
}

function normalizeConnections(connections) {
  return {
    canvas: Boolean(connections?.canvas),
    googleClassroom: Boolean(connections?.googleClassroom),
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch (error) {
    return value;
  }
}

function normalizeCanvasShortcutUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return "";
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`;
  } catch (error) {
    return "";
  }
}

function renderCanvasShortcut() {
  const shortcut = getSettings().canvasShortcut;
  elements.openCanvas.title = shortcut.url ? `Open ${shortcut.school || "Canvas"}` : "Set up Canvas shortcut";
  elements.openCanvas.classList.toggle("is-unconfigured", !shortcut.url);
}

function openCanvasShortcut() {
  const shortcut = getSettings().canvasShortcut;
  if (!shortcut.url) {
    setActiveTab("settings");
    const accordion = elements.settingsCanvasShortcutUrl.closest("details");
    if (accordion) accordion.open = true;
    elements.settingsCanvasShortcutUrl.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => elements.settingsCanvasShortcutSchool.focus(), 350);
    elements.settingsStatus.textContent = "Add your school name and Canvas link, then save settings.";
    return;
  }
  const canvasWindow = window.open(shortcut.url, "_blank");
  if (canvasWindow) canvasWindow.opener = null;
  else elements.settingsStatus.textContent = "Your browser blocked the Canvas tab. Allow pop-ups and try again.";
}

function formatNotificationPreference(preference) {
  if (preference === "text") {
    return "Text";
  }

  if (preference === "both") {
    return "Email and text";
  }

  return "Email";
}

function formatNotificationSchedule(schedule) {
  const topics = getNotificationTopicLabels(schedule);
  return `${capitalize(schedule.frequency)}: ${topics.length ? formatList(topics) : "nothing selected"}`;
}

function getNotificationTopicLabels(schedule) {
  return [
    ["homework", schedule.homework],
    ["events", schedule.events],
    ["classes", schedule.classes],
    ["exams", schedule.exams],
    ["other reminders", schedule.reminders],
    ["day scheduler", schedule.dayScheduler],
    ["school accounts", schedule.schoolAccounts],
    ["school imports", schedule.schoolImports],
    ["settings", schedule.settings],
    ["calendar updates", schedule.calendar],
  ]
    .filter(([, enabled]) => enabled)
    .map(([label]) => label);
}

function formatList(items) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatSchoolConnections(connections) {
  const enabled = [];

  if (connections.canvas) {
    enabled.push("Canvas");
  }

  if (connections.googleClassroom) {
    enabled.push("Google Classroom");
  }

  return enabled.length ? enabled.join(", ") : "Not connected";
}

function parseSchoolDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    date: isoDate(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function parseGoogleDueDate(dueDate, dueTime) {
  if (!dueDate?.year || !dueDate?.month || !dueDate?.day) {
    return null;
  }

  return {
    date: `${String(dueDate.year).padStart(4, "0")}-${String(dueDate.month).padStart(2, "0")}-${String(dueDate.day).padStart(2, "0")}`,
    time:
      dueTime && Number.isInteger(dueTime.hours)
        ? `${String(dueTime.hours).padStart(2, "0")}:${String(dueTime.minutes || 0).padStart(2, "0")}`
        : "",
  };
}

function dedupeSchoolItems(items) {
  const existing = new Set([
    ...state.data.homework.map((item) => `${item.title}|${item.course}|${item.date}`),
    ...state.data.exams.map((item) => `${item.title}|${item.course}|${item.date}`),
    ...state.data.reminders.map((item) => `${item.title}|${item.date}`),
  ]);
  const seen = new Set();

  return items.filter((item) => {
    if (!item.date || item.date < todayString()) return false;
    const importedKey = `${item.source}|${item.id}`;
    const homeworkKey = `${item.title}|${item.course}|${item.date}`;
    const reminderKey = `${item.title}|${item.date}`;

    if (seen.has(importedKey) || existing.has(homeworkKey) || existing.has(reminderKey)) {
      return false;
    }

    seen.add(importedKey);
    return true;
  });
}

function getItemsForDate(date) {
  const homework = state.data.homework
    .filter((item) => item.date === date)
    .map((item) => ({
      sourceId: item.id,
      kind: "homework",
      label: "Homework",
      title: item.title,
      meta: `${item.course}${item.time ? ` • Due at ${formatTime(item.time)}` : ""}${item.status === "done" ? " • Done" : ""}`,
      notes: item.notes,
      color: getStoredItemColor("homework", item),
      status: item.status,
      displayTime: item.time ? formatTime(item.time) : "",
      sortKey: item.time || "23:59",
    }));

  const exams = state.data.exams
    .filter((item) => item.date === date)
    .map((item) => ({
      sourceId: item.id,
      kind: "exam",
      label: "Exam",
      title: item.title,
      meta: `${item.course}${item.time ? ` • ${formatTime(item.time)}` : ""}${item.status === "done" ? " • Done" : ""}`,
      notes: item.notes,
      color: getStoredItemColor("exams", item),
      status: item.status || "pending",
      displayTime: item.time ? formatTime(item.time) : "",
      sortKey: item.time || "23:57",
    }));

  const schedule = state.data.schedule
    .filter((item) => item.date === date)
    .map((item) => ({
      sourceId: item.id,
      sourceType: item.type,
      kind: item.type === "event" ? "event" : "class",
      label: item.type === "class" ? "Class" : "Scheduled event",
      title: item.title,
      meta: `${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}${item.type === "event" && item.status === "done" ? " • Done" : ""}`,
      notes: item.notes,
      color: getStoredItemColor("schedule", item),
      status: item.type === "event" ? item.status || "pending" : "pending",
      displayTime: item.start ? formatTime(item.start) : "",
      sortKey: item.start,
    }));

  const reminders = state.data.reminders
    .filter((item) => item.date === date)
    .map((item) => ({
      sourceId: item.id,
      kind: "reminder",
      label: "Reminder",
      title: item.title,
      meta: `${item.time ? formatTime(item.time) : "Any time"}${item.status === "done" ? " • Done" : ""}`,
      notes: item.notes,
      color: getStoredItemColor("reminders", item),
      status: item.status || "pending",
      displayTime: item.time ? formatTime(item.time) : "",
      sortKey: item.time || "23:58",
    }));

  return [...schedule, ...exams, ...homework, ...reminders].sort((left, right) =>
    left.sortKey.localeCompare(right.sortKey),
  );
}

function upsertItem(collection, nextItem) {
  const index = collection.findIndex((item) => item.id === nextItem.id);

  if (index >= 0) {
    collection.splice(index, 1, nextItem);
  } else {
    collection.push(nextItem);
  }
}

function getExistingStatus(collection, id) {
  if (!id) {
    return "pending";
  }

  return collection.find((item) => item.id === id)?.status || "pending";
}

function getExistingCompletedAt(collection, id, status) {
  if (status !== "done") {
    return "";
  }

  const existing = id ? collection.find((item) => item.id === id) : null;
  return existing?.completedAt || String(Date.now());
}

function setItemStatus(item, status) {
  item.status = status;
  item.completedAt = status === "done" ? String(Date.now()) : "";
}

function pruneExpiredCompletedItems() {
  const now = Date.now();
  state.data.homework = state.data.homework.filter((item) => !isExpiredCompletedItem(item, now));
  state.data.exams = state.data.exams.filter((item) => !isExpiredCompletedItem(item, now));
  state.data.reminders = state.data.reminders.filter((item) => !isExpiredCompletedItem(item, now));
  state.data.schedule = state.data.schedule.filter((item) =>
    item.type === "event" ? !isExpiredCompletedItem(item, now) : true,
  );
}

function isExpiredCompletedItem(item, now = Date.now()) {
  if (item.status !== "done" || !item.completedAt) {
    return false;
  }

  return now - Number(item.completedAt) >= DONE_DISAPPEAR_DELAY_MS;
}

function scheduleCompletionSweep() {
  if (completionSweepTimer) {
    window.clearTimeout(completionSweepTimer);
    completionSweepTimer = null;
  }

  const now = Date.now();
  const nextExpiryAt = getTrackedItems()
    .filter((item) => item.status === "done" && item.completedAt)
    .map((item) => Number(item.completedAt) + DONE_DISAPPEAR_DELAY_MS)
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > now)
    .sort((left, right) => left - right)[0];

  if (!nextExpiryAt) {
    return;
  }

  completionSweepTimer = window.setTimeout(() => {
    persistAndRender();
  }, Math.max(nextExpiryAt - now, 0) + 20);
}

function getTrackedItems() {
  return [
    ...state.data.homework,
    ...state.data.exams,
    ...state.data.reminders,
    ...state.data.schedule.filter((item) => item.type === "event"),
  ];
}

function buildRepeatedScheduleItems(baseItem, kind, existingSeriesId = "") {
  const repeatDates = buildRepeatDates(kind, baseItem.date);
  if (!repeatDates) {
    return null;
  }

  const repeatMode = getRepeatMode(kind);
  const repeatForever = getRepeatForever(kind);
  const seriesId = existingSeriesId || crypto.randomUUID();
  return repeatDates.filter((date) => kind !== "class" || isActiveClassDate(date)).map((date) => ({
    ...baseItem,
    id: crypto.randomUUID(),
    date,
    repeatMode,
    repeatForever,
    seriesId,
  }));
}

function buildRepeatedCollectionItems(baseItem, kind, existingSeriesId = "") {
  const repeatDates = buildRepeatDates(kind, baseItem.date);
  if (!repeatDates) {
    return null;
  }

  const repeatMode = getRepeatMode(kind);
  const repeatForever = getRepeatForever(kind);
  const seriesId = existingSeriesId || crypto.randomUUID();
  return repeatDates.map((date) => ({
    ...baseItem,
    id: crypto.randomUUID(),
    date,
    repeatMode,
    repeatForever,
    seriesId,
  }));
}

function buildRepeatDates(kind, startDate) {
  const repeatUntil = getRepeatForever(kind)
    ? offsetDate(startDate, FOREVER_REPEAT_YEARS * 366)
    : getRepeatUntil(kind);
  const repeatMode = getRepeatMode(kind);

  if (!repeatUntil) {
    window.alert("Choose a repeat-until date or select Forever for repeating items.");
    return null;
  }

  if (repeatUntil < startDate) {
    window.alert("Repeat-until date needs to be after the first date.");
    return null;
  }

  const occurrences = [];

  if (repeatMode === "monthly") {
    let monthOffset = 0;
    let currentDate = startDate;

    while (currentDate && currentDate <= repeatUntil) {
      occurrences.push(currentDate);

      monthOffset += 1;
      currentDate = offsetMonthPreserveDay(startDate, monthOffset);
    }

    return occurrences;
  }

  const selectedDays = getSelectedRepeatDays(kind);
  if (!selectedDays.length) {
    window.alert("Pick at least one weekday to repeat on.");
    return null;
  }

  let currentDate = startDate;

  while (currentDate <= repeatUntil) {
    if (selectedDays.includes(new Date(`${currentDate}T00:00:00`).getDay())) {
      occurrences.push(currentDate);
    }

    currentDate = offsetDate(currentDate, 1);
  }

  return occurrences;
}

function setRepeatDaysFromSeries(kind, items) {
  clearRepeatDays(kind);
  const repeatMode = items[0]?.repeatMode || "weekly";
  if (repeatMode === "monthly") {
    return;
  }

  const values = new Set(
    items.map((item) => String(new Date(`${item.date}T00:00:00`).getDay())),
  );
  const { days: inputs } = getRepeatElements(kind);
  inputs.forEach((input) => {
    input.checked = values.has(input.value);
  });
}

function formatRepeatDaysFromItems(items) {
  if ((items[0]?.repeatMode || "weekly") === "monthly") {
    return "Monthly";
  }

  const weekdayValues = Array.from(
    new Set(items.map((item) => new Date(`${item.date}T00:00:00`).getDay())),
  ).sort((left, right) => weekdayOrder(left) - weekdayOrder(right));

  return weekdayValues
    .map((value) =>
      new Date(2024, 0, value === 0 ? 7 : value).toLocaleDateString(undefined, {
        weekday: "short",
      }),
    )
    .join(", ");
}

function formatRepeatSummary(item) {
  return item.repeatMode === "monthly" ? "Monthly repeat" : "Weekly repeat";
}

function weekdayOrder(day) {
  return day === 0 ? 7 : day;
}

function getColorSourceItems() {
  return [
    ...state.data.schedule.map((item) => ({
      key: makeSourceKey("schedule", item.id),
      label: `${item.type === "class" ? "Class" : "Event"}: ${item.title}`,
    })),
    ...state.data.homework.map((item) => ({
      key: makeSourceKey("homework", item.id),
      label: `Homework: ${item.title}`,
    })),
    ...state.data.exams.map((item) => ({
      key: makeSourceKey("exams", item.id),
      label: `Exam: ${item.title}`,
    })),
    ...state.data.reminders.map((item) => ({
      key: makeSourceKey("reminders", item.id),
      label: `Reminder: ${item.title}`,
    })),
  ];
}

function getStoredItemColor(collectionName, item, visited = new Set()) {
  const sourceKey = makeSourceKey(collectionName, item.id);
  if (visited.has(sourceKey)) {
    return normalizeColor(item.color, "#7eaed6");
  }

  if (item.matchSourceKey) {
    const target = findSourceItem(item.matchSourceKey);
    if (target) {
      const nextVisited = new Set(visited);
      nextVisited.add(sourceKey);
      return getStoredItemColor(target.collectionName, target.item, nextVisited);
    }
  }

  return normalizeColor(item.color, "#7eaed6");
}

function findSourceItem(sourceKey) {
  const [collectionName, itemId] = sourceKey.split(":");
  const collection = state.data[collectionName];
  if (!Array.isArray(collection)) {
    return null;
  }

  const item = collection.find((entry) => entry.id === itemId);
  return item ? { collectionName, item } : null;
}

function makeSourceKey(collectionName, itemId) {
  return `${collectionName}:${itemId}`;
}

function getCalendarMarkerPrefix(kind) {
  if (kind === "homework") {
    return "H";
  }

  if (kind === "exam") {
    return "E";
  }

  if (kind === "reminder") {
    return "OR";
  }

  return "";
}

function toggleMatchOptions(prefix) {
  const checkbox = getElementByPrefix(prefix, "MatchColor");
  const options = getElementByPrefix(prefix, "MatchOptions");
  const select = getElementByPrefix(prefix, "MatchSource");
  const colorInput = getElementByPrefix(prefix, "Color");
  const enabled = checkbox.checked;

  options.classList.toggle("is-disabled", !enabled);
  select.disabled = !enabled;
  select.required = enabled;
  colorInput.disabled = enabled;
  if (enabled) updateMatchedColorPreview(prefix);
}

function updateMatchedColorPreview(prefix) {
  const select = getElementByPrefix(prefix, "MatchSource");
  const colorInput = getElementByPrefix(prefix, "Color");
  const target = findSourceItem(select.value);
  if (target) colorInput.value = getStoredItemColor(target.collectionName, target.item);
}

function setMatchSelection(prefix, sourceKey) {
  const checkbox = getElementByPrefix(prefix, "MatchColor");
  const select = getElementByPrefix(prefix, "MatchSource");
  checkbox.checked = Boolean(sourceKey);
  select.value = sourceKey || "";
  toggleMatchOptions(prefix);
}

function getMatchSourceValue(prefix) {
  const checkbox = getElementByPrefix(prefix, "MatchColor");
  const select = getElementByPrefix(prefix, "MatchSource");
  return checkbox.checked ? select.value : "";
}

function getElementByPrefix(prefix, suffix) {
  return elements[`${prefix}${suffix}`];
}

function toggleRepeatOptions(kind) {
  const { toggle: repeatToggle, options: repeatOptions, weekdays: repeatWeekdays, forever, until } =
    getRepeatElements(kind);
  const repeatMode = getRepeatMode(kind);
  const isEnabled = repeatToggle.checked;
  const showWeekdays = isEnabled && repeatMode === "weekly";
  const repeatsForever = isEnabled && forever.checked;

  repeatOptions.classList.toggle("is-disabled", !isEnabled);
  repeatWeekdays.hidden = !showWeekdays;
  until.disabled = !isEnabled || repeatsForever;
  if (repeatsForever) {
    until.value = "";
  }
  repeatOptions
    .querySelectorAll("input, select")
    .forEach((input) => {
      const isWeekdayInput = input.name === `${kind}-repeat-day`;
      if (input === until) {
        return;
      }

      input.disabled = !isEnabled || (isWeekdayInput && repeatMode !== "weekly");
    });
}

function ensureRepeatSelection(kind) {
  const { toggle: repeatToggle } = getRepeatElements(kind);
  if (!repeatToggle.checked || getRepeatMode(kind) !== "weekly") {
    return;
  }

  const selectedDays = getSelectedRepeatDays(kind);
  if (!selectedDays.length) {
    syncRepeatSelectionWithDate(kind, true);
  }
}

function syncRepeatSelectionWithDate(kind, force = false) {
  if (getRepeatMode(kind) !== "weekly") {
    return;
  }

  const { dateInput, days } = getRepeatElements(kind);
  const dateValue = dateInput.value;
  if (!dateValue) {
    return;
  }

  const hasCheckedDay = days.some((input) => input.checked);
  if (hasCheckedDay && !force) {
    return;
  }

  const weekday = new Date(`${dateValue}T00:00:00`).getDay();
  days.forEach((input) => {
    input.checked = Number(input.value) === weekday;
  });
}

function clearRepeatDays(kind) {
  const { days } = getRepeatElements(kind);
  days.forEach((input) => {
    input.checked = false;
  });
}

function getSelectedRepeatDays(kind) {
  const { days } = getRepeatElements(kind);
  return days.filter((input) => input.checked).map((input) => Number(input.value));
}

function getRepeatUntil(kind) {
  const { until } = getRepeatElements(kind);
  return until.value;
}

function getRepeatForever(kind) {
  const { forever } = getRepeatElements(kind);
  return forever.checked;
}

function getRepeatMode(kind) {
  const { mode } = getRepeatElements(kind);
  return mode.value;
}

function getRepeatElements(kind) {
  if (kind === "class") {
    return {
      toggle: elements.classRepeat,
      options: elements.classRepeatOptions,
      weekdays: elements.classRepeatWeekdays,
      days: elements.classRepeatDays,
      until: elements.classRepeatUntil,
      forever: elements.classRepeatForever,
      mode: elements.classRepeatMode,
      dateInput: elements.classDate,
    };
  }

  if (kind === "event") {
    return {
      toggle: elements.eventRepeat,
      options: elements.eventRepeatOptions,
      weekdays: elements.eventRepeatWeekdays,
      days: elements.eventRepeatDays,
      until: elements.eventRepeatUntil,
      forever: elements.eventRepeatForever,
      mode: elements.eventRepeatMode,
      dateInput: elements.eventDate,
    };
  }

  if (kind === "homework") {
    return {
      toggle: elements.homeworkRepeat,
      options: elements.homeworkRepeatOptions,
      weekdays: elements.homeworkRepeatWeekdays,
      days: elements.homeworkRepeatDays,
      until: elements.homeworkRepeatUntil,
      forever: elements.homeworkRepeatForever,
      mode: elements.homeworkRepeatMode,
      dateInput: elements.homeworkDate,
    };
  }

  return {
    toggle: elements.reminderRepeat,
    options: elements.reminderRepeatOptions,
    weekdays: elements.reminderRepeatWeekdays,
    days: elements.reminderRepeatDays,
    until: elements.reminderRepeatUntil,
    forever: elements.reminderRepeatForever,
    mode: elements.reminderRepeatMode,
    dateInput: elements.reminderDate,
  };
}

function applyItemColor(element, color) {
  element.style.setProperty("--item-color", normalizeColor(color, "#7eaed6"));
}

function normalizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function compareByDateTime(left, right) {
  return `${left.date}${left.time || left.start || ""}`.localeCompare(
    `${right.date}${right.time || right.start || ""}`,
  );
}

function formatLongDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function startOfMonth(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(1);
  return isoDate(date);
}

function offsetMonth(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setMonth(date.getMonth() + amount, 1);
  return isoDate(date);
}

function offsetMonthPreserveDay(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  const targetDay = date.getDate();
  const probe = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const targetMonth = probe.getMonth();
  const targetYear = probe.getFullYear();
  const candidate = new Date(targetYear, targetMonth, targetDay);

  if (candidate.getFullYear() !== targetYear || candidate.getMonth() !== targetMonth) {
    return null;
  }

  return isoDate(candidate);
}

function offsetDate(dateString, amount) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function todayString() {
  return isoDate(new Date());
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
