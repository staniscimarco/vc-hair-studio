"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Device = { id: string; user_agent: string | null; created_at: string; disabled_at: string | null };
type Notice = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };

export default function NotificationsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<Notice[]>([]);
  const [key, setKey] = useState("");

  async function load() {
    const response = await fetch("/api/admin/notifiche");
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.errore);
      return;
    }
    setDevices(body.dispositivi ?? []);
    setHistory(body.storico ?? []);
    setKey(body.chiavePubblica ?? "");
  }
  useEffect(() => { void load(); }, []);

  async function enable() {
    if (!key) {
      toast.error("Le chiavi di notifica non sono ancora configurate.");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    const json = subscription.toJSON();
    const response = await fetch("/api/admin/notifiche", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else {
      toast.success("Notifiche attivate su questo dispositivo.");
      await load();
    }
  }

  return (
    <section className="grid gap-4">
      <h1 className="font-display text-5xl text-cocoa">Notifiche</h1>
      <p className="text-sm">Su iPhone le notifiche funzionano dall&apos;app installata nella schermata Home, con iOS 16.4 o successivo. Su Android puoi attivarle anche dal browser.</p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-full bg-cocoa px-4 py-2 text-cream" type="button" onClick={() => void enable()}>Attiva notifiche</button>
        <button className="rounded-full border border-cocoa px-4 py-2" type="button" onClick={async () => {
          const response = await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "prova" }) });
          const body = await response.json();
          if (body.inviata) toast.success("Notifica di prova inviata.");
          else toast.error(body.motivo || body.errore || "Nessun dispositivo ha ricevuto la prova.");
        }}>Notifica di prova</button>
      </div>
      <h2 className="font-display text-3xl">Dispositivi</h2>
      {devices.map((device) => (
        <article key={device.id} className="flex items-center justify-between rounded-2xl bg-white p-3 text-sm">
          <span>{device.user_agent || "Dispositivo"} {device.disabled_at ? "· disattivato" : ""}</span>
          <button type="button" onClick={async () => {
            await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "rimuovi", id: device.id }) });
            await load();
          }}>Rimuovi</button>
        </article>
      ))}
      <h2 className="font-display text-3xl">Storico</h2>
      {history.map((item) => (
        <article key={item.id} className="rounded-2xl bg-white p-3">
          <a href={item.url}><strong>{item.title}</strong><br />{item.body}</a>
          {!item.read_at ? <button className="mt-2 text-sm underline" type="button" onClick={async () => {
            await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "letta", id: item.id }) });
            await load();
          }}>Segna come letta</button> : null}
        </article>
      ))}
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
