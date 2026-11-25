"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, Clock, Heart, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { GreetingHero, HeroIconLink, SearchBar, SectionHead, greeting, todayLabel } from "@/components/ui/app-header";
import { ServiceIcon, shortDuration } from "@/components/ui/service-icon";

type Service = {
  id: string;
  nome: string;
  descrizione: string;
  durataMinuti: number;
  prezzoCentesimi: number | null;
};

export function HomeScreen() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const days = useMemo(() => nextDays(14), []);

  useEffect(() => {
    setNow(new Date());
    void fetch("/api/stato")
      .then((response) => response.json())
      .then((body) => {
        setReady(Boolean(body.configurato));
        setServices(body.servizi ?? []);
      })
      .catch(() => {
        setReady(false);
        setServices([]);
      });
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((body) => setName(body.nome ?? ""))
      .catch(() => undefined);
  }, []);

  const filtered = (services ?? []).filter((service) =>
    `${service.nome} ${service.descrizione}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="app-screen">
      <GreetingHero
        title={`${now ? greeting(now) : "Ciao"}${name ? `, ${name}` : ""}`}
        subtitle={now ? todayLabel(now) : "VC Hair Studio"}
        actions={
          <>
            <HeroIconLink href="/prenota" label="Trattamenti">
              <Heart size={20} strokeWidth={2} />
            </HeroIconLink>
            <HeroIconLink href="/i-miei-appuntamenti" label="Promemoria appuntamenti" tone="white" dot>
              <Bell size={20} strokeWidth={2} />
            </HeroIconLink>
          </>
        }
      >
        <SearchBar placeholder="Cerca trattamento, servizio" value={query} onChange={setQuery} filterHref="/prenota" filterLabel="Prenota" />
      </GreetingHero>

      <SectionHead title="Per te" href="/prenota" />
      <div className="offer-stack">
        <article className="offer-card">
          <div className="offer-body">
            <span className="offer-tag">Solo per te <Sparkles size={12} color="#f5b400" /></span>
            <h2>Concediti un momento tutto per te.</h2>
            <p className="offer-line">Prenota in <strong>1</strong> minuto</p>
            <div className="offer-actions">
              <Link className="btn btn-accent btn-sm" href="/prenota">Prenota ora</Link>
              <Link className="round-arrow" href="/prenota" aria-label="Prenota il tuo appuntamento">
                <ArrowUpRight size={16} strokeWidth={2.2} />
              </Link>
            </div>
          </div>
          <span className="offer-visual" aria-hidden>
            <Image src="/brand/vale.png" alt="" width={240} height={240} unoptimized />
          </span>
          <span className="offer-badge">Paghi<br />in salone</span>
        </article>
      </div>

      <section aria-labelledby="servizi">
        <SectionHead id="servizi" title="Servizi" subtitle="Come possiamo prenderci cura dei tuoi capelli?" href="/prenota" />
        {ready === false ? <p className="note">Le prenotazioni online saranno disponibili al termine della configurazione del salone.</p> : null}
        {services === null ? (
          <div className="service-dots" aria-hidden>
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="skeleton" style={{ flex: "0 0 58px", height: 58, borderRadius: 999 }} />
            ))}
          </div>
        ) : (
          <div className="service-dots">
            {filtered.map((service) => (
              <Link key={service.id} href={`/prenota?servizio=${service.id}`} className="service-dot">
                <span className="dot-circle"><ServiceIcon name={service.nome} /></span>
                <span>{service.nome}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="in-evidenza">
        <SectionHead id="in-evidenza" title="I più richiesti" href="/prenota" />
        {services === null ? (
          <div className="h-scroll" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton" style={{ height: 250 }} />)}
          </div>
        ) : null}
        {services && filtered.length === 0 ? (
          <div className="empty-state">
            <span className="tile-icon"><Sparkles size={20} /></span>
            {query ? "Nessun trattamento corrisponde alla ricerca." : "I trattamenti saranno presto disponibili."}
          </div>
        ) : null}
        <div className="h-scroll">
          {filtered.map((service, index) => (
            <Link key={service.id} href={`/prenota?servizio=${service.id}`} className="salon-card">
              <div className={`salon-media tone-${index % 4}`}>
                <span className="fav-badge" aria-hidden><Heart size={15} fill="currentColor" strokeWidth={0} /></span>
                <ServiceIcon name={service.nome} size={56} strokeWidth={1.4} />
              </div>
              <div className="salon-body">
                <div className="flex items-center justify-between gap-2">
                  <h3>{service.nome}</h3>
                  <span className="rating-pill"><Clock size={11} strokeWidth={2.4} style={{ fill: "none", color: "#fff" }} />{shortDuration(service.durataMinuti)}</span>
                </div>
                <p className="salon-line">{service.descrizione}</p>
                <div className="salon-foot">
                  <span className="salon-price">{service.prezzoCentesimi == null ? "Da concordare" : formatPrice(service.prezzoCentesimi)}</span>
                  <span className="round-arrow" aria-hidden><ArrowUpRight size={16} strokeWidth={2.2} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="giorni">
        <SectionHead id="giorni" title="Scegli il giorno" subtitle="Scegli il giorno che preferisci" href="/prenota" linkLabel="Calendario" />
        <div className="date-strip">
          {days.map((day) => (
            <Link key={day.iso} href={`/prenota?giorno=${day.iso}`} className="date-chip">
              <small>{day.weekday}</small>
              <strong>{day.number}</strong>
            </Link>
          ))}
        </div>
      </section>

      <Link className="btn btn-primary btn-block mt-8 lg:hidden" href="/prenota">Prenota il tuo appuntamento</Link>
    </div>
  );
}

function nextDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      iso,
      number: String(date.getDate()),
      weekday: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", ""),
    };
  });
}
