"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, formatPrice } from "@/lib/format";

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
  const days = nextDays(14);

  useEffect(() => {
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
  }, []);

  return (
    <div className="app-screen">
      <header className="app-hero">
        <Image src="/brand/vale.png" alt="VC Hair Studio" width={76} height={76} priority unoptimized />
        <p className="eyebrow">VC Hair Studio</p>
        <h1 className="mt-2 max-w-xl font-display text-5xl leading-none text-cocoa">Concediti un momento tutto per te.</h1>
        <p className="mt-3 max-w-xl text-base leading-7">
          La bellezza dei tuoi capelli inizia da qui. Scegli il trattamento che desideri e prenota il tuo prossimo appuntamento.
        </p>
      </header>

      <section aria-labelledby="giorni">
        <div className="section-label">
          <span id="giorni">Giorno</span>
          <p>Scegli il giorno che preferisci</p>
        </div>
        <div className="date-strip">
          {days.map((day) => (
            <Link key={day.iso} href={`/prenota?giorno=${day.iso}`} className="date-chip">
              <small>{day.weekday}</small>
              <strong>{day.number}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="trattamenti">
        <div className="section-label">
          <span>Trattamento</span>
          <h2 id="trattamenti" className="font-display text-3xl text-cocoa">Come possiamo prenderci cura dei tuoi capelli?</h2>
        </div>
        {ready === false ? <p>Le prenotazioni online saranno disponibili al termine della configurazione del salone.</p> : null}
        {services === null ? <div className="h-28 animate-pulse rounded-[28px] bg-white" /> : null}
        <div className="grid gap-3">
          {(services ?? []).map((service) => (
            <Link key={service.id} href={`/prenota?servizio=${service.id}`} className="service-card">
              <span className="font-display text-2xl text-cocoa">{service.nome}</span>
              <span className="mt-1 block text-sm leading-6">{service.descrizione}</span>
              <span className="mt-3 inline-flex rounded-full bg-blush-soft px-3 py-1 text-sm text-cocoa">
                {formatDuration(service.durataMinuti)} · {formatPrice(service.prezzoCentesimi)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Link className="cta" href="/prenota">Prenota il tuo appuntamento</Link>
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
