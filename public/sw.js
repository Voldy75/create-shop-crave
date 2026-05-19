/* Service worker for Crave & Create web push notifications.
 *
 * Scope: site root (/). Registered from app/layout.tsx via navigator.serviceWorker.register('/sw.js').
 *
 * Handles two events:
 *  - 'push': renders an OS-level notification from the JSON payload our server sends
 *  - 'notificationclick': focuses an existing tab (or opens a new one) at the target URL
 *
 * We deliberately keep this minimal — no caching, no offline behaviour — to avoid
 * subtle bugs with stale Next.js assets.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Crave & Create", body: event.data.text() };
  }
  const {
    title = "Crave & Create",
    body = "",
    url = "/planner?tab=tracker",
    tag = "daily-nudge",
  } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
      // requireInteraction stays off so the notification auto-dismisses if ignored.
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/planner?tab=tracker";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // If an existing tab is already on our origin, focus it and navigate.
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // Cross-origin navigate can fail; fall through to openWindow.
            }
          }
          return;
        }
      }
      // No tab open — open a new one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

// Bumping this string forces an SW update when we change the file.
self.__BUILD = "2026-05-19-1";
