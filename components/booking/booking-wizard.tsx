"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatDate, formatDuration, formatPrice, formatTime } from "@/lib/format";

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

  function remember(nextSlot = slot) {
    sessionStorage.setItem(DRAFT, JSON.stringify({ serviceId, day, slot: nextSlot }));
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

  if (done && service) {
    return (
      <section className="app-screen text-center">
        <p className="eyebrow">Prenotazione confermata</p>
        <h1 className="mt-3 font-display text-5xl text-cocoa">Il tuo appuntamento è confermato!</h1>
        <p className="mt-4 text-lg leading-8">Ti aspettiamo per prenderci cura dei tuoi capelli e regalarti un momento di bellezza.</p>
        <div className="service-card mt-8 text-left">
          <p className="font-display text-3xl text-cocoa">{service.nome}</p>
          <p className="mt-2">{formatDate(new Date(done.inizio))} · {formatTime(new Date(done.inizio))}</p>
          <p className="mt-2">Codice {done.codice}</p>
          <p className="mt-4 text-sm">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
          <a className="cta" href={`/api/calendario/${done.token}`}>Aggiungi al calendario</a>
        </div>
      </section>
    );
  }

  return (
    <div className="app-screen">
      <header className="app-hero">
        <Image src="/brand/vale.png" alt="VC Hair Studio" width={64} height={64} unoptimized />
        <p className="eyebrow">Prenota</p>
        <h1 className="mt-2 font-display text-4xl text-cocoa">Prenota il tuo appuntamento</h1>
      </header>

      {!state ? <div className="h-28 animate-pulse rounded-[28px] bg-white" role="status">Caricamento in corso.</div> : null}
      {state && !state.configurato ? <p>Le prenotazioni online saranno disponibili al termine della configurazione del salone.</p> : null}
      {state?.configurato && !state.prenotazioniAttive ? <p className="rounded-3xl bg-white p-4 text-sm">Le prenotazioni online non sono ancora attive.</p> : null}

      <div className="booking-layout">
        <section>
          <div className="section-label">
            <span className="field-caption">Trattamento</span>
            <h2 className="font-display text-3xl text-cocoa">Come possiamo prenderci cura dei tuoi capelli?</h2>
          </div>
          <div className="grid gap-3">
            {(state?.servizi ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`service-card ${serviceId === item.id ? "is-on" : ""}`}
                onClick={() => {
                  setServiceId(item.id);
                  setSlot(null);
                  setSheet(false);
                  remember(null);
                }}
              >
                <span className="font-display text-2xl text-cocoa">{item.nome}</span>
                <span className="mt-1 block text-sm leading-6">{item.descrizione}</span>
                <span className="mt-3 inline-flex rounded-full px-3 py-1 text-sm text-cocoa" style={{ background: item.colore }}>
                  {formatDuration(item.durataMinuti)} · {formatPrice(item.prezzoCentesimi)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="section-label">
            <span className="field-caption">Giorno</span>
            <p>Scegli il giorno che preferisci</p>
          </div>
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

          <div className="section-label">
            <span className="field-caption">Orario</span>
            <p>Seleziona l&apos;orario più comodo per te</p>
          </div>
          {!serviceId || !day ? <p className="text-sm">Scegli il trattamento e il giorno per vedere gli orari.</p> : null}
          {serviceId && day && loadedDay === day && slots.length === 0 ? (
            <p>Non ci sono orari disponibili per questa giornata. Ti invitiamo a scegliere un&apos;altra data.</p>
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
              <p className="field-caption">Riepilogo</p>
              <h2 className="font-display text-3xl text-cocoa">{service.nome}</h2>
              <p className="mt-2">{formatDate(new Date(slot))} alle {formatTime(new Date(slot))}</p>
              <p>{formatDuration(service.durataMinuti)} · {formatPrice(service.prezzoCentesimi)}</p>
              <p className="mt-3 text-sm">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
              <button className="cta" type="button" disabled={busy || !state?.prenotazioniAttive} onClick={() => void confirm()}>
                {session ? "Conferma appuntamento" : "Accedi per confermare"}
              </button>
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
