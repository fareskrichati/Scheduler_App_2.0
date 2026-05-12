const STORAGE_KEY = "pulse-planner-v2";
const AUTH_KEY = "pulse-planner-auth-v1";
const SESSION_KEY = "pulse-planner-session-v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLOR_MATCH_PREFIXES = ["class", "event", "homework", "exam", "reminder"];
const DONE_DISAPPEAR_DELAY_MS = 30000;
const NOTIFICATION_CHECK_INTERVAL_MS = 60000;
const FOREVER_REPEAT_YEARS = 5;
const SUPABASE_TABLE = "planner_profiles";

let completionSweepTimer = null;
let notificationTimer = null;
let schoolImportItems = [];
let pendingFirstLogin = null;
let lastCloudSyncMessage = "";
let supabaseSetupMessage = "";
const supabaseClient = createSupabaseClient();
if (supabaseClient) {
  clearLegacyLocalLogin();
}
const savedAuthProfile = supabaseClient ? null : loadAuthProfile();
let authMode = supabaseClient || savedAuthProfile ? "login" : "signup";

const state = {
  activeTab: "calendar",
  selectedDate: todayString(),
  visibleMonth: startOfMonth(todayString()),
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
  jumpToday: document.querySelector("#jump-today"),
  quickAdd: document.querySelector("#quick-add"),
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
  prevMonth: document.querySelector("#prev-month"),
  nextMonth: document.querySelector("#next-month"),
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
  fetchSchoolItems: document.querySelector("#fetch-school-items"),
  clearSchoolImports: document.querySelector("#clear-school-imports"),
  schoolImportStatus: document.querySelector("#school-import-status"),
  schoolImportList: document.querySelector("#school-import-list"),
};

initialize();

