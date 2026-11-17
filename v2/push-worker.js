self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));

self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data?.json();
  } catch {
    return;
  }
  if (!message?.title || !message.key) return;
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    tag: message.key,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const planner = new URL(self.registration.scope);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const openPlanner = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === planner.origin &&
        ["/", "/mobile.html", planner.pathname, planner.pathname + "index.html"].includes(url.pathname);
    });
    return openPlanner ? openPlanner.focus() : self.clients.openWindow(planner.href);
  })());
});
