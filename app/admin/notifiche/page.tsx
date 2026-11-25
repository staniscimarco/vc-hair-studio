"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, Check, Send, Smartphone, Trash2 } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";

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

  async function test() {
    const response = await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "prova" }) });
    const body = await response.json();
    if (body.inviata) toast.success("Notifica di prova inviata.");
    else toast.error(body.motivo || body.errore || "Nessun dispositivo ha ricevuto la prova.");
  }

  const unread = history.filter((item) => !item.read_at).length;

  return (
    <section>
      <TitleHero title="Notifiche" back="/admin" subtitle="Ricevi un avviso a ogni nuova prenotazione o annullamento." />

      <div className="offer-stack mt-6">
        <article className="offer-card">
          <div className="offer-body" style={{ maxWidth: "70%" }}>
            <span className="offer-tag">Questo dispositivo <BellRing size={12} color="#5826b2" /></span>
            <h2>Attiva le notifiche push</h2>
            <p className="offer-line">Su iPhone funzionano dall&apos;app installata nella schermata Home (iOS 16.4 o successivo).</p>
            <div className="offer-actions flex-wrap">
              <button className="btn btn-accent btn-sm" type="button" onClick={() => void enable()}>Attiva notifiche</button>
              <button className="btn btn-white btn-sm" type="button" onClick={() => void test()}><Send size={14} /> Prova</button>
            </div>
          </div>
          <span className="offer-badge">{unread}<br />nuove</span>
        </article>
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionHead title="Dispositivi" subtitle={`${devices.length} collegati`} />
          {devices.length === 0 ? <div className="empty-state"><span className="tile-icon"><Smartphone size={20} /></span>Nessun dispositivo collegato.</div> : null}
          <div className="grid gap-3">
            {devices.map((device) => (
              <article key={device.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
                <span className="tile-icon is-accent"><Smartphone size={18} /></span>
                <div className="pick-main">
                  <h3 className="truncate">{device.user_agent || "Dispositivo"}</h3>
                  <p>{device.disabled_at ? "Disattivato" : "Attivo"}</p>
                </div>
                <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Rimuovi dispositivo" onClick={async () => {
                  await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "rimuovi", id: device.id }) });
                  await load();
                }}><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        </div>
        <div>
          <SectionHead title="Storico" subtitle={unread ? `${unread} da leggere` : "Tutto letto"} />
          {history.length === 0 ? <div className="empty-state"><span className="tile-icon"><Bell size={20} /></span>Ancora nessuna notifica.</div> : null}
          <div className="grid gap-3">
            {history.map((item) => (
              <article key={item.id} className="pick-card" style={{ cursor: "default", padding: 12, background: item.read_at ? "var(--lavender-soft)" : undefined }}>
                <span className={`tile-icon ${item.read_at ? "" : "is-primary"}`}><Bell size={18} /></span>
                <a className="pick-main no-underline" href={item.url}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </a>
                {!item.read_at ? (
                  <button className="icon-btn is-white" style={{ width: 38, height: 38 }} type="button" aria-label="Segna come letta" title="Segna come letta" onClick={async () => {
                    await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ azione: "letta", id: item.id }) });
                    await load();
                  }}><Check size={16} /></button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}
