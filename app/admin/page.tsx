"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate, formatPrice, formatTime } from "@/lib/format";

type Stats = {
  oggi: number;
  domani: number;
  prossimo: string | null;
  nuove: number;
  completati: number;
  annullati: number;
  clienti: number;
  orePrenotate: number;
  oreDisponibili: number;
  incassoPrevisto: number;
  senzaPrezzo: number;
  incassoEffettivo: number;
};

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/admin/panoramica").then(async (response) => {
      const body = await response.json();
      if (!response.ok) setError(body.errore);
      else setStats(body);
    });
  }, []);
  return (
    <section>
      <header className="app-hero">
        <p className="eyebrow">Agenda</p>
        <h1 className="font-display text-5xl text-cocoa">Oggi in salone</h1>
      </header>
      {error ? <p className="mt-4">{error}</p> : null}
      {!stats && !error ? <div className="mt-6 h-40 animate-pulse rounded-3xl bg-blush-soft" /> : null}
      {stats ? (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Oggi" value={String(stats.oggi)} />
          <Card label="Domani" value={String(stats.domani)} />
          <Card label="Prossimo" value={stats.prossimo ? `${formatDate(new Date(stats.prossimo))} ${formatTime(new Date(stats.prossimo))}` : "Nessuno"} />
          <Card label="Nuove prenotazioni" value={String(stats.nuove)} />
          <Card label="Completati" value={String(stats.completati)} />
          <Card label="Annullati" value={String(stats.annullati)} />
          <Card label="Clienti" value={String(stats.clienti)} />
          <Card label="Ore prenotate" value={stats.orePrenotate.toFixed(1)} />
          <Card label="Ore disponibili" value={stats.oreDisponibili.toFixed(1)} />
          <Card label="Incasso previsto" value={formatPrice(stats.incassoPrevisto)} />
          <Card label="Senza prezzo" value={String(stats.senzaPrezzo)} />
          <Card label="Incasso registrato" value={formatPrice(stats.incassoEffettivo)} />
        </div>
      ) : null}
      <p className="mt-4 text-sm">La registrazione degli incassi non sostituisce gli adempimenti fiscali.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="rounded-full bg-cocoa px-4 py-2 text-cream" href="/admin/calendario">+ Nuovo appuntamento</Link>
        <Link className="rounded-full border border-cocoa px-4 py-2" href="/admin/disponibilita">Blocca disponibilità</Link>
        <Link className="rounded-full border border-cocoa px-4 py-2" href="/admin/disponibilita">Chiudi giornata</Link>
        <Link className="rounded-full border border-cocoa px-4 py-2" href="/admin/calendario">Vai al calendario</Link>
      </div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl bg-white p-4 shadow-[var(--shadow)]">
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 font-display text-3xl text-cocoa">{value}</p>
    </article>
  );
}
