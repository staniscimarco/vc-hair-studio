/** Funzioni lato browser per le notifiche push (clienti e amministratrice). */

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Chiede il permesso (deve partire da un tocco dell'utente su iPhone), crea l'iscrizione
 * e la salva: per l'admin sui dispositivi del salone, per le clienti tra le iscritte.
 */
export async function enablePush(role: "admin" | "customer"): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSupported()) {
    return { ok: false, motivo: "Su iPhone le notifiche funzionano dopo aver installato l'app nella schermata Home." };
  }
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, motivo: "Notifiche non consentite. Puoi attivarle dalle impostazioni del telefono." };
  return saveSubscription(role);
}

/** Registra di nuovo il dispositivo se il permesso è già concesso (nessun popup). */
export async function saveSubscription(role: "admin" | "customer"): Promise<{ ok: boolean; motivo?: string }> {
  if (!pushSupported() || Notification.permission !== "granted") return { ok: false };
  const { chiavePubblica } = await fetch("/api/notifiche").then((response) => response.json()).catch(() => ({ chiavePubblica: "" }));
  if (!chiavePubblica) return { ok: false, motivo: "Le notifiche non sono ancora configurate dal salone." };
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(chiavePubblica) }));
  const json = subscription.toJSON();
  const response = await fetch(role === "admin" ? "/api/admin/notifiche" : "/api/notifiche", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return { ok: false, motivo: body.errore ?? "Non è stato possibile attivare le notifiche." };
  }
  return { ok: true };
}

export async function hasSubscription() {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(await registration?.pushManager.getSubscription());
}