async function initialize() {
  pruneExpiredCompletedItems();
  renderWeekdays();
  bindEvents();
  await restoreSupabaseSession();
  syncSettingsFromAuthProfile();
  toggleRepeatOptions("class");
  toggleRepeatOptions("event");
  toggleRepeatOptions("homework");
  toggleRepeatOptions("reminder");
  COLOR_MATCH_PREFIXES.forEach((prefix) => {
    toggleMatchOptions(prefix);
  });
  render();
  updateAuthView();
  scheduleCompletionSweep();
  scheduleNotificationCheck();
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

  elements.jumpToday.addEventListener("click", () => {
    state.selectedDate = todayString();
    state.visibleMonth = startOfMonth(state.selectedDate);
    setActiveTab("calendar");
    render();
    elements.tabShell?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  elements.quickAdd.addEventListener("click", () => {
    setActiveTab("classes");
    elements.classTitle.focus();
  });

  elements.prevMonth.addEventListener("click", () => {
    state.visibleMonth = offsetMonth(state.visibleMonth, -1);
    renderCalendar();
  });

  elements.nextMonth.addEventListener("click", () => {
    state.visibleMonth = offsetMonth(state.visibleMonth, 1);
    renderCalendar();
  });

  elements.classForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveClassItem();
  });

  elements.classReset.addEventListener("click", resetClassForm);
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
  elements.homeworkRepeatForever.addEventListener("change", () => toggleRepeatOptions("homework"));

  elements.examForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveExam();
  });

  elements.examReset.addEventListener("click", resetExamForm);
  elements.examMatchColor.addEventListener("change", () => toggleMatchOptions("exam"));

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
  elements.reminderRepeatForever.addEventListener("change", () => toggleRepeatOptions("reminder"));

  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSettings();
  });

  elements.settingsReset.addEventListener("click", resetSettingsForm);
  elements.settingsLogout.addEventListener("click", logout);
  elements.settingsChangePassword.addEventListener("click", changeLoginPassword);
  elements.settingsAddSchoolAccount.addEventListener("click", saveSchoolAccountFromForm);
  elements.settingsClearSchoolAccount.addEventListener("click", clearSchoolAccountForm);
  elements.sendDaySchedulePdf.addEventListener("click", sendDaySchedulePdf);
  elements.syncNow.addEventListener("click", syncNow);
  elements.fetchSchoolItems.addEventListener("click", fetchSchoolItems);
  elements.clearSchoolImports.addEventListener("click", () => {
    schoolImportItems = [];
    renderSchoolImportItems("Import results cleared.");
  });

  window.addEventListener("focus", () => {
    refreshCloudData();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshCloudData();
    }
  });
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

  if (supabaseClient) {
    await loginWithSupabase(email, password);
    return;
  }

  if (!authState.profile) {
    elements.loginStatus.textContent =
      supabaseSetupMessage ||
      "No cloud login is connected on this site yet. Choose Sign up to create an account.";
    setAuthMode("login", { keepStatus: true });
    return;
  }

  if (email !== authState.profile.email || password !== authState.profile.password) {
    elements.loginStatus.textContent = "Email or password does not match.";
    return;
  }

  authState.isAuthenticated = true;
  saveLoginSession();
  syncSettingsFromAuthProfile();
  saveData();
  renderSettings("Logged in.");
  updateAuthView();
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

  if (supabaseClient) {
    await signUpWithSupabase(fullName, phone);
    return;
  }

  authState.profile = {
    email: pendingFirstLogin.email,
    password: pendingFirstLogin.password,
    name: fullName,
    phone,
    createdAt: new Date().toISOString(),
  };
  authState.isAuthenticated = true;
  pendingFirstLogin = null;

  localStorage.setItem(AUTH_KEY, JSON.stringify(authState.profile));
  saveLoginSession();
  authMode = "login";
  syncSettingsFromAuthProfile();
  saveData();
  renderSettings("Profile details were added from login.");
  updateAuthView();
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
  if (!supabaseClient) {
    renderSettings("Supabase is not connected. Add the URL and anon key in js/config.js.");
    return;
  }

  if (!authState.isAuthenticated || !authState.userId) {
    renderSettings("Log in before syncing.");
    return;
  }

  elements.syncNow.disabled = true;
  elements.settingsStatus.textContent = "Syncing...";
  await saveDataToSupabase();

  const savedMessage = lastCloudSyncMessage;
  const cloudData = await loadDataFromSupabase(authState.userId);
  if (cloudData) {
    state.data = cloudData;
    syncSettingsFromAuthProfile();
    saveDataLocally();
  }

  elements.syncNow.disabled = false;
  render();
  renderSettings(savedMessage || lastCloudSyncMessage || "Sync complete.");
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

  if (supabaseClient) {
    supabaseClient.auth.updateUser({
      data: {
        name: authState.profile.name,
        phone: authState.profile.phone,
      },
    });
    return;
  }

  localStorage.setItem(AUTH_KEY, JSON.stringify(authState.profile));
}

function saveLoginSession() {
  if (supabaseClient) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  localStorage.setItem(SESSION_KEY, "active");
}

function clearLegacyLocalLogin() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function render() {
  renderTabs();
  renderHeaderStats();
  renderCalendar();
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
    state.data.homework.filter((item) => item.status !== "done").length,
  );
  elements.examCount.textContent = String(state.data.exams.length);
  elements.todayClassesCount.textContent = String(countGroupedItemsOnDate("class", today));
  elements.reminderCount.textContent = String(
    groupReminderEntries().filter((item) => item.status !== "done").length,
  );
}

