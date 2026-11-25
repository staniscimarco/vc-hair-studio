"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Bell, BellRing, CalendarDays, CalendarPlus, Check, CheckCircle2, Clock, Euro, UserRound } from "lucide-react";
import { formatDateLong, formatTime } from "@/lib/format";
import { HeroIconLink, SectionHead, TitleHero } from "@/components/ui/app-header";
import { ServiceArt, ServiceIcon, shortDuration } from "@/components/ui/service-icon";
import { QuickAuth } from "@/components/auth/quick-auth";
import { Price, type PublicPromo } from "@/components/ui/price";
import { enablePush, pushSupported } from "@/lib/push-client";

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
  approvazione?: boolean;
  promozione?: PublicPromo | null;
};

type Step = 0 | 1 | 2 | 3;

const DRAFT = "vc-bozza-prenotazione";
const STEPS = ["Servizio", "Data", "Accesso", "Conferma"];

export function BookingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<State | null>(null);
  const [step, setStep] = useState<Step>(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [daysReady, setDaysReady] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ inizio: string; etichetta: string }[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [session, setSession] = useState<{ ok: boolean; nome: string } | null>(null);
  const [done, setDone] = useState<{ codice: string; token: string; inizio: string; stato: string } | null>(null);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedDay, setLoadedDay] = useState<string | null>(null);
  const [restored, setRestored] = useState<Step | null>(null);

  const service = state?.servizi.find((item) => item.id === serviceId) ?? null;
  const horizon = useMemo(() => nextDays(28), []);

  useEffect(() => {
    let target: Step = 0;
    const raw = sessionStorage.getItem(DRAFT);
    if (raw) {
      const draft = JSON.parse(raw) as { serviceId?: string; day?: string; slot?: string };
      if (draft.serviceId) {
        setServiceId(draft.serviceId);
        target = 1;
      }
      if (draft.day) {
        setDay(draft.day);
      }
      if (draft.slot && draft.serviceId) {
        setSlot(draft.slot);
        target = 2;
      }
    }
    const servizio = params.get("servizio");
    const giorno = params.get("giorno");
    if (servizio) {
      setServiceId(servizio);
      target = Math.max(target, 1) as Step;
    }
    if (giorno) {
      setDay(giorno);
    }
    setRestored(target);
    void fetch("/api/stato").then((response) => response.json()).then(setState).catch(() => setState({ configurato: false, prenotazioniAttive: false, servizi: [] }));
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((body) => setSession({ ok: Boolean(body.autenticato), nome: body.nome ?? "" }))
      .catch(() => setSession({ ok: false, nome: "" }));
  }, [params]);

  // Riprende la prenotazione dal punto giusto (anche al ritorno da Google o dalla conferma e-mail).
  useEffect(() => {
    if (restored === null || session === null) return;
    setStep(restored === 2 && session.ok ? 3 : restored);
    setRestored(null);
  }, [restored, session]);

  // Giorni prenotabili di tutti i mesi coperti dal calendario: gli altri non si possono scegliere.
  useEffect(() => {
    if (!serviceId) return;
    setDaysReady(false);
    const months = [...new Set(horizon.map((item) => item.iso.slice(0, 7)))];
    void Promise.all(
      months.map((value) =>
        fetch(`/api/disponibilita?servizio=${serviceId}&mese=${value}`)
          .then((response) => response.json())
          .then((body) => (body.giorni ?? []) as string[])
          .catch(() => [] as string[]),
      ),
    ).then((lists) => {
      setDays(lists.flat());
      setDaysReady(true);
    });
  }, [serviceId, horizon]);

  // Se il giorno scelto non è più disponibile (chiuso o bloccato), lo deseleziona.
  useEffect(() => {
    if (daysReady && day && !days.includes(day)) {
      setDay(null);
      setSlot(null);
    }
  }, [daysReady, day, days]);

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

  function remember(next: { serviceId?: string | null; day?: string | null; slot?: string | null }) {
    sessionStorage.setItem(
      DRAFT,
      JSON.stringify({
        serviceId: next.serviceId === undefined ? serviceId : next.serviceId,
        day: next.day === undefined ? day : next.day,
        slot: next.slot === undefined ? slot : next.slot,
      }),
    );
  }

  function go(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pickService(id: string) {
    setServiceId(id);
    setSlot(null);
    remember({ serviceId: id, slot: null });
    go(1);
  }

  function back() {
    if (step === 0) {
      router.push("/");
      return;
    }
    if (step === 3 && session?.ok) go(1);
    else go((step - 1) as Step);
  }

  async function confirm() {
    if (!service || !slot) return;
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
      if (response.status === 401) {
        setSession({ ok: false, nome: "" });
        go(2);
        return;
      }
      toast.error(body.errore || "Non è stato possibile confermare.");
      setSlot(null);
      go(1);
      return;
    }
    sessionStorage.removeItem(DRAFT);
    sessionStorage.removeItem("vc-idempotenza");
    setDone({ codice: body.codice, token: body.token, inizio: body.inizio, stato: body.stato ?? "confirmed" });
    toast.success(body.stato === "pending" ? "Richiesta inviata al salone!" : "Il tuo appuntamento è confermato!");
  }

  if (done && service) {
    return (
      <div className="app-screen">
        <TitleHero
          title={done.stato === "pending" ? "Richiesta inviata" : "Prenotazione confermata"}
          back="/"
          subtitle={done.stato === "pending" ? "Il salone ti risponderà al più presto." : "Ti aspettiamo per prenderci cura dei tuoi capelli."}
        />
        <section className="mx-auto mt-8 grid max-w-xl justify-items-center gap-3 text-center">
          <span className="tile-icon is-primary" style={{ width: 76, height: 76 }}><CheckCircle2 size={36} /></span>
          <h2 className="m-0 text-2xl">{done.stato === "pending" ? "Quasi fatto! 💜" : "Il tuo appuntamento è confermato!"}</h2>
          <p className="m-0 text-sm leading-6 text-muted">
            {done.stato === "pending"
              ? "Abbiamo ricevuto la tua richiesta e l'orario è riservato per te. Appena il salone la conferma ricevi una notifica."
              : "Ti aspettiamo per prenderci cura dei tuoi capelli e regalarti un momento di bellezza."}
          </p>
          {done.stato === "pending" && pushSupported() && !pushOn ? (
            <button className="btn btn-accent btn-block" type="button" onClick={async () => {
              const result = await enablePush("customer");
              if (result.ok) {
                setPushOn(true);
                toast.success("Ti avviseremo appena il salone risponde.");
              } else toast.error(result.motivo ?? "Notifiche non attivate.");
            }}><BellRing size={18} /> Avvisami quando confermano</button>
          ) : null}
          <article className="pick-card mt-4 w-full text-left" style={{ cursor: "default" }}>
            <span className="pick-thumb"><ServiceArt name={service.nome} compact /></span>
            <div className="pick-main">
              <h3>{service.nome}</h3>
              <p>{capitalize(formatDateLong(new Date(done.inizio)))} · {formatTime(new Date(done.inizio))}</p>
              <div className="pick-meta"><span className="rating-pill">Codice {done.codice}</span></div>
            </div>
          </article>
          <p className="note">Il pagamento verrà effettuato direttamente in salone al termine del trattamento.</p>
          {done.stato !== "pending" ? (
            <a className="btn btn-primary btn-block" href={`/api/calendario/${done.token}`}><CalendarPlus size={18} /> Aggiungi al calendario</a>
          ) : null}
          <Link className="btn btn-soft btn-block" href="/i-miei-appuntamenti">I miei appuntamenti</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-screen">
      <TitleHero
        title="Prenota"
        back={back}
        action={
          <HeroIconLink href="/i-miei-appuntamenti" label="I miei appuntamenti" tone="white" dot>
            <Bell size={20} strokeWidth={2} />
          </HeroIconLink>
        }
      >
        <ol className="stepper m-0 p-0" aria-label="Passaggi della prenotazione">
          {STEPS.map((label, index) => (
            <li key={label} className={index < step ? "is-done" : index === step ? "is-on" : ""} aria-current={index === step ? "step" : undefined}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </TitleHero>

      {state && !state.configurato ? <div className="warning-box mt-5">Le prenotazioni online apriranno a breve: intanto puoi scoprire trattamenti e orari.</div> : null}

      <div className="wizard-body mx-auto max-w-3xl">
        {step === 0 ? (
          <section aria-labelledby="passo-trattamento">
            <SectionHead id="passo-trattamento" title="Cosa ti va oggi?" subtitle="Come possiamo prenderci cura dei tuoi capelli? Al resto pensiamo noi." />
            {!state ? (
              <div className="grid gap-3" role="status" aria-label="Caricamento in corso">
                {[0, 1, 2].map((index) => <div key={index} className="skeleton" style={{ height: 92 }} />)}
              </div>
            ) : null}
            {state && state.servizi.length === 0 ? <div className="empty-state">Nessun trattamento disponibile.</div> : null}
            <div className="grid gap-3">
              {(state?.servizi ?? []).map((item, index) => {
                const on = serviceId === item.id;
                return (
                  <button key={item.id} type="button" aria-pressed={on} className={`pick-card ${on ? "is-on" : ""}`} onClick={() => pickService(item.id)}>
                    <span className="pick-thumb"><ServiceArt name={item.nome} tone={index} compact /></span>
                    <span className="pick-main">
                      <h3>{item.nome}</h3>
                      <p>{item.descrizione}</p>
                      <span className="pick-meta">
                        <Price cents={item.prezzoCentesimi} promo={state?.promozione} serviceId={item.id} className="font-bold" />
                        <span className="rating-pill"><Clock size={11} strokeWidth={2.4} style={{ fill: "none", color: "#fff" }} />{shortDuration(item.durataMinuti)}</span>
                      </span>
                    </span>
                    <span className="round-arrow" aria-hidden style={on ? { background: "var(--primary)" } : undefined}>
                      {on ? <Check size={16} strokeWidth={2.6} /> : <ArrowRight size={16} strokeWidth={2.2} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section aria-labelledby="passo-giorno">
            {service ? (
              <div className="pick-card mt-5" style={{ cursor: "default" }}>
                <span className="pick-thumb" style={{ flexBasis: 56, height: 56 }}><ServiceArt name={service.nome} compact /></span>
                <span className="pick-main">
                  <h3>{service.nome}</h3>
                  <p>{shortDuration(service.durataMinuti)} · <Price cents={service.prezzoCentesimi} promo={state?.promozione} serviceId={service.id} /></p>
                </span>
                <button type="button" className="btn btn-white btn-xs" onClick={() => go(0)}>Cambia</button>
              </div>
            ) : null}
            <SectionHead id="passo-giorno" title="Scegli il giorno" subtitle="I giorni chiari sono già pieni o chiusi: i migliori vanno via in fretta!" />
            <div className="date-strip" role="listbox" aria-label="Giorni disponibili">
              {horizon.map((item) => (
                <button
                  key={item.iso}
                  type="button"
                  className={`date-chip ${day === item.iso ? "is-on" : ""} ${serviceId && days.includes(item.iso) ? "has-slot" : ""}`}
                  aria-pressed={day === item.iso}
                  disabled={!daysReady || !days.includes(item.iso)}
                  title={daysReady && !days.includes(item.iso) ? "Nessun orario disponibile" : undefined}
                  onClick={() => {
                    setDay(item.iso);
                    setSlot(null);
                    remember({ day: item.iso, slot: null });
                  }}
                >
                  <small>{item.weekday}</small>
                  <strong>{item.number}</strong>
                </button>
              ))}
            </div>

            <SectionHead title="Scegli l'orario" subtitle="Quello più comodo per te: lo teniamo riservato." />
            {!day ? <div className="empty-state"><span className="tile-icon"><CalendarDays size={20} /></span>Scegli prima il giorno.</div> : null}
            {day && loadedDay !== day ? <div className="time-grid">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 44 }} />)}</div> : null}
            {day && loadedDay === day && slots.length === 0 ? (
              <div className="empty-state">Non ci sono orari disponibili per questa giornata. Ti invitiamo a scegliere un&apos;altra data.</div>
            ) : null}
            {day && loadedDay === day ? (
              <div className="time-grid">
                {slots.map((item) => (
                  <button
                    key={item.inizio}
                    type="button"
                    className={`time-chip ${slot === item.inizio ? "is-on" : ""}`}
                    onClick={() => {
                      setSlot(item.inizio);
                      remember({ slot: item.inizio });
                    }}
                  >
                    {item.etichetta}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="wizard-bar">
              <button className="btn btn-soft" type="button" onClick={back}>Indietro</button>
              <button className="btn btn-primary" type="button" disabled={!slot} onClick={() => go(session?.ok ? 3 : 2)}>
                Continua <ArrowRight size={18} />
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section aria-labelledby="passo-dati">
            <SectionHead id="passo-dati" title="Ultimo passo: chi sei?" subtitle="Ci serve solo per ricordarti l'appuntamento. Bastano pochi secondi, con Google anche meno." />
            <div className="card">
              <QuickAuth
                next="/prenota"
                onDone={(nome) => {
                  setSession({ ok: true, nome });
                  go(3);
                }}
              />
            </div>
            <button className="btn btn-soft btn-block mt-4" type="button" onClick={back}>Indietro</button>
          </section>
        ) : null}

        {step === 3 && service && slot ? (
          <section aria-labelledby="passo-conferma">
            <SectionHead id="passo-conferma" title="Tutto pronto ✨" subtitle="Controlla i dettagli e conferma: il tuo momento di bellezza ti aspetta." />
            <div className="salon-card" style={{ cursor: "default" }}>
              <div className="salon-media" style={{ height: 150 }}><ServiceArt name={service.nome} /></div>
              <div className="px-2 pb-1 pt-2">
                <div className="summary-row">
                  <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><ServiceIcon name={service.nome} size={18} /></span>
                  <span className="grow"><small>Trattamento</small>{service.nome}</span>
                  <button type="button" className="btn btn-white btn-xs" onClick={() => go(0)}>Cambia</button>
                </div>
                <div className="summary-row">
                  <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><CalendarDays size={18} /></span>
                  <span className="grow"><small>Quando</small>{capitalize(formatDateLong(new Date(slot)))} alle {formatTime(new Date(slot))}</span>
                  <button type="button" className="btn btn-white btn-xs" onClick={() => go(1)}>Cambia</button>
                </div>
                <div className="summary-row">
                  <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><Clock size={18} /></span>
                  <span className="grow"><small>Durata</small>{shortDuration(service.durataMinuti)}</span>
                </div>
                <div className="summary-row">
                  <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><Euro size={18} /></span>
                  <span className="grow"><small>Prezzo</small><Price cents={service.prezzoCentesimi} promo={state?.promozione} serviceId={service.id} /></span>
                </div>
                {session?.nome ? (
                  <div className="summary-row">
                    <span className="tile-icon is-accent" style={{ width: 36, height: 36 }}><UserRound size={18} /></span>
                    <span className="grow"><small>A nome di</small>{session.nome}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="note mt-3">
              {state?.approvazione
                ? "Invii una richiesta: l'orario resta riservato per te e il salone ti conferma con una notifica. Paghi in salone, a fine trattamento."
                : "Il pagamento verrà effettuato direttamente in salone al termine del trattamento."}
            </p>
            {state && !state.prenotazioniAttive ? (
              <div className="warning-box mt-3">
                <AlertTriangle size={18} className="mt-0.5 flex-none" />
                <span>Le prenotazioni online non sono ancora attive. Riprova più tardi o contatta il salone.</span>
              </div>
            ) : null}
            <div className="wizard-bar">
              <button className="btn btn-soft" type="button" onClick={back}>Indietro</button>
              <button className="btn btn-primary" type="button" disabled={busy || !state?.prenotazioniAttive} onClick={() => void confirm()}>
                {busy ? "Attendere…" : state?.approvazione ? "Invia richiesta" : "Conferma"}
              </button>
            </div>
          </section>
        ) : null}
        {step === 3 && (!service || !slot) ? (
          <div className="empty-state mt-6">
            Scegli trattamento e orario per continuare.
            <button className="btn btn-primary btn-sm" type="button" onClick={() => go(service ? 1 : 0)}>Riprendi</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
