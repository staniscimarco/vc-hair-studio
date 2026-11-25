"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  messaggio?: string;
};

const DRAFT = "vc-bozza-prenotazione";
const steps = ["Trattamento", "Giorno", "Orario", "Riepilogo"] as const;

export function BookingWizard() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => "");
  const [days, setDays] = useState<string[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ inizio: string; etichetta: string }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [session, setSession] = useState(false);
  const [done, setDone] = useState<{ codice: string; token: string; inizio: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const service = state?.servizi.find((item) => item.id === serviceId) ?? null;

  useEffect(() => {
    const now = new Date();
    const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(monthValue);
    const raw = sessionStorage.getItem(DRAFT);
    if (raw) {
      const draft = JSON.parse(raw) as { serviceId?: string; day?: string; slot?: string; step?: number };
      if (draft.serviceId) setServiceId(draft.serviceId);
      if (draft.day) setDay(draft.day);
      if (draft.slot) setSlot(draft.slot);
      if (typeof draft.step === "number") setStep(draft.step);
    }
    void fetch("/api/stato")
      .then((response) => response.json())
      .then(setState)
      .catch(() => setState({ configurato: false, prenotazioniAttive: false, servizi: [] }));
    void fetch("/api/sessione").then((response) => response.json()).then((body) => setSession(Boolean(body.autenticato)));
  }, []);

  useEffect(() => {
    if (!serviceId || !month) return;
    void fetch(`/api/disponibilita?servizio=${serviceId}&mese=${month}`)
      .then((response) => response.json())
      .then((body) => setDays(body.giorni ?? []));
  }, [serviceId, month]);

  useEffect(() => {
    if (!serviceId || !day) return;
    void fetch(`/api/disponibilita?servizio=${serviceId}&giorno=${day}`)
      .then((response) => response.json())
      .then((body) => setSlots(body.orari ?? []));
  }, [serviceId, day]);

  function remember(nextStep = step) {
    sessionStorage.setItem(DRAFT, JSON.stringify({ serviceId, day, slot, step: nextStep }));
  }

  const calendar = useMemo(() => buildMonth(month, days, day), [month, days, day]);

  async function confirm() {
    if (!service || !slot) return;
    if (!session) {
      remember(3);
      router.push("/accesso?prossimo=/");
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
      setStep(2);
      return;
    }
    sessionStorage.removeItem(DRAFT);
    sessionStorage.removeItem("vc-idempotenza");
    setDone({ codice: body.codice, token: body.token, inizio: body.inizio });
    toast.success("Il tuo appuntamento è confermato!");
  }

  if (done && service) {
    return (
      <section className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-rose">Prenotazione confermata</p>
        <h1 className="mt-3 font-display text-5xl text-cocoa">Il tuo appuntamento è confermato!</h1>
        <p className="mt-4 text-lg leading-8">
          Ti aspettiamo per prenderci cura dei tuoi capelli e regalarti un momento di bellezza.
        </p>
        <div className="mt-8 rounded-3xl bg-white p-6 text-left shadow-[var(--shadow)]">
          <p className="font-display text-3xl">{service.nome}</p>
          <p className="mt-2">{formatDate(new Date(done.inizio))} · {formatTime(new Date(done.inizio))}</p>
          <p className="mt-2">Codice {done.codice}</p>
          <p className="mt-4 text-sm">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
          <a className="mt-6 inline-flex rounded-full bg-cocoa px-5 py-3 text-cream" href={`/api/calendario/${done.token}`}>
            Aggiungi al calendario
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-rose">VC Hair Studio</p>
        <h1 className="mt-3 max-w-xl font-display text-5xl leading-tight text-cocoa sm:text-6xl">
          Concediti un momento tutto per te.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8">
          La bellezza dei tuoi capelli inizia da qui. Scegli il trattamento che desideri e prenota il tuo prossimo appuntamento.
        </p>
      </div>
      <div className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow)] sm:p-7">
        <ol className="mb-6 flex gap-2 text-xs uppercase tracking-wider text-ink/60">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? "text-cocoa" : ""}>
              {label}
            </li>
          ))}
        </ol>
        {!state ? <div className="h-48 animate-pulse rounded-3xl bg-blush-soft" role="status">Caricamento in corso.</div> : null}
        {state && !state.configurato ? (
          <p>Le prenotazioni online saranno disponibili al termine della configurazione del salone.</p>
        ) : null}
        {state?.configurato && !state.prenotazioniAttive ? (
          <p className="mb-4 rounded-2xl bg-blush-soft p-3 text-sm">Le prenotazioni online non sono ancora attive.</p>
        ) : null}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && state?.configurato ? (
              <div>
                <h2 className="font-display text-3xl">Come possiamo prenderci cura dei tuoi capelli?</h2>
                <div className="mt-4 grid gap-3">
                  {state.servizi.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setServiceId(item.id);
                        setDay(null);
                        setSlot(null);
                        setStep(1);
                        remember(1);
                      }}
                      className="rounded-3xl border border-line p-4 text-left transition hover:-translate-y-0.5 hover:border-rose hover:bg-blush-soft"
                      style={{ borderColor: serviceId === item.id ? item.colore : undefined }}
                    >
                      <span className="font-display text-2xl">{item.nome}</span>
                      <span className="mt-1 block text-sm leading-6">{item.descrizione}</span>
                      <span className="mt-2 block text-sm text-cocoa">
                        {formatDuration(item.durataMinuti)} · {formatPrice(item.prezzoCentesimi)}
                      </span>
                    </button>
                  ))}
                  {state.servizi.length === 0 ? <p>Nessun trattamento è al momento prenotabile.</p> : null}
                </div>
              </div>
            ) : null}
            {step === 1 ? (
              <div>
                <h2 className="font-display text-3xl">Scegli il giorno che preferisci</h2>
                <div className="mt-4 flex items-center justify-between">
                  <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mese precedente">←</button>
                  <p className="capitalize">{monthLabel(month)}</p>
                  <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mese successivo">→</button>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm">
                  {["L", "M", "M", "G", "V", "S", "D"].map((label, index) => (
                    <span key={`${label}-${index}`} className="py-2 text-ink/50">{label}</span>
                  ))}
                  {calendar.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={!cell.date || !cell.available}
                      onClick={() => {
                        if (!cell.date) return;
                        setDay(cell.date);
                        setSlot(null);
                        setStep(2);
                      }}
                      className={`rounded-full py-2 ${cell.date === day ? "bg-cocoa text-cream" : ""} ${cell.available ? "hover:bg-blush-soft" : "text-ink/25"}`}
                    >
                      {cell.label}
                    </button>
                  ))}
                </div>
                <button className="mt-4 text-sm underline" type="button" onClick={() => setStep(0)}>Torna ai trattamenti</button>
              </div>
            ) : null}
            {step === 2 ? (
              <div>
                <h2 className="font-display text-3xl">Seleziona l&apos;orario più comodo per te</h2>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((item) => (
                    <button
                      key={item.inizio}
                      type="button"
                      onClick={() => {
                        setSlot(item.inizio);
                        setStep(3);
                        remember(3);
                      }}
                      className="rounded-full border border-line py-2 hover:border-rose hover:bg-blush-soft"
                    >
                      {item.etichetta}
                    </button>
                  ))}
                </div>
                {slots.length === 0 ? (
                  <p className="mt-4">Non ci sono orari disponibili per questa giornata. Ti invitiamo a scegliere un&apos;altra data.</p>
                ) : null}
                <button className="mt-4 text-sm underline" type="button" onClick={() => setStep(1)}>Cambia giorno</button>
              </div>
            ) : null}
            {step === 3 && service && slot ? (
              <div>
                <h2 className="font-display text-3xl">Riepilogo</h2>
                <p className="mt-3">{service.nome}</p>
                <p>{formatDate(new Date(slot))} alle {formatTime(new Date(slot))}</p>
                <p>{formatDuration(service.durataMinuti)}</p>
                <p>{formatPrice(service.prezzoCentesimi)}</p>
                <p className="mt-3 text-sm">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
                <button
                  className="mt-6 w-full rounded-full bg-cocoa px-5 py-3 text-cream disabled:opacity-60"
                  type="button"
                  disabled={busy || !state?.prenotazioniAttive}
                  onClick={() => void confirm()}
                >
                  {session ? "Conferma appuntamento" : "Accedi per confermare"}
                </button>
                <button className="mt-3 text-sm underline" type="button" onClick={() => setStep(2)}>Cambia orario</button>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonth(month: string, available: string[], selected: string | null) {
  if (!month) return [];
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: { key: string; label: string; date: string | null; available: boolean }[] = [];
  for (let index = 0; index < startPad; index += 1) cells.push({ key: `e-${index}`, label: "", date: null, available: false });
  for (let day = 1; day <= days; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    cells.push({ key: date, label: String(day), date, available: available.includes(date) || date === selected });
  }
  return cells;
}