function renderCalendar() {
  const monthDate = new Date(`${state.visibleMonth}T00:00:00`);
  elements.calendarMonthLabel.textContent = monthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  elements.calendarGrid.innerHTML = "";

  const firstDay = new Date(monthDate);
  const startOffset = firstDay.getDay();
  firstDay.setDate(firstDay.getDate() - startOffset);

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(firstDay);
    current.setDate(firstDay.getDate() + index);
    const dateString = isoDate(current);
    const items = getItemsForDate(dateString);
    const button = document.createElement("button");
    const isSelected = dateString === state.selectedDate;
    const isToday = dateString === todayString();
    const isOtherMonth = current.getMonth() !== monthDate.getMonth();

    button.type = "button";
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
    number.textContent = String(current.getDate());
    button.appendChild(number);

    const markers = document.createElement("div");
    markers.className = "calendar-markers";

    items.slice(0, 3).forEach((item) => {
      const marker = document.createElement("div");
      marker.className = `calendar-marker marker-${item.kind}`;
      marker.textContent = `${getCalendarMarkerPrefix(item.kind)} ${item.title}`;
      applyItemColor(marker, item.color);
      markers.appendChild(marker);
    });

    if (items.length > 3) {
      const extra = document.createElement("div");
      extra.className = "calendar-marker";
      extra.textContent = `+${items.length - 3} more`;
      markers.appendChild(extra);
    }

    button.appendChild(markers);
    button.addEventListener("click", () => {
      state.selectedDate = dateString;
      renderHeaderStats();
      renderCalendar();
      renderSelectedDayViews();
      prefillForms();
    });

    elements.calendarGrid.appendChild(button);
  }
}

