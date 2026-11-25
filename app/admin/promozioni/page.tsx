"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Megaphone, Pencil, Sparkles, Tag, Trash2 } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";
import { ServiceIcon } from "@/components/ui/service-icon";

type Promotion = {
  id: string;
  titolo: string;
  sottotitolo: string;
  badge: string;
  sconto: number;
  servizi: string[];
  dal: string;
  al: string;
  attiva: boolean;
};

type Service = { id: string; name: string };

type Draft = Omit<Promotion, "id"> & { id?: string; notifica: boolean };

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Venerdì dopo il quarto giovedì di novembre (dell'anno in corso, o del prossimo se è già passato). */
function blackFriday() {
  const now = new Date();
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    const first = new Date(year, 10, 1, 12);
    const thursday = 1 + ((4 - first.getDay() + 7) % 7) + 21;
    const friday = new Date(year, 10, thursday + 1, 12);
    const cyberMonday = new Date(year, 10, thursday + 4, 12);
    if (cyberMonday >= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)) {
      const start = friday < now ? now : friday;
      return { dal: iso(start), al: iso(cyberMonday) };
    }
  }
  return { dal: iso(now), al: iso(now) };
}

const presets: { label: string; build: () => Partial<Draft> }[] = [
  {
    label: "Black Friday",
    build: () => ({ titolo: "Black Friday", sottotitolo: "Solo per pochi giorni: sconto su tutti i trattamenti. Prenota ora!", sconto: 20, badge: "-20%", ...blackFriday() }),
  },
  {
    label: "Natale",
    build: () => {
      const year = new Date().getFullYear();
      return { titolo: "Speciale Natale", sottotitolo: "Arriva alle feste con i capelli più belli di sempre ✨", sconto: 15, badge: "-15%", dal: iso(new Date()), al: `${year}-12-24` };
    },
  },
  {
    label: "Benvenuta",
    build: () => ({ titolo: "Prima visita", sottotitolo: "Sconto di benvenuto sulla tua prima piega", sconto: 10, badge: "-10%", dal: iso(new Date()), al: iso(new Date(Date.now() + 30 * 86_400_000)) }),
  },
];

const empty = (): Draft => ({ titolo: "", sottotitolo: "", badge: "", sconto: 20, servizi: [], dal: iso(new Date()), al: iso(new Date(Date.now() + 7 * 86_400_000)), attiva: true, notifica: true });

