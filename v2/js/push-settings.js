(() => {
  const button = document.querySelector("#planner-push-toggle");
  const status = document.querySelector("#planner-push-status");
  if (!button || !status) return;
  if (!window.isSecureContext || !("serviceWorker" in navigator) ||
      !("PushManager" in window) || !("Notification" in window)) {
    button.disabled = true;
    status.textContent = "Push is unavailable here. On iPhone or iPad, open UniPlan from your Home Screen.";
    return;
  }

  const endpoint = "/.netlify/functions/push-registration";
  const ownerKey = "uniplan-push-owner";
  const worker = new URL("../push-worker.js", document.currentScript.src);
  const registration = navigator.serviceWorker.register(worker).then(async (result) => {
    if (result.active) return result;
    // The root planner page may be outside the worker scope, so use its install state.
    const installing = result.installing || result.waiting;
    if (!installing) throw new Error("UniPlan could not start its notification worker.");
    await new Promise((resolve, reject) => {
      function update() {
        if (installing.state === "activated") resolve();
        if (installing.state === "redundant") reject(new Error("UniPlan could not start its notification worker."));
      }
      installing.addEventListener("statechange", update);
      update();
    });
    return result;
  });
  let subscription;
  let pushManager;
  let applicationServerKey;
  let busy = false;

  function activeForCurrentUser() {
    return subscription && localStorage.getItem(ownerKey) === authState.userId;
  }

  function render() {
    button.textContent = activeForCurrentUser() ? "Disable push on this device" : "Enable push on this device";
    button.disabled = busy || !pushManager || (!activeForCurrentUser() && !applicationServerKey);
  }

  async function request(method, payload) {
    const token = method === "GET" ? "" : await getValidAccessToken();
    if (method !== "GET" && !token) throw new Error("Sign in to manage push notifications.");
    const response = await fetch(endpoint, {
      method,
      headers: token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {},
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Push notifications are unavailable on this deployment.");
    return result;
  }

  render();
  registration.then(async (result) => {
    subscription = await result.pushManager.getSubscription();
    pushManager = result.pushManager;
    render();
  }).catch((error) => { status.textContent = error.message; });

  request("GET").then(({ publicKey }) => {
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
    if (key.length !== 65 || key[0] !== 4) throw new Error("Push notifications are unavailable on this deployment.");
    applicationServerKey = key;
    render();
  }).catch((error) => { status.textContent = error.message; });

  async function disable() {
    if (!subscription) return;
    await subscription.unsubscribe();
    const savedEndpoint = subscription.endpoint;
    subscription = null;
    localStorage.removeItem(ownerKey);
    await request("DELETE", { endpoint: savedEndpoint });
  }

  button.addEventListener("click", async () => {
    if (busy) return;
    if (!authState.isAuthenticated) {
      status.textContent = "Sign in to enable push notifications.";
      return;
    }

    busy = true;
    render();
    try {
      if (activeForCurrentUser()) {
        await disable();
        status.textContent = "Push notifications are off on this device.";
      } else {
        if (Notification.permission === "denied") throw new Error("Allow notifications in your browser settings to enable push.");
        const owner = authState.userId;
        const existing = subscription;
        const existingKey = new Uint8Array(existing?.options.applicationServerKey || []);
        const matchesKey = applicationServerKey.length === existingKey.length &&
          applicationServerKey.every((byte, index) => byte === existingKey[index]);
        if (existing && (!matchesKey || localStorage.getItem(ownerKey) !== owner)) {
          await existing.unsubscribe();
          subscription = null;
          localStorage.removeItem(ownerKey);
          status.textContent = "Tap Enable push again to finish updating this device.";
          return;
        }
        const candidate = await pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey,
        });
        try {
          await request("POST", {
            subscription: candidate.toJSON(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        } catch (error) {
          await candidate.unsubscribe();
          throw error;
        }
        if (authState.userId !== owner) {
          await candidate.unsubscribe();
          return;
        }
        subscription = candidate;
        localStorage.setItem(ownerKey, owner);
        status.textContent = "Push notifications are on for this device.";
      }
    } catch (error) {
      status.textContent = error.name === "NotAllowedError" ? "Allow notifications in your browser settings to enable push." : error.message;
    } finally {
      busy = false;
      render();
    }
  });

  window.UniPlanPush = {
    render,
    async disableOnLogout() {
      try {
        if (activeForCurrentUser()) await disable();
      } catch {
        // Signing out must remain available when the push service is offline.
      }
      status.textContent = "";
      render();
    },
  };
})();