function renderSelectedDayViews() {
  const formattedDate = formatLongDate(state.selectedDate);
  elements.selectedDateTitle.textContent = formattedDate;
  elements.daySchedulerTitle.textContent = formattedDate;

  const items = getItemsForDate(state.selectedDate);
  renderDaySummary(elements.calendarDaySummary, items);
  renderDaySummary(elements.daySchedulerSummary, items);
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
  const sorted = [...state.data.homework]
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

function renderExamList() {
  const sorted = [...state.data.exams]
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
  const sorted = groupScheduleEntries("class");
  renderCollection({
    target: elements.classList,
    items: sorted,
    emptyMessage: "No classes added yet.",
    config: {
      category: "Class",
      meta: (item) =>
        item.grouped
          ? `${item.repeatSummary} • ${formatShortDate(item.date)} - ${formatShortDate(item.lastDate)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}`
          : `${formatShortDate(item.date)} • ${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}`,
      notes: (item) => item.notes,
      onEdit: editClassItem,
      onDelete: deleteClassItem,
    },
  });
}

function renderEventList() {
  const sorted = groupScheduleEntries("event");
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
    const first = sortedItems[0];
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

  if (!item.title || !item.date || !item.start || !item.end) {
    return;
  }

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
    color: normalizeColor(elements.homeworkColor.value, "#7eaed6"),
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
    color: normalizeColor(elements.examColor.value, "#7eaed6"),
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
  elements.homeworkForm.dataset.seriesId = item.seriesId || "";
  elements.homeworkId.value = item.id;
  elements.homeworkTitle.value = item.title;
  elements.homeworkClass.value = item.course;
  elements.homeworkDate.value = item.date;
  elements.homeworkTime.value = item.time || "";
  elements.homeworkStatus.value = item.status;
  elements.homeworkColor.value = normalizeColor(item.color, "#7eaed6");
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
  elements.examId.value = item.id;
  elements.examTitle.value = item.title;
  elements.examCourse.value = item.course;
  elements.examDate.value = item.date;
  elements.examTime.value = item.time || "";
  elements.examColor.value = normalizeColor(item.color, "#7eaed6");
  setMatchSelection("exam", item.matchSourceKey || "");
  elements.examNotes.value = item.notes || "";
}

function editClassItem(id) {
  const matches = state.data.schedule.filter(
    (entry) => entry.type === "class" && (entry.id === id || entry.seriesId === id),
  );
  if (!matches.length) {
    return;
  }

  const sortedMatches = [...matches].sort(compareByDateTime);
  const item = sortedMatches[0];

  setActiveTab("classes");
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
  elements.reminderForm.dataset.seriesId = item.seriesId || "";
  elements.reminderId.value = item.id;
  elements.reminderTitle.value = item.title;
  elements.reminderDate.value = item.date;
  elements.reminderTime.value = item.time || "";
  elements.reminderColor.value = normalizeColor(item.color, "#7eaed6");
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
  state.data.homework = state.data.homework.filter((item) => item.id !== id);
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
  const target = getCollectionDeleteTarget(state.data.reminders, id);
  state.data.reminders = state.data.reminders.filter((item) => item.id !== target);
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
  const target = getScheduleDeleteTarget(id, "class");
  state.data.schedule = state.data.schedule.filter((item) => item.id !== target);
  persistAndRender();
  resetClassForm();
}

function deleteEventItem(id) {
  const target = getScheduleDeleteTarget(id, "event");
  state.data.schedule = state.data.schedule.filter((item) => item.id !== target);
  persistAndRender();
  resetEventForm();
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
  const sources = getColorSourceItems();

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

function saveSettings() {
  const notificationPreference =
    elements.notificationPreference.find((input) => input.checked)?.value || "email";
  const notificationFrequency =
    elements.notificationFrequency.find((input) => input.checked)?.value || "daily";
  const currentSettings = getSettings();

  state.data.settings = {
    name: elements.settingsName.value.trim(),
    email: elements.settingsEmail.value.trim(),
    phone: elements.settingsPhone.value.trim(),
    notificationPreference,
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
    },
    school: currentSettings.school,
    canvasUrl: currentSettings.canvasUrl,
    schoolUsername: currentSettings.schoolUsername,
    connections: currentSettings.connections,
    schoolAccounts: currentSettings.schoolAccounts,
  };

  syncAuthProfileFromSettings();
  saveData();
  requestBrowserNotificationPermission();
  scheduleNotificationCheck();
  renderSettings("Settings saved.");
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

  elements.settingsSummaryTitle.textContent = settings.name || "No contact saved";
  elements.settingsSummary.innerHTML = "";

  [
    ["Storage", getStorageStatus()],
    ["Email", settings.email || "Not added"],
    ["Phone", settings.phone || "Not added"],
    ["Preference", formatNotificationPreference(settings.notificationPreference)],
    ["Notify", formatNotificationSchedule(settings.notificationSchedule)],
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
  const currentPassword = elements.settingsCurrentPassword.value;
  const nextPassword = elements.settingsNewPassword.value;

  if (!authState.profile) {
    renderSettings("Log in before changing your password.");
    return;
  }

  if (supabaseClient) {
    changeSupabasePassword(nextPassword);
    return;
  }

  if (currentPassword !== authState.profile.password) {
    elements.settingsStatus.textContent = "Original password does not match.";
    elements.settingsCurrentPassword.focus();
    return;
  }

  if (nextPassword.trim().length < 6) {
    elements.settingsStatus.textContent = "New password needs at least 6 characters.";
    elements.settingsNewPassword.focus();
    return;
  }

  authState.profile = {
    ...authState.profile,
    password: nextPassword,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(authState.profile));
  elements.settingsCurrentPassword.value = "";
  elements.settingsNewPassword.value = "";
  renderSettings("Login password changed.");
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

  if (supabaseClient) {
    const row = document.createElement("div");
    row.className = "settings-summary-row";
    row.innerHTML = "<span>Login password</span><strong>Managed by Supabase</strong>";
    elements.passwordSummary.appendChild(row);
    return;
  }

  [
    ["Login password", authState.profile?.password || "Not created"],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "settings-summary-row";
    row.innerHTML = `<span>${label}</span><strong>${escapeHtml(value)}</strong>`;
    elements.passwordSummary.appendChild(row);
  });
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
      <div class="settings-summary-row"><span>Username</span><strong>${escapeHtml(account.username || "Not added")}</strong></div>
      <div class="settings-summary-row"><span>School password</span><strong>${escapeHtml(account.password || "Not added")}</strong></div>
      <div class="settings-summary-row"><span>Canvas URL</span><strong>${escapeHtml(account.canvasUrl || "Not added")}</strong></div>
      <div class="settings-summary-row"><span>Canvas token</span><strong>${escapeHtml(account.canvasToken || "Not added")}</strong></div>
      <div class="settings-summary-row"><span>Classroom token</span><strong>${escapeHtml(account.classroomToken || "Not added")}</strong></div>
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

async function fetchSchoolItems() {
  saveSettings();
  elements.fetchSchoolItems.disabled = true;
  renderSchoolImportItems("Checking connected school accounts...");

  try {
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

    schoolImportItems = dedupeSchoolItems(items);

    if (schoolImportItems.length) {
      renderSchoolImportItems(
        `Found ${schoolImportItems.length} item${schoolImportItems.length === 1 ? "" : "s"} to review.`,
      );
      return;
    }

    renderSchoolImportItems(errors[0] || "No upcoming school items were found.");
  } finally {
    elements.fetchSchoolItems.disabled = false;
  }
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
  const dueAt = plannable.due_at || item.plannable_date || item.created_at;
  const dateParts = parseSchoolDateTime(dueAt);
  if (!dateParts) {
    return null;
  }

  return {
    id: `canvas:${item.plannable_type || "item"}:${item.plannable_id || plannable.id || dueAt}`,
    source: "Canvas",
    title: plannable.title || item.context_name || "Canvas item",
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

  return {
    id: `classroom:${course.id}:${item.id}`,
    source: "Google Classroom",
    title: item.title || "Classroom assignment",
    course: course.name || account.school || "Google Classroom",
    date: due.date,
    time: due.time,
    url: item.alternateLink || "",
    notes: `Imported from Google Classroom${account.school ? ` for ${account.school}` : ""}.`,
  };
}

function renderSchoolImportItems(statusMessage = elements.schoolImportStatus.textContent || "") {
  elements.schoolImportStatus.textContent = statusMessage;
  elements.schoolImportList.innerHTML = "";

  if (!schoolImportItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No school items ready to add yet.";
    elements.schoolImportList.appendChild(empty);
    return;
  }

  schoolImportItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "item-card school-import-card";
    card.innerHTML = `
      <div class="item-card-top">
        <div>
          <p class="item-category">${escapeHtml(item.source)}</p>
          <h4 class="item-title">${escapeHtml(item.title)}</h4>
        </div>
        <div class="item-actions">
          <button class="small-button add-school-homework" type="button">Add homework</button>
          <button class="small-button add-school-reminder" type="button">Add reminder</button>
        </div>
      </div>
      <p class="item-meta">${escapeHtml(item.course)} • ${formatShortDate(item.date)}${item.time ? ` at ${formatTime(item.time)}` : ""}</p>
      <p class="item-notes">${escapeHtml(item.url || item.notes)}</p>
    `;

    card.querySelector(".add-school-homework").addEventListener("click", () => {
      addSchoolItemAsHomework(item);
    });
    card.querySelector(".add-school-reminder").addEventListener("click", () => {
      addSchoolItemAsReminder(item);
    });
    elements.schoolImportList.appendChild(card);
  });
}

function addSchoolItemAsHomework(item) {
  state.data.homework.push({
    id: crypto.randomUUID(),
    title: item.title,
    course: item.course,
    date: item.date,
    time: item.time,
    status: "pending",
    color: "#7eaed6",
    notes: [item.notes, item.url].filter(Boolean).join(" "),
  });
  removeImportedSchoolItem(item.id, `${item.title} was added as homework.`);
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
  saveDataToSupabase();
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
    homework: Array.isArray(data?.homework) ? data.homework : [],
    exams: Array.isArray(data?.exams) ? data.exams : [],
    schedule: Array.isArray(data?.schedule) ? data.schedule : [],
    reminders: Array.isArray(data?.reminders) ? data.reminders : [],
    settings: normalizeSettings(data?.settings),
  };
}