export default function PromotionsPage() {
  const [rows, setRows] = useState<Promotion[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = iso(new Date());

  async function load() {
    const response = await fetch("/api/admin/promozioni");
    const body = await response.json();
    if (!response.ok) {
      setError(body.errore ?? "Promozioni non disponibili.");
      setRows([]);
      return;
    }
    setRows(body.promozioni ?? []);
  }

  useEffect(() => {
    void load();
    void fetch("/api/admin/servizi").then((response) => response.json()).then((body) => setServices(body.servizi ?? []));
  }, []);

  async function save() {
    setBusy(true);
    const response = await fetch("/api/admin/promozioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(body.errore);
      return;
    }
    toast.success(draft.id ? "Promozione aggiornata." : "Promozione pubblicata!");
    if (body.notifica) {
      if (body.notifica.inviata) toast.success(`Notifica inviata a ${body.notifica.ricevute} ${body.notifica.ricevute === 1 ? "cliente" : "clienti"}.`);
      else toast.message(body.notifica.motivo ?? "Notifica non inviata.");
    }
    setDraft(empty());
    await load();
  }

  const live = (row: Promotion) => row.attiva && row.dal <= today && row.al >= today;

  return (
    <section>
      <TitleHero title="Promozioni" back="/admin" subtitle="Crea offerte come il Black Friday: le clienti le vedono in app e possono ricevere una notifica." />

      <SectionHead title="Parti da un modello" subtitle="Un tocco e la promozione è già compilata" />
      <div className="chips">
        {presets.map((preset) => (
          <button key={preset.label} type="button" className="chip" onClick={() => setDraft({ ...empty(), ...preset.build() })}>
            <Sparkles size={14} /> {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon is-accent"><Tag size={20} /></span>
            <h2>{draft.id ? "Modifica promozione" : "Nuova promozione"}</h2>
          </div>
          <label className="field">Titolo<input value={draft.titolo} placeholder="Es. Black Friday" onChange={(event) => setDraft({ ...draft, titolo: event.target.value })} /></label>
          <label className="field">Messaggio per le clienti<input value={draft.sottotitolo} placeholder="Es. Sconto su tutti i trattamenti, solo per pochi giorni" onChange={(event) => setDraft({ ...draft, sottotitolo: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">Sconto %<input type="number" min={0} max={90} value={draft.sconto} onChange={(event) => setDraft({ ...draft, sconto: Number(event.target.value), badge: `-${event.target.value}%` })} /></label>
            <label className="field">Etichetta<input value={draft.badge} maxLength={12} placeholder="-20%" onChange={(event) => setDraft({ ...draft, badge: event.target.value })} /></label>
            <label className="field">Dal<input type="date" value={draft.dal} onChange={(event) => setDraft({ ...draft, dal: event.target.value })} /></label>
            <label className="field">Al<input type="date" value={draft.al} min={draft.dal} onChange={(event) => setDraft({ ...draft, al: event.target.value })} /></label>
          </div>
          <div className="field">
            Trattamenti in promozione
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`chip ${draft.servizi.length === 0 ? "is-on" : ""}`} onClick={() => setDraft({ ...draft, servizi: [] })}>Tutti</button>
              {services.map((service) => {
                const on = draft.servizi.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    className={`chip ${on ? "is-on" : ""}`}
                    onClick={() => setDraft({ ...draft, servizi: on ? draft.servizi.filter((id) => id !== service.id) : [...draft.servizi, service.id] })}
                  >
                    <ServiceIcon name={service.name} size={15} /> {service.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="toggle">Promozione attiva<input type="checkbox" checked={draft.attiva} onChange={(event) => setDraft({ ...draft, attiva: event.target.checked })} /></label>
          <label className="toggle">
            <span className="flex items-center gap-2"><BellRing size={16} /> Avvisa tutte le clienti con una notifica</span>
            <input type="checkbox" checked={draft.notifica} onChange={(event) => setDraft({ ...draft, notifica: event.target.checked })} />
          </label>
          <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={() => void save()}>
            <Megaphone size={18} /> {busy ? "Pubblicazione…" : draft.notifica ? "Pubblica e avvisa le clienti" : "Pubblica promozione"}
          </button>
          {draft.id ? <button className="btn btn-soft btn-block" type="button" onClick={() => setDraft(empty())}>Annulla modifica</button> : null}
        </div>

        <div className="grid gap-3">
          <p className="eyebrow">Anteprima in app</p>
          <div className="offer-stack">
            <article className="offer-card">
              <div className="offer-body" style={{ maxWidth: "70%" }}>
                <span className="offer-tag">Solo per te <Sparkles size={12} color="#f5b400" /></span>
                <h3>{draft.titolo || "Titolo della promozione"}</h3>
                <p className="offer-line">{draft.sottotitolo || "Il messaggio per le clienti"}</p>
                <div className="offer-actions"><span className="btn btn-accent btn-sm">Prenota ora</span></div>
              </div>
              {draft.badge ? <span className="offer-badge" style={{ fontSize: 13 }}>{draft.badge}</span> : null}
            </article>
          </div>
        </div>
      </div>

      <SectionHead title="Le tue promozioni" />
      {error ? <div className="empty-state">{error}</div> : null}
      {rows && rows.length === 0 && !error ? (
        <div className="empty-state"><span className="tile-icon"><Tag size={20} /></span>Nessuna promozione: crea la prima, ad esempio il Black Friday!</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {(rows ?? []).map((row) => (
          <article key={row.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
            <span className="tile-icon is-primary" style={{ width: 52, height: 52, fontSize: 13, fontWeight: 700 }}>{row.badge || `-${row.sconto}%`}</span>
            <div className="pick-main">
              <h3>{row.titolo}</h3>
              <p>{new Date(`${row.dal}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" })} → {new Date(`${row.al}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</p>
              <div className="mt-1">
                <span className={`status-pill ${live(row) ? "is-completed" : row.attiva ? "is-confirmed" : "is-cancelled"}`}>
                  {live(row) ? "In corso" : !row.attiva ? "Spenta" : row.al < today ? "Terminata" : "Programmata"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button className="icon-btn is-white" style={{ width: 36, height: 36 }} type="button" aria-label="Modifica" onClick={() => {
                setDraft({ ...row, notifica: false });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}><Pencil size={15} /></button>
              <button className="icon-btn is-white" style={{ width: 36, height: 36, color: "var(--danger)" }} type="button" aria-label="Elimina" onClick={async () => {
                if (!confirm(`Eliminare la promozione «${row.titolo}»?`)) return;
                await fetch(`/api/admin/promozioni?id=${row.id}`, { method: "DELETE" });
                await load();
              }}><Trash2 size={15} /></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
