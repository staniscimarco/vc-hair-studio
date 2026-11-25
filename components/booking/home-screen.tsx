"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarCheck, Clock, Heart, MapPinHouse, Sparkles, Star, Tag, Timer } from "lucide-react";
import { GreetingHero, HeroIconLink, SectionHead, greeting, todayLabel } from "@/components/ui/app-header";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ServiceArt, shortDuration } from "@/components/ui/service-icon";
import { Price, promoFor, type PublicPromo } from "@/components/ui/price";

type Service = {
  id: string;
  nome: string;
  descrizione: string;
  durataMinuti: number;
  prezzoCentesimi: number | null;
};

const reasons = [
  { icon: Timer, title: "Prenoti in 1 minuto", text: "Scegli trattamento e orario, quando vuoi." },
  { icon: MapPinHouse, title: "Il salone viene da te", text: "Servizio a domicilio a Brindisi: ti coccoliamo comodamente a casa tua." },
  { icon: Star, title: "Prodotti professionali", text: "Cura e attenzione su misura per i tuoi capelli." },
];

export function HomeScreen() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [promo, setPromo] = useState<PublicPromo | null>(null);
  const [name, setName] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [openDays, setOpenDays] = useState<string[] | null>(null);
  const days = useMemo(() => nextDays(14), []);

  useEffect(() => {
    setNow(new Date());
    void fetch("/api/stato")
      .then((response) => response.json())
      .then((body) => {
        setServices(body.servizi ?? []);
        setPromo(body.promozione ?? null);
      })
      .catch(() => {
        setServices([]);
      });
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((body) => setName(body.nome ?? ""))
      .catch(() => undefined);
  }, []);

  const list = services ?? [];

  // Giorni con almeno un orario libero (sul trattamento più breve): gli altri non sono selezionabili.
  useEffect(() => {
    if (!services?.length) return;
    const shortest = [...services].sort((a, b) => a.durataMinuti - b.durataMinuti)[0];
    const months = [...new Set(days.map((day) => day.iso.slice(0, 7)))];
    void Promise.all(
      months.map((month) =>
        fetch(`/api/disponibilita?servizio=${shortest.id}&mese=${month}`)
          .then((response) => response.json())
          .then((body) => (body.giorni ?? []) as string[])
          .catch(() => [] as string[]),
      ),
    ).then((lists) => setOpenDays(lists.flat()));
  }, [services, days]);
  const promoEnds = promo ? new Date(`${promo.al}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";

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
            <NotificationBell href="/notifiche" />
          </>
        }
      />

      <SectionHead title={promo ? "Offerta speciale" : "Per te"} subtitle={promo ? `Valida fino al ${promoEnds}` : "Il tuo momento di bellezza ti aspetta"} href="/prenota" />
      <div className="offer-stack">
        {promo ? (
          <article className="offer-card is-promo">
            <div className="offer-body">
              <span className="offer-tag">Solo per pochi giorni <Tag size={12} color="#5826b2" /></span>
              <h2>{promo.titolo}</h2>
              <p className="offer-line">
                {promo.sconto > 0 ? <>Fino al <strong>{promo.sconto}%</strong> di sconto</> : promo.sottotitolo}
              </p>
              {promo.sconto > 0 && promo.sottotitolo ? <p className="offer-line mt-1 text-[12px] opacity-80">{promo.sottotitolo}</p> : null}
              <div className="offer-actions">
                <Link className="btn btn-accent btn-sm" href="/prenota">Approfittane ora</Link>
                <Link className="round-arrow" href="/prenota" aria-label="Prenota con la promozione">
                  <ArrowUpRight size={16} strokeWidth={2.2} />
                </Link>
              </div>
            </div>
            <span className="offer-visual" aria-hidden>
              <Image src="/brand/vale.png" alt="" width={240} height={240} unoptimized />
            </span>
            {promo.badge ? <span className="offer-badge" style={{ fontSize: 13 }}>{promo.badge}</span> : null}
          </article>
        ) : (
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
          </article>
        )}
      </div>

      {services === null || list.length > 0 ? (
        <section aria-labelledby="servizi">
          <SectionHead id="servizi" title="Servizi" subtitle="Come possiamo prenderci cura dei tuoi capelli?" href="/prenota" />
          {services === null ? (
            <div className="service-tiles" aria-hidden>
              {Array.from({ length: 4 }, (_, index) => <span key={index} className="skeleton" style={{ height: 190 }} />)}
            </div>
          ) : (
            <div className="service-tiles">
              {list.map((service, index) => (
                <Link key={service.id} href={`/prenota?servizio=${service.id}`} className="service-tile">
                  <span className="tile-art">
                    <ServiceArt name={service.nome} tone={index} compact />
                    {promoFor(promo, service.id) ? <span className="promo-ribbon">-{promo?.sconto}%</span> : null}
                  </span>
                  <span className="tile-name">{service.nome}</span>
                  <span className="tile-meta">
                    <span><Clock size={12} /> {shortDuration(service.durataMinuti)}</span>
                    <Price cents={service.prezzoCentesimi} promo={promo} serviceId={service.id} className="tile-price" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section aria-labelledby="in-evidenza">
        <SectionHead id="in-evidenza" title="I più amati" subtitle="Scelti dalle nostre clienti, ogni settimana" href="/prenota" />
        {services === null ? (
          <div className="h-scroll" aria-hidden>
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton" style={{ height: 260 }} />)}
          </div>
        ) : null}
        {services && list.length === 0 ? (
          <div className="empty-state">
            <span className="tile-icon"><Sparkles size={20} /></span>
            I trattamenti saranno presto disponibili.
          </div>
        ) : null}
        <div className="h-scroll">
          {list.map((service, index) => (
            <Link key={service.id} href={`/prenota?servizio=${service.id}`} className="salon-card">
              <div className="salon-media">
                <ServiceArt name={service.nome} tone={index} />
                {promoFor(promo, service.id) ? (
                  <span className="promo-ribbon">-{promo?.sconto}%</span>
                ) : null}
                <span className="fav-badge" aria-hidden><Heart size={15} fill="currentColor" strokeWidth={0} /></span>
              </div>
              <div className="salon-body">
                <div className="flex items-start justify-between gap-2">
                  <h3>{service.nome}</h3>
                  <span className="rating-pill"><Clock size={11} strokeWidth={2.4} style={{ fill: "none", color: "#fff" }} />{shortDuration(service.durataMinuti)}</span>
                </div>
                <p className="salon-line">{service.descrizione}</p>
                <div className="salon-foot">
                  <Price className="salon-price" cents={service.prezzoCentesimi} promo={promo} serviceId={service.id} />
                  <span className="round-arrow" aria-hidden><ArrowUpRight size={16} strokeWidth={2.2} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="giorni">
        <SectionHead id="giorni" title="Quando vuoi venire?" subtitle="Tocca un giorno e scopri gli orari liberi" href="/prenota" linkLabel="Calendario" />
        <div className="date-strip">
          {days.map((day) =>
            openDays && !openDays.includes(day.iso) ? (
              <span key={day.iso} className="date-chip is-off" aria-disabled="true" title="Nessun orario disponibile">
                <small>{day.weekday}</small>
                <strong>{day.number}</strong>
              </span>
            ) : (
              <Link key={day.iso} href={`/prenota?giorno=${day.iso}`} className={`date-chip ${openDays ? "has-slot" : ""}`}>
                <small>{day.weekday}</small>
                <strong>{day.number}</strong>
              </Link>
            ),
          )}
        </div>
      </section>

      <section aria-labelledby="perche">
        <SectionHead id="perche" title="Perché sceglierci" subtitle="Una coccola per te, senza pensieri" />
        <div className="reasons">
          {reasons.map((reason) => {
            const Icon = reason.icon;
            return (
              <div key={reason.title} className="reason">
                <span className="tile-icon is-accent"><Icon size={19} /></span>
                <div>
                  <strong>{reason.title}</strong>
                  <p>{reason.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="cta-banner">
        <div>
          <strong>Il tuo prossimo look ti aspetta</strong>
          <p>Gli orari migliori vanno via in fretta: prenota adesso.</p>
        </div>
        <Link className="btn btn-white" href="/prenota"><CalendarCheck size={18} /> Prenota</Link>
      </div>
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
