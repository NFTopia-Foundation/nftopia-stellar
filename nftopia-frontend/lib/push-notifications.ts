import { fetchWithAuth } from "@/lib/api/fetchWithAuth";
import { API_CONFIG } from "@/lib/config";

/**
 * Web push opt-in flow (#661): requests notification permission, subscribes
 * to the browser's Push API using the service worker already registered by
 * next-pwa (see worker/index.js for the push/notificationclick handlers),
 * and registers that subscription with the backend so it can actually
 * deliver a push for a qualifying event (new bid, sale, follow) while the
 * tab is closed or backgrounded.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermission(): NotificationPermission | null {
  if (typeof window === "undefined" || !("Notification" in window)) return null;
  return Notification.permission;
}

/** Converts the VAPID public key (base64url) into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Requests notification permission (if not already granted/denied) and
 * creates a push subscription, registering it with the backend.
 * Returns null if the user declines permission or push isn't supported.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured (missing VAPID public key).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  await fetchWithAuth(`${API_CONFIG.baseUrl}/api/v1/notifications/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}

/** Unsubscribes from push both in the browser and on the backend. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetchWithAuth(`${API_CONFIG.baseUrl}/api/v1/notifications/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
}