function loadAuthProfile() {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored);
    if (
      typeof parsed?.email !== "string" ||
      typeof parsed?.password !== "string" ||
      !isValidEmail(parsed.email)
    ) {
      return null;
    }

    return {
      email: parsed.email.trim().toLowerCase(),
      password: parsed.password,
      name: typeof parsed.name === "string" ? parsed.name : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
    };
  } catch (error) {
    console.error("Failed to load login profile", error);
    return null;
  }
}

function seedData() {
  const today = todayString();
  const tomorrow = offsetDate(today, 1);
  const nextDay = offsetDate(today, 2);

  return {
    homework: [
      {
        id: crypto.randomUUID(),
        title: "Calculus problem set",
        course: "Math 150",
        date: today,
        time: "23:00",
        status: "pending",
        color: "#7eaed6",
        notes: "Finish questions 1 through 12.",
      },
      {
        id: crypto.randomUUID(),
        title: "Physics lab write-up",
        course: "Physics 202",
        date: tomorrow,
        time: "17:00",
        status: "pending",
        color: "#5c8fd8",
        notes: "Upload the final PDF before class.",
      },
    ],
    exams: [
      {
        id: crypto.randomUUID(),
        title: "Physics midterm",
        course: "Physics 202",
        date: nextDay,
        time: "13:00",
        color: "#6d9fd0",
        status: "pending",
        notes: "Bring calculator and formula sheet.",
      },
    ],
    schedule: [
      {
        id: crypto.randomUUID(),
        title: "Physics lecture",
        date: today,
        type: "class",
        start: "09:30",
        end: "10:45",
        location: "Room 204",
        color: "#3f76c5",
        status: "pending",
        notes: "Bring lab notebook.",
      },
      {
        id: crypto.randomUUID(),
        title: "Group project meeting",
        date: today,
        type: "event",
        start: "14:00",
        end: "15:00",
        location: "Library",
        color: "#8eb4de",
        status: "pending",
        notes: "Discuss slides and final edits.",
      },
    ],
    reminders: [
      {
        id: crypto.randomUUID(),
        title: "Call advisor",
        date: nextDay,
        time: "11:30",
        color: "#9abbd6",
        notes: "Ask about next semester registration.",
      },
    ],
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
    notificationPreference,
    notificationSchedule: normalizeNotificationSchedule(settings.notificationSchedule),
    school: typeof settings.school === "string" ? settings.school : defaults.school,
    canvasUrl:
      typeof settings.canvasUrl === "string" ? normalizeUrl(settings.canvasUrl) : defaults.canvasUrl,
    schoolUsername:
      typeof settings.schoolUsername === "string"
        ? settings.schoolUsername
        : defaults.schoolUsername,
    connections: normalizeConnections(settings.connections),
    schoolAccounts: normalizeSchoolAccounts(settings),
  };
}

function getDefaultSettings() {
  return {
    name: "",
    email: "",
    phone: "",
    notificationPreference: "email",
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
    },
    school: "",
    canvasUrl: "",
    schoolUsername: "",
    connections: {
      canvas: false,
      googleClassroom: false,
    },
    schoolAccounts: [],
  };
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
  };
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
    ...state.data.reminders.map((item) => `${item.title}|${item.date}`),
  ]);
  const seen = new Set();

  return items.filter((item) => {
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
      sortKey: item.time || "23:57",
    }));

  const schedule = state.data.schedule
    .filter((item) => item.date === date)
    .map((item) => ({
      sourceId: item.id,
      sourceType: item.type,
      kind: "class",
      label: item.type === "class" ? "Class" : "Scheduled event",
      title: item.title,
      meta: `${formatTime(item.start)} - ${formatTime(item.end)}${item.location ? ` • ${item.location}` : ""}${item.type === "event" && item.status === "done" ? " • Done" : ""}`,
      notes: item.notes,
      color: getStoredItemColor("schedule", item),
      status: item.type === "event" ? item.status || "pending" : "pending",
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
  return repeatDates.map((date) => ({
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
  colorInput.disabled = enabled;
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
