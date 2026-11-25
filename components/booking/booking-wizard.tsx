"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, Bell, CalendarPlus, Check, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatDate, formatPrice, formatTime } from "@/lib/format";
import { HeroIconLink, SearchBar, SectionHead, TitleHero } from "@/components/ui/app-header";
import { ServiceIcon, shortDuration } from "@/components/ui/service-icon";

type Service = {
  id: string;
  nome: string;
  descrizione: string;
  durataMinuti: number;
  prezzoCentesimi: number | null;
  colore: string;
};

type State = {
  prenotazioniAttive: boolean;
  configurato: boolean;
  servizi: Service[];
};

const DRAFT = "vc-bozza-prenotazione";

export function BookingWizard() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ inizio: string; etichetta: string }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [session, setSession] = useState(false);
  const [done, setDone] = useState<{ codice: string; token: string; inizio: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [loadedDay, setLoadedDay] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const service = state?.servizi.find((item) => item.id === serviceId) ?? null;
  const horizon = useMemo(() => nextDays(21), []);

  useEffect(() => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    const raw = sessionStorage.getItem(DRAFT);
    if (raw) {
      const draft = JSON.parse(raw) as { serviceId?: string; day?: string; slot?: string };
      if (draft.serviceId) setServiceId(draft.serviceId);
      if (draft.day) {
        setDay(draft.day);
        setMonth(draft.day.slice(0, 7));
      }
      if (draft.slot) setSlot(draft.slot);
    }
    const servizio = params.get("servizio");
    const giorno = params.get("giorno");
    if (servizio) setServiceId(servizio);
    if (giorno) {
      setDay(giorno);
      setMonth(giorno.slice(0, 7));
    }
    void fetch("/api/stato").then((response) => response.json()).then(setState).catch(() => setState({ configurato: false, prenotazioniAttive: false, servizi: [] }));
    void fetch("/api/sessione").then((response) => response.json()).then((body) => setSession(Boolean(body.autenticato)));
  }, [params]);

  useEffect(() => {
    if (!serviceId || !month) return;
    void fetch(`/api/disponibilita?servizio=${serviceId}&mese=${month}`)
      .then((response) => response.json())
      .then((body) => setDays(body.giorni ?? []));
  }, [serviceId, month]);

  useEffect(() => {
    if (!serviceId || !day) return;
    setLoadedDay(null);
    const requested = day;
    void fetch(`/api/disponibilita?servizio=${serviceId}&giorno=${requested}`)
      .then((response) => response.json())
      .then((body) => {
        setSlots(body.orari ?? []);
        setLoadedDay(requested);
      });
  }, [serviceId, day]);

  function pickService(id: string) {
    setServiceId(id);
    setSlot(null);
    setSheet(false);
    remember(null, id);
  }

  function remember(nextSlot = slot, nextService = serviceId) {
    sessionStorage.setItem(DRAFT, JSON.stringify({ serviceId: nextService, day, slot: nextSlot }));
  }

  async function confirm() {
    if (!service || !slot) return;
    if (!session) {
      remember(slot);
      router.push("/accesso?prossimo=/prenota");
      return;
    }
    setBusy(true);
    const key = sessionStorage.getItem("vc-idempotenza") || crypto.randomUUID();
    sessionStorage.setItem("vc-idempotenza", key);
    const response = await fetch("/api/prenotazioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ servizioId: service.id, inizio: slot, chiaveIdempotenza: key }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      toast.error(body.errore || "Non è stato possibile confermare.");
      setSlot(null);
      setSheet(false);
      return;
    }
    sessionStorage.removeItem(DRAFT);
    sessionStorage.removeItem("vc-idempotenza");
    setDone({ codice: body.codice, token: body.token, inizio: body.inizio });
    toast.success("Il tuo appuntamento è confermato!");
  }

  const query = search.trim().toLowerCase();
  const visible = (state?.servizi ?? []).filter((item) => `${item.nome} ${item.descrizione}`.toLowerCase().includes(query));

  if (done && service) {
    return (
      <div className="app-screen">
        <TitleHero title="Prenotazione confermata" back="/" subtitle="Ti aspettiamo per prenderci cura dei tuoi capelli." />
        <section className="mx-auto mt-8 grid max-w-xl justify-items-center gap-3 text-center">
          <span className="tile-icon is-primary" style={{ width: 76, height: 76 }}><CheckCircle2 size={36} /></span>
          <h2 className="m-0 text-2xl">Il tuo appuntamento è confermato!</h2>
          <p className="m-0 text-sm leading-6 text-muted">Ti aspettiamo per prenderci cura dei tuoi capelli e regalarti un momento di bellezza.</p>
          <article className="pick-card mt-4 text-left" style={{ cursor: "default" }}>
            <span className="pick-thumb salon-media tone-0" style={{ height: 76 }}><ServiceIcon name={service.nome} size={30} /></span>
            <div className="pick-main">
              <h3>{service.nome}</h3>
              <p>{formatDate(new Date(done.inizio))} · {formatTime(new Date(done.inizio))}</p>
              <div className="pick-meta"><span className="rating-pill">Codice {done.codice}</span></div>
            </div>
          </article>
          <p className="note">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
          <a className="btn btn-primary btn-block" href={`/api/calendario/${done.token}`}><CalendarPlus size={18} /> Aggiungi al calendario</a>
          <Link className="btn btn-soft btn-block" href="/i-miei-appuntamenti">I miei appuntamenti</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <TitleHero
        title="Prenota"
        back="/"
        action={
          <HeroIconLink href="/i-miei-appuntamenti" label="I miei appuntamenti" tone="white" dot>
            <Bell size={20} strokeWidth={2} />
          </HeroIconLink>
        }
      >
        <SearchBar placeholder="Cerca trattamento" value={search} onChange={setSearch} />
      </TitleHero>

      {state && !state.configurato ? <p className="note mt-4">Le prenotazioni online saranno disponibili al termine della configurazione del salone.</p> : null}
      {state?.configurato && !state.prenotazioniAttive ? <p className="card-soft mt-4 text-sm">Le prenotazioni online non sono ancora attive.</p> : null}

      {state && state.servizi.length > 0 ? (
        <div className="chips mt-5" role="group" aria-label="Scelta rapida del trattamento">
          <button type="button" className={`chip ${!serviceId ? "is-on" : ""}`} onClick={() => { setServiceId(null); setSlot(null); setSheet(false); }}>
            Tutti i servizi
          </button>
          {state.servizi.map((item) => (
            <button key={item.id} type="button" className={`chip ${serviceId === item.id ? "is-on" : ""}`} onClick={() => pickService(item.id)}>
              {item.nome}
            </button>
          ))}
        </div>
      ) : null}

      <div className="booking-layout">
        <section aria-labelledby="scegli-trattamento">
          <SectionHead id="scegli-trattamento" title="Trattamento" subtitle="Come possiamo prenderci cura dei tuoi capelli?" />
          {!state ? (
            <div className="grid gap-3" role="status" aria-label="Caricamento in corso">
              {[0, 1, 2].map((index) => <div key={index} className="skeleton" style={{ height: 92 }} />)}
            </div>
          ) : null}
          {state && visible.length === 0 ? (
            <div className="empty-state"><span className="tile-icon"><Sparkles size={20} /></span>{search ? "Nessun trattamento corrisponde alla ricerca." : "Nessun trattamento disponibile."}</div>
          ) : null}
          <div className="grid gap-3">
            {visible.map((item, index) => {
              const on = serviceId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  className={`pick-card ${on ? "is-on" : ""}`}
                  onClick={() => pickService(item.id)}
                >
                  <span className={`pick-thumb salon-media tone-${index % 4}`} style={{ height: 76 }}>
                    <ServiceIcon name={item.nome} size={30} />
                  </span>
                  <span className="pick-main">
                    <h3>{item.nome}</h3>
                    <p>{item.descrizione}</p>
                    <span className="pick-meta">
                      <strong>{item.prezzoCentesimi == null ? "Da concordare" : formatPrice(item.prezzoCentesimi)}</strong>
                      <span className="rating-pill"><Clock size={11} strokeWidth={2.4} style={{ fill: "none", color: "#fff" }} />{shortDuration(item.durataMinuti)}</span>
                    </span>
                  </span>
                  <span className="round-arrow" aria-hidden style={on ? { background: "var(--primary)" } : undefined}>
                    {on ? <Check size={16} strokeWidth={2.6} /> : <ArrowUpRight size={16} strokeWidth={2.2} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sticky-col" aria-labelledby="scegli-giorno">
          <SectionHead id="scegli-giorno" title="Giorno" subtitle="Scegli il giorno che preferisci" />
          <div className="date-strip" role="listbox" aria-label="Giorni disponibili">
            {horizon.map((item) => (
              <button
                key={item.iso}
                type="button"
                className={`date-chip ${day === item.iso ? "is-on" : ""} ${serviceId && days.includes(item.iso) ? "has-slot" : ""}`}
                aria-pressed={day === item.iso}
                onClick={() => {
                  setDay(item.iso);
                  setMonth(item.iso.slice(0, 7));
                  setSlot(null);
                  setSheet(false);
                }}
              >
                <small>{item.weekday}</small>
                <strong>{item.number}</strong>
              </button>
            ))}
          </div>

          <SectionHead title="Orario" subtitle="Seleziona l'orario più comodo per te" />
          {!serviceId || !day ? <div className="empty-state"><span className="tile-icon"><Clock size={20} /></span>Scegli il trattamento e il giorno per vedere gli orari.</div> : null}
          {serviceId && day && loadedDay === day && slots.length === 0 ? (
            <div className="empty-state">Non ci sono orari disponibili per questa giornata. Ti invitiamo a scegliere un&apos;altra data.</div>
          ) : null}
          <div className="time-grid">
            {slots.map((item) => (
              <button
                key={item.inizio}
                type="button"
                className={`time-chip ${slot === item.inizio ? "is-on" : ""}`}
                onClick={() => {
                  setSlot(item.inizio);
                  remember(item.inizio);
                  setSheet(true);
                }}
              >
                {item.etichetta}
              </button>
            ))}
          </div>
          {service && slot && !sheet ? (
            <button className="btn btn-primary btn-block mt-6" type="button" onClick={() => setSheet(true)}>Rivedi e conferma</button>
          ) : null}
        </section>
      </div>

      <AnimatePresence>
        {sheet && service && slot ? (
          <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="sheet-scrim" type="button" aria-label="Chiudi riepilogo" onClick={() => setSheet(false)} />
            <motion.div
              className="sheet-panel"
              role="dialog"
              aria-label="Riepilogo"
              initial={reduce ? false : { y: 40 }}
              animate={{ y: 0 }}
            >
              <div className="sheet-handle" />
              <p className="eyebrow">Riepilogo</p>
              <div className="pick-card mt-3" style={{ cursor: "default" }}>
                <span className="pick-thumb salon-media tone-0" style={{ height: 76 }}><ServiceIcon name={service.nome} size={30} /></span>
                <div className="pick-main">
                  <h3>{service.nome}</h3>
                  <p>{formatDate(new Date(slot))} alle {formatTime(new Date(slot))}</p>
                  <div className="pick-meta">
                    <strong>{service.prezzoCentesimi == null ? "Da concordare" : formatPrice(service.prezzoCentesimi)}</strong>
                    <span className="rating-pill">{shortDuration(service.durataMinuti)}</span>
                  </div>
                </div>
              </div>
              <p className="note mt-3">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
              <button className="btn btn-primary btn-block mt-4" type="button" disabled={busy || !state?.prenotazioniAttive} onClick={() => void confirm()}>
                {session ? "Conferma appuntamento" : "Accedi per confermare"}
              </button>
              <button className="btn btn-soft btn-block mt-2" type="button" onClick={() => setSheet(false)}>Cambia orario</button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
