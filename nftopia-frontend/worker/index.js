/* eslint-disable no-restricted-globals */
/**
 * Custom additions to the next-pwa-generated service worker (#661).
 * next-pwa's `customWorkerDir` ("worker") webpacks this file and
 * `importScripts`s it into the generated sw.js, alongside the Workbox
 * caching logic already configured in next.config.js.
 *
 * This file only adds Web Push support: showing a notification when the
 * browser delivers a push message (even while the tab is closed/
 * backgrounded — the actual point of #661), and focusing/opening the
 * relevant tab when the user clicks it.
 */

const DEFAULT_ICON = "/nftopia-03.png";

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "NFTopia";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_ICON,
    tag: payload.tag,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsList) => {
        const existing = clientsList.find((client) => client.url.includes(targetUrl));
        if (existing) {
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// If the browser invalidates the subscription (e.g. it expired), there's
// nothing meaningful this worker alone can do — the next time the app is
// opened, lib/push-notifications.ts re-checks the subscription state and
// re-subscribes if the user had previously opted in.
self.addEventListener("pushsubscriptionchange", () => {});
