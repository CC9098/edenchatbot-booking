self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(
    event.notification.data?.url || "/conversations",
    self.location.origin,
  );
  if (
    destination.origin !== self.location.origin ||
    destination.pathname !== "/conversations"
  )
    return;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows.find(
          (client) => new URL(client.url).pathname === "/conversations",
        );
        if (existing) {
          await existing.navigate(destination.href);
          return existing.focus();
        }
        return clients.openWindow(destination.href);
      }),
  );
});
// Patient conversations are never cached by this service worker.
