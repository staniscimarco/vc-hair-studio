"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellRing, CalendarClock, Check, Megaphone, Send, ShieldCheck, Smartphone, Trash2, Users } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";
import { openInstallHint } from "@/components/pwa/install-hint";
import { enablePush } from "@/lib/push-client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notifyLive, useLive } from "@/lib/live";

type Device = { id: string; user_agent: string | null; created_at: string; disabled_at: string | null };
type Notice = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };
type Broadcast = { id: string; kind: string; title: string; body: string; recipients: number; sent: number; created_at: string };

const kindLabel: Record<string, string> = { manuale: "Messaggio", disponibilita: "Posti liberi", promozione: "Promozione" };

const ideas = [
  { titolo: "Si è liberato un posto 💜", messaggio: "Oggi pomeriggio c'è ancora spazio per te: prenota in un minuto!" },
  { titolo: "Nuovo look per l'estate ☀️", messaggio: "Colore e piega luminosi per la bella stagione. Prenota il tuo momento!" },
  { titolo: "Ti aspettiamo ✨", messaggio: "È da un po' che non ci vediamo: concediti una piega, te la meriti." },
];

export default function NotificationsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<Notice[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [subscribers, setSubscribers] = useState(0);
  const [daily, setDaily] = useState({ attivo: false, ora: 9 });
  const [approval, setApproval] = useState(true);
  const [ready, setReady] = useState(true);
  const [message, setMessage] = useState({ titolo: "", messaggio: "", url: "/prenota" });
  const [preview, setPreview] = useState<{ title: string; body: string } | null | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [ask, setAsk] = useState<null | { kind: "tutte" | "posti"; preview: { title: string; body: string } }>(null);

  async function load() {
    const response = await fetch("/api/admin/notifiche");
    const body = await response.json();
    if (!response.ok) {
      // Stesso id: l'aggiornamento automatico non ripete il messaggio.
      toast.error(body.errore, { id: "notifiche-caricamento" });
      return;
    }
    setDevices(body.dispositivi ?? []);
    setHistory(body.storico ?? []);
    setBroadcasts(body.invii ?? []);
    setSubscribers(body.clientiIscritte ?? 0);
    setDaily(body.giornaliero ?? { attivo: false, ora: 9 });
    setApproval(body.approvazione !== false);
    setReady(Boolean(body.vapidConfigurato));
  }
  useEffect(() => {
    void load().then(async () => {
      // Aprendo questa pagina le notifiche delle prenotazioni risultano lette.
      await fetch("/api/notifiche/centro", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => undefined);
      notifyLive();
    });
  }, []);
  useLive(() => void load());

  async function post(payload: object) {
    const response = await fetch("/api/admin/notifiche", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    return { ok: response.ok, body: await response.json() };
  }

  async function savePrefs(next: { attivo: boolean; ora: number; approvazione: boolean }) {
    setDaily({ attivo: next.attivo, ora: next.ora });
    setApproval(next.approvazione);
    const { ok, body } = await post({ azione: "preferenze", ...next });
    if (!ok) toast.error(body.errore);
    else toast.success("Preferenze salvate.");
  }

  async function sendToAll() {
    setSending(true);
    const { ok, body } = await post({ azione: "invia-clienti", ...message });
    setSending(false);
    if (!ok) return toast.error(body.errore);
    if (body.inviata) {
      toast.success(`Notifica ricevuta da ${body.ricevute} ${body.ricevute === 1 ? "dispositivo" : "dispositivi"}.`);
      setMessage({ titolo: "", messaggio: "", url: "/prenota" });
    } else toast.message(body.motivo ?? "Nessun invio.");
    await load();
  }

  const unread = history.filter((item) => !item.read_at).length;

  return (
    <section>
      <TitleHero title="Notifiche" back="/admin" subtitle="Tu ricevi solo le nuove prenotazioni. Alle clienti mandi posti liberi e offerte." />

      {!ready ? (
        <div className="warning-box mt-5">Le chiavi delle notifiche (VAPID) non sono configurate sul server: finché mancano, nessuna notifica può partire.</div>
      ) : null}

      {/* Questo dispositivo */}
      <div className="offer-stack mt-6">
        <article className="offer-card">
          <div className="offer-body" style={{ maxWidth: "72%" }}>
            <span className="offer-tag">Il tuo telefono <BellRing size={12} color="#5826b2" /></span>
            <h2>Ricevi ogni nuova prenotazione</h2>
            <p className="offer-line">Su iPhone funzionano dall&apos;app installata nella schermata Home (iOS 16.4 o successivo).</p>
            <div className="offer-actions flex-wrap">
              <button className="btn btn-accent btn-sm" type="button" onClick={async () => {
                const result = await enablePush("admin");
                if (result.ok) {
                  toast.success("Notifiche attive su questo dispositivo.");
                  await load();
                } else toast.error(result.motivo ?? "Notifiche non attivate.");
              }}>Attiva qui</button>
              <button className="btn btn-white btn-sm" type="button" onClick={async () => {
                const { body } = await post({ azione: "prova" });
                if (body.inviata) toast.success("Notifica di prova inviata.");
                else toast.error(body.motivo || "Nessun dispositivo ha ricevuto la prova.");
              }}><Send size={14} /> Prova</button>
              <button className="btn btn-white btn-sm" type="button" onClick={openInstallHint}><Smartphone size={14} /> Installa l&apos;app</button>
            </div>
          </div>
          <span className="offer-badge">{unread}<br />nuove</span>
        </article>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* Invio a tutte le clienti */}
        <div className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon is-accent"><Megaphone size={20} /></span>
            <div>
              <h2>Scrivi a tutte le clienti</h2>
              <p className="note m-0"><Users size={12} className="inline" /> {subscribers} {subscribers === 1 ? "cliente ha" : "clienti hanno"} attivato le notifiche</p>
            </div>
          </div>
          <div className="chips">
            {ideas.map((idea) => (
              <button key={idea.titolo} type="button" className="chip" onClick={() => setMessage({ ...message, ...idea })}>{idea.titolo}</button>
            ))}
          </div>
          <label className="field">Titolo<input maxLength={60} value={message.titolo} placeholder="Es. Si è liberato un posto 💜" onChange={(event) => setMessage({ ...message, titolo: event.target.value })} /></label>
          <label className="field">Messaggio<textarea maxLength={180} value={message.messaggio} placeholder="Es. Oggi alle 16:00 c'è spazio per una piega. Prenota ora!" onChange={(event) => setMessage({ ...message, messaggio: event.target.value })} /></label>
          <label className="field">Tocco sulla notifica apre
            <select value={message.url} onChange={(event) => setMessage({ ...message, url: event.target.value })}>
              <option value="/prenota">La prenotazione</option>
              <option value="/">La home dell&apos;app</option>
              <option value="/i-miei-appuntamenti">I suoi appuntamenti</option>
            </select>
          </label>
          <button className="btn btn-primary btn-block" type="button" disabled={sending || !message.titolo || !message.messaggio} onClick={() => setAsk({ kind: "tutte", preview: { title: message.titolo, body: message.messaggio } })}>
            <Send size={17} /> {sending ? "Invio in corso…" : "Invia a tutte"}
          </button>
        </div>

        <div className="grid gap-5">
          {/* Invio automatico */}
          <div className="card grid gap-3">
            <div className="card-title">
              <span className="tile-icon"><CalendarClock size={20} /></span>
              <div>
                <h2>Posti liberi, ogni giorno</h2>
                <p className="note m-0">Una volta al giorno avvisiamo le clienti degli orari ancora liberi di oggi e domani.</p>
              </div>
            </div>
            <label className="toggle">Invio automatico giornaliero
              <input type="checkbox" checked={daily.attivo} onChange={(event) => void savePrefs({ attivo: event.target.checked, ora: daily.ora, approvazione: approval })} />
            </label>
            <label className="field">Orario di invio
              <select value={daily.ora} onChange={(event) => void savePrefs({ attivo: daily.attivo, ora: Number(event.target.value), approvazione: approval })}>
                {Array.from({ length: 16 }, (_, index) => index + 6).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
              </select>
            </label>
            {preview ? (
              <div className="card-soft text-sm"><strong>{preview.title}</strong><br />{preview.body}</div>
            ) : preview === null ? (
              <div className="card-soft text-sm">Oggi e domani non ci sono posti liberi: in questo caso non inviamo nulla.</div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-soft btn-sm" type="button" onClick={async () => {
                const { body } = await post({ azione: "anteprima-disponibilita" });
                setPreview(body.messaggio ?? null);
              }}>Anteprima</button>
              <button className="btn btn-outline btn-sm" type="button" onClick={async () => {
                const { body } = await post({ azione: "anteprima-disponibilita" });
                if (!body.messaggio) {
                  setPreview(null);
                  toast.message("Oggi e domani non ci sono posti liberi da segnalare.");
                  return;
                }
                setAsk({ kind: "posti", preview: body.messaggio });
              }}>Invia adesso</button>
            </div>
          </div>

          {/* Approvazione */}
          <div className="card grid gap-3">
            <div className="card-title">
              <span className="tile-icon"><ShieldCheck size={20} /></span>
              <div>
                <h2>Conferma manuale</h2>
                <p className="note m-0">Le prenotazioni online restano in attesa finché non le accetti. L&apos;orario resta bloccato nel frattempo.</p>
              </div>
            </div>
            <label className="toggle">Accetto io ogni prenotazione
              <input type="checkbox" checked={approval} onChange={(event) => void savePrefs({ attivo: daily.attivo, ora: daily.ora, approvazione: event.target.checked })} />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionHead title="Inviate alle clienti" subtitle="Ultimi messaggi" />
          {broadcasts.length === 0 ? <div className="empty-state"><span className="tile-icon"><Megaphone size={20} /></span>Ancora nessun messaggio inviato.</div> : null}
          <div className="grid gap-3">
            {broadcasts.map((item) => (
              <article key={item.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
                <span className="tile-icon is-accent"><Megaphone size={18} /></span>
                <div className="pick-main">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="status-pill">{kindLabel[item.kind] ?? item.kind}</span>
                    <span className="status-pill is-completed">{item.sent}/{item.recipients} ricevute</span>
                    <span className="status-pill">{new Date(item.created_at).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div>
          <SectionHead title="Le tue notifiche" subtitle={unread ? `${unread} da leggere` : "Tutto letto"} />
          {history.length === 0 ? <div className="empty-state"><span className="tile-icon"><Bell size={20} /></span>Ancora nessuna prenotazione notificata.</div> : null}
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
                    await post({ azione: "letta", id: item.id });
                    await load();
                  }}><Check size={16} /></button>
                ) : null}
              </article>
            ))}
          </div>
          <SectionHead title="Dispositivi del salone" subtitle={`${devices.length} collegati`} />
          {devices.length === 0 ? <div className="empty-state"><span className="tile-icon"><Smartphone size={20} /></span>Nessun dispositivo collegato: tocca «Attiva qui».</div> : null}
          <div className="grid gap-3">
            {devices.map((device) => (
              <article key={device.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
                <span className="tile-icon is-accent"><Smartphone size={18} /></span>
                <div className="pick-main">
                  <h3 className="truncate">{device.user_agent || "Dispositivo"}</h3>
                  <p>{device.disabled_at ? "Disattivato" : "Attivo"}</p>
                </div>
                <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Rimuovi dispositivo" onClick={async () => {
                  await post({ azione: "rimuovi", id: device.id });
                  await load();
                }}><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(ask)}
        icon={<Send size={30} />}
        title={ask?.kind === "posti" ? "Inviare i posti liberi?" : "Inviare a tutte le clienti?"}
        message={<>La notifica arriverà a <strong>{subscribers}</strong> {subscribers === 1 ? "cliente iscritta" : "clienti iscritte"}. Ecco come la vedranno:</>}
        preview={ask?.preview ?? null}
        confirmLabel="Sì, invia ora"
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          if (ask?.kind === "posti") {
            const { body } = await post({ azione: "invia-disponibilita" });
            if (body.inviata) toast.success(`Inviata: ricevuta da ${body.ricevute} ${body.ricevute === 1 ? "dispositivo" : "dispositivi"}.`);
            else toast.message(body.motivo ?? "Nessun invio.");
            await load();
          } else await sendToAll();
          setAsk(null);
        }}
      />
    </section>
  );
}
