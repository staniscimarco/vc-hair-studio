"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDate, formatPrice, formatTime } from "@/lib/format";

type Row = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number | null;
  calendar_token: string;
  services: { name?: string } | { name?: string }[] | null;
};

const labels: Record<string, string> = {
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
      <header className="app-hero">
        <h1 className="font-display text-5xl text-cocoa">I miei appuntamenti</h1>
        <Link className="cta" href="/prenota">Prenota</Link>
      </header>
      {error ? <p className="mt-6">{error}</p> : null}
      {!rows ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-blush-soft" /> : null}
      {rows ? (
        <>
          <h2 className="mt-8 font-display text-3xl">Prossimi</h2>
          <List rows={future} onCancel={cancel} empty="Non hai appuntamenti in programma." />
          <h2 className="mt-8 font-display text-3xl">Storico</h2>
          <List rows={past} empty="Lo storico è ancora vuoto." />
        </>
      ) : null}
    </section>
  );
}

function List({ rows, onCancel, empty }: { rows: Row[]; onCancel?: (id: string) => void; empty: string }) {
  if (rows.length === 0) return <p className="mt-3 text-sm">{empty}</p>;
  return (
    <div className="mt-3 grid gap-3">
      {rows.map((row) => {
        const minutes = Math.round((new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000);
        return (
          <article key={row.id} className="rounded-3xl bg-white p-4 shadow-[var(--shadow)]">
            <p className="font-display text-2xl">{serviceName(row)}</p>
            <p>{formatDate(new Date(row.starts_at))} · {formatTime(new Date(row.starts_at))} · {minutes} minuti</p>
            <p>{formatPrice(row.price_cents)}</p>
            <p className="text-sm">Stato: {labels[row.status] ?? row.status} · Codice {row.code}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <a href={`/api/calendario/${row.calendar_token}`}>Aggiungi al calendario</a>
              {onCancel && row.status === "confirmed" ? (
                <button type="button" className="underline" onClick={() => onCancel(row.id)}>Annulla</button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
