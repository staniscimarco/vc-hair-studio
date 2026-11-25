"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, Clock, Plus } from "lucide-react";
import { TIME_ZONE } from "@/lib/availability/time";
import { formatPrice, formatTime } from "@/lib/format";
import { HeroIconLink, SectionHead, TitleHero } from "@/components/ui/app-header";
import { ServiceIcon } from "@/components/ui/service-icon";

type Row = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  cancel_reason?: string | null;
  price_cents: number | null;
  calendar_token: string;
  services: { name?: string } | { name?: string }[] | null;
};

const labels: Record<string, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermato",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato",
  no_show: "Mancata presentazione",
};

function serviceName(row: Row) {
  if (!row.services) return "Trattamento";
  return Array.isArray(row.services) ? row.services[0]?.name ?? "Trattamento" : row.services.name ?? "Trattamento";
}

export default function AppointmentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState<number | null>(null);
  const [tab, setTab] = useState<"prossimi" | "storico">("prossimi");

  async function load() {
    const response = await fetch("/api/prenotazioni");
    const body = await response.json();
    if (!response.ok) {
      setError(body.errore || "Accedi per vedere i tuoi appuntamenti.");
      setRows([]);
      return;
    }
    setClock(Date.now());
    setRows(body.appuntamenti ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function cancel(id: string) {
    if (!confirm("Vuoi annullare questo appuntamento?")) return;
    const response = await fetch(`/api/prenotazioni/${id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else {
      toast.success("Appuntamento annullato.");
      await load();
    }
  }

  const future = (rows ?? []).filter((row) => clock != null && new Date(row.starts_at).getTime() >= clock && row.status !== "cancelled");
  const past = (rows ?? []).filter((row) => clock != null && (new Date(row.starts_at).getTime() < clock || row.status === "cancelled"));

  return (
    <section className="app-screen">
      <TitleHero
        title="I miei appuntamenti"
        back="/"
        action={
          <HeroIconLink href="/prenota" label="Nuova prenotazione" tone="white">
            <Plus size={20} strokeWidth={2.2} />
          </HeroIconLink>
        }
        subtitle="I tuoi momenti di bellezza, sempre a portata di mano."
      />

      <div className="chips mt-5" role="tablist" aria-label="Filtra appuntamenti">
        <button role="tab" aria-selected={tab === "prossimi"} type="button" className={`chip ${tab === "prossimi" ? "is-on" : ""}`} onClick={() => setTab("prossimi")}>
          Prossimi <span className="count">{future.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "storico"} type="button" className={`chip ${tab === "storico" ? "is-on" : ""}`} onClick={() => setTab("storico")}>
          Storico <span className="count">{past.length}</span>
        </button>
      </div>

      {error ? (
        <div className="empty-state mt-5">
          <span className="tile-icon"><CalendarDays size={20} /></span>
          {error}
          <Link className="btn btn-primary btn-sm" href="/accesso?prossimo=/i-miei-appuntamenti">Accedi</Link>
        </div>
      ) : null}
      {!rows ? <div className="mt-5 grid gap-3">{[0, 1].map((index) => <div key={index} className="skeleton" style={{ height: 130 }} />)}</div> : null}
      {rows && !error ? (
        <>
          <SectionHead title={tab === "prossimi" ? "Prossimi" : "Storico"} href="/prenota" linkLabel="Prenota" />
          {tab === "prossimi" ? (
            <List rows={future} onCancel={cancel} empty="Nessun appuntamento in programma… è il momento giusto per coccolarti!" />
          ) : (
            <List rows={past} empty="Lo storico è ancora vuoto." />
          )}
        </>
      ) : null}
    </section>
  );
}

function List({ rows, onCancel, empty }: { rows: Row[]; onCancel?: (id: string) => void; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <span className="tile-icon"><CalendarDays size={20} /></span>
        {empty}
        {onCancel ? <Link className="btn btn-primary btn-sm" href="/prenota">Prenota ora</Link> : null}
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((row) => {
        const start = new Date(row.starts_at);
        const minutes = Math.round((new Date(row.ends_at).getTime() - start.getTime()) / 60000);
        const rejected = row.status === "cancelled" && row.cancel_reason === "rifiutata_dal_salone";
        const statusClass = row.status === "pending" ? "is-pending" : row.status === "cancelled" || row.status === "no_show" ? "is-cancelled" : row.status === "completed" ? "is-completed" : "is-confirmed";
        return (
          <article key={row.id} className="salon-card" style={{ cursor: "default" }}>
            <div className="flex gap-3">
              <div className="grid w-[76px] flex-none place-items-center rounded-2xl bg-primary py-3 text-center text-white">
                <span className="text-[11px] uppercase opacity-80">{new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: TIME_ZONE }).format(start)}</span>
                <strong className="text-2xl leading-none">{new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: TIME_ZONE }).format(start)}</strong>
                <span className="text-[11px] capitalize opacity-80">{new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: TIME_ZONE }).format(start)}</span>
              </div>
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="m-0 text-base">{serviceName(row)}</h3>
                  <span className={`status-pill ${statusClass}`}>{rejected ? "Non disponibile" : labels[row.status] ?? row.status}</span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-[13px] text-[#3d3b47]">
                  <Clock size={13} /> {formatTime(start)} · {minutes} minuti
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[15px] font-bold">{row.price_cents == null ? "Da concordare" : formatPrice(row.price_cents)}</span>
                  <span className="text-[11px] text-muted">Codice {row.code}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 px-1 pb-1">
              <a className={`btn btn-white btn-xs flex-1 ${row.status === "pending" ? "pointer-events-none opacity-50" : ""}`} href={`/api/calendario/${row.calendar_token}`}>
                <CalendarPlus size={14} /> Aggiungi al calendario
              </a>
              {onCancel && (row.status === "confirmed" || row.status === "pending") ? (
                <button type="button" className="btn btn-danger btn-xs" onClick={() => onCancel(row.id)}>Annulla</button>
              ) : null}
              {!onCancel ? (
                <Link className="btn btn-accent btn-xs" href="/prenota"><ServiceIcon name={serviceName(row)} size={13} /> Prenota di nuovo</Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
