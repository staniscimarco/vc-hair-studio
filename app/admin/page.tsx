"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Ban,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  Clock,
  Euro,
  Hourglass,
  ListChecks,
  Scissors,
  Settings,
  Sparkles,
  Tag,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { RequestCard, type Request } from "@/components/admin/request-card";
import { GreetingHero, HeroIconLink, SectionHead, greeting, todayLabel } from "@/components/ui/app-header";

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

const actions: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/appuntamenti", label: "Nuovo", icon: CalendarPlus },
  { href: "/admin/calendario", label: "Agenda", icon: CalendarDays },
  { href: "/admin/disponibilita", label: "Blocca", icon: Ban },
  { href: "/admin/disponibilita", label: "Chiudi giornata", icon: CalendarX },
  { href: "/admin/promozioni", label: "Promo", icon: Tag },
  { href: "/admin/servizi", label: "Servizi", icon: Scissors },
  { href: "/admin/clienti", label: "Clienti", icon: Users },
  { href: "/admin/configurazione", label: "Configura", icon: ListChecks },
];

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    setNow(new Date());
    void fetch("/api/admin/panoramica").then(async (response) => {
      const body = await response.json();
      if (!response.ok) setError(body.errore);
      else setStats(body);
    });
    void fetch("/api/admin/richieste")
      .then((response) => response.json())
      .then((body) => setRequests(body.richieste ?? []))
      .catch(() => undefined);
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((body) => setName(body.nome ?? ""))
      .catch(() => undefined);
  }, []);

  const cards: { label: string; value: string; icon: LucideIcon }[] = stats
    ? [
        { label: "Oggi", value: String(stats.oggi), icon: CalendarCheck },
        { label: "Domani", value: String(stats.domani), icon: CalendarDays },
        { label: "Nuove prenotazioni", value: String(stats.nuove), icon: Sparkles },
        { label: "Completati", value: String(stats.completati), icon: CheckCircle2 },
        { label: "Annullati", value: String(stats.annullati), icon: XCircle },
        { label: "Clienti", value: String(stats.clienti), icon: Users },
        { label: "Ore prenotate", value: stats.orePrenotate.toFixed(1), icon: Clock },
        { label: "Ore disponibili", value: stats.oreDisponibili.toFixed(1), icon: Hourglass },
        { label: "Incasso previsto", value: formatPrice(stats.incassoPrevisto), icon: Euro },
        { label: "Senza prezzo", value: String(stats.senzaPrezzo), icon: Euro },
        { label: "Incasso registrato", value: formatPrice(stats.incassoEffettivo), icon: Euro },
      ]
    : [];

  return (
    <section>
      <GreetingHero
        title={`${now ? greeting(now) : "Ciao"}${name ? `, ${name}` : ""}`}
        subtitle={now ? todayLabel(now) : "Area salone"}
        avatar={name ? name.charAt(0).toUpperCase() : <UserRound size={24} />}
        actions={
          <>
            <HeroIconLink href="/admin/impostazioni" label="Impostazioni">
              <Settings size={20} strokeWidth={2} />
            </HeroIconLink>
            <HeroIconLink href="/admin/notifiche" label="Notifiche" tone="white" dot>
              <Bell size={20} strokeWidth={2} />
            </HeroIconLink>
          </>
        }
      />

      {requests.length ? (
        <section aria-labelledby="richieste">
          <SectionHead id="richieste" title={`Da confermare (${requests.length})`} subtitle="Nuove richieste online: rispondi con un tocco, la cliente viene avvisata." />
          <div className="grid gap-3 lg:grid-cols-2">
            {requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      ) : null}

      <SectionHead title="Oggi in salone" href="/admin/calendario" linkLabel="Agenda" />
      <div className="offer-stack">
        <article className="offer-card">
          <div className="offer-body">
            <span className="offer-tag">Agenda di oggi <CalendarCheck size={12} color="#5826b2" /></span>
            <h2>{stats ? `${stats.oggi} ${stats.oggi === 1 ? "appuntamento" : "appuntamenti"} oggi` : "Caricamento agenda…"}</h2>
            <p className="offer-line">
              {stats?.prossimo
                ? `Prossimo: ${formatDate(new Date(stats.prossimo))} alle ${formatTime(new Date(stats.prossimo))}`
                : "Nessun appuntamento in arrivo"}
            </p>
            <div className="offer-actions">
              <Link className="btn btn-accent btn-sm" href="/admin/calendario">Apri agenda</Link>
              <Link className="round-arrow" href="/admin/appuntamenti" aria-label="Nuovo appuntamento">
                <ArrowUpRight size={16} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
          <span className="offer-visual" aria-hidden>
            <Image src="/brand/vale.png" alt="" width={240} height={240} unoptimized />
          </span>
          <span className="offer-badge">Domani<br />{stats ? stats.domani : "–"}</span>
        </article>
      </div>

      <SectionHead title="Azioni rapide" />
      <div className="service-dots">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="service-dot">
              <span className="dot-circle"><Icon size={24} strokeWidth={1.9} /></span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <SectionHead title="Panoramica" subtitle="Dati del periodo corrente" />
      {error ? <div className="empty-state">{error}</div> : null}
      {!stats && !error ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="skeleton" style={{ height: 112 }} />)}
        </div>
      ) : null}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="stat-card">
                <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><Icon size={17} /></span>
                <div>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      <p className="note mt-4">La registrazione degli incassi non sostituisce gli adempimenti fiscali.</p>
    </section>
  );
}
