// Client-side push subscription helper

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export type PushResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function subscribeToPush(carerId: string, babyId: string): Promise<PushResult> {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "Service workers are not supported in this browser." };
  }
  if (!("PushManager" in window)) {
    return { ok: false, reason: "Push notifications are not supported in this browser.\n\niPhone users: open the app in Safari and install it to the Home Screen first." };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, reason: "Configuration error: VAPID key missing. Please contact support." };
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return { ok: false, reason: "Could not request notification permission. Try again from your browser settings." };
  }

  if (permission === "denied") {
    return { ok: false, reason: "Notifications are blocked. Go to your browser/phone settings and allow notifications for this site." };
  }
  if (permission !== "granted") {
    return { ok: false, reason: "Notification permission was not granted. Please tap Allow when prompted." };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carerId, babyId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, reason: `Server error saving subscription: ${err}` };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Subscription failed: ${msg}` };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "PushManager" in window && "serviceWorker" in navigator;
}
