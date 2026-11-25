"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Check, Clock, Euro, Search, UserPlus, UserRound, X } from "lucide-react";
import { TitleHero } from "@/components/ui/app-header";
import { ServiceArt, shortDuration } from "@/components/ui/service-icon";
import { AddressField } from "@/components/auth/address-field";
import { formatPrice } from "@/lib/format";
import { notifyLive } from "@/lib/live";

type Service = { id: string; name: string; duration_minutes: number; price_cents: number | null; active: boolean };
type Customer = { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; address?: string | null; archived_at: string | null; in_attesa?: boolean };

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextDays(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });
}

/** Appuntamento inserito dal salone (telefonate, messaggi, richieste in salone). */
export default function ManualAppointmentsPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState("");
  const [day, setDay] = useState(() => iso(new Date()));
  const [slots, setSlots] = useState<{ inizio: string; etichetta: string }[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const days = useMemo(() => nextDays(30), []);

  useEffect(() => {
    void fetch("/api/admin/servizi").then((response) => response.json()).then((body) => setServices(((body.servizi ?? []) as Service[]).filter((item) => item.active !== false)));
    void fetch("/api/admin/clienti").then((response) => response.json()).then((body) => setCustomers(((body.clienti ?? []) as Customer[]).filter((row) => !row.archived_at)));
    // Arrivando dall'agenda con un giorno/orario già scelto.
    const inizio = new URLSearchParams(window.location.search).get("inizio");
    if (inizio) {
      const date = new Date(inizio);
      if (!Number.isNaN(date.getTime())) {
        setDay(iso(date));
        if (inizio.includes("T") && !inizio.endsWith("T09:00")) {
          setManualTime(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
        }
      }
    }
  }, []);

  // Orari liberi per il trattamento, la durata e il giorno scelti.
  useEffect(() => {
    if (!service || !day) return;
    setSlots(null);
    setSlot(null);
    const params = new URLSearchParams({ servizio: service.id, giorno: day, durata: String(duration) });
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/orari-liberi?${params}`)
        .then((response) => response.json())
        .then((body) => setSlots(body.orari ?? []))
        .catch(() => setSlots([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [service, day, duration]);

  function pickService(item: Service) {
    setService(item);
    setDuration(item.duration_minutes);
    setPrice(item.price_cents == null ? "" : (item.price_cents / 100).toFixed(2).replace(".", ","));
  }

  const query = search.trim().toLowerCase();
  const matches = (customers ?? [])
    .filter((row) => `${row.first_name} ${row.last_name} ${row.phone ?? ""} ${row.email ?? ""}`.toLowerCase().includes(query))
    .slice(0, query ? 30 : 8);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    if (!customer && !newCustomer) return setError("Scegli la cliente oppure crea una nuova scheda.");
    if (!service) return setError("Scegli il trattamento.");
    let start: Date | null = null;
    if (manualTime) start = new Date(`${day}T${manualTime}:00`);
    else if (slot) start = new Date(slot);
    if (!start || Number.isNaN(start.getTime())) return setError("Scegli un orario libero oppure inserisci l'orario a mano.");
    const cents = price.trim() === "" ? null : Math.round(Number(price.replace(",", ".")) * 100);
    if (cents != null && (Number.isNaN(cents) || cents < 0)) return setError("Il prezzo non è valido.");
    const nuovo = newCustomer
      ? {
          nome: String(form.get("nome") ?? "").trim(),
          cognome: String(form.get("cognome") ?? "").trim(),
          telefono: String(form.get("telefono") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          indirizzo: String(form.get("indirizzo") ?? "").trim(),
        }
      : null;
    if (nuovo && (nuovo.nome.length < 2 || nuovo.cognome.length < 2)) return setError("Inserisci nome e cognome della nuova cliente.");

    setBusy(true);
    const response = await fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clienteId: newCustomer ? null : customer?.id,
        nuovoCliente: nuovo,
        servizioId: service.id,
        inizio: start.toISOString(),
        durataMinuti: duration,
        prezzoCentesimi: cents,
        note: notes,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(body.errore ?? "Non è stato possibile inserire l'appuntamento.");
    toast.success("Appuntamento inserito in agenda.");
    notifyLive();
    router.push(`/admin/calendario?date=${day}`);
  }

  return (
    <section>
      <TitleHero title="Nuovo appuntamento" back="/admin/calendario" subtitle="Per telefonate, messaggi o richieste in salone. La cliente non deve registrarsi." />

      <form className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start" onSubmit={(event) => void submit(event)} noValidate>
        {/* 1. Cliente */}
        <div className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon"><UserRound size={20} /></span>
            <h2>1. Cliente</h2>
          </div>

          {customer ? (
            <div className="pick-card is-on" style={{ cursor: "default", padding: 12 }}>
              <span className="tile-icon is-primary" style={{ fontWeight: 700 }}>{`${customer.first_name.charAt(0)}${customer.last_name.charAt(0)}`.toUpperCase()}</span>
              <span className="pick-main">
                <h3>{customer.first_name} {customer.last_name}</h3>
                <p>{[customer.phone, customer.address].filter(Boolean).join(" · ") || customer.email || "Nessun contatto"}</p>
              </span>
              <button type="button" className="icon-btn is-soft" style={{ width: 36, height: 36 }} aria-label="Cambia cliente" onClick={() => setCustomer(null)}>
                <X size={16} />
              </button>
            </div>
          ) : newCustomer ? (
            <div className="grid gap-3 rounded-2xl bg-lavender-soft p-3">
              <div className="flex items-center justify-between">
                <strong className="text-sm">Nuova cliente senza account</strong>
                <button type="button" className="btn btn-white btn-xs" onClick={() => setNewCustomer(false)}>Annulla</button>
              </div>
              <div className="field-grid cols-2">
                <label className="field">Nome<input name="nome" autoComplete="off" /></label>
                <label className="field">Cognome<input name="cognome" autoComplete="off" /></label>
              </div>
              <div className="field-grid cols-2">
                <label className="field">Telefono<input name="telefono" type="tel" placeholder="Facoltativo" /></label>
                <label className="field">E-mail<input name="email" type="email" placeholder="Facoltativa" /></label>
              </div>
              <AddressField />
            </div>
          ) : (
            <>
              <label className="search-field" style={{ background: "var(--field)" }}>
                <Search size={18} aria-hidden />
                <input value={search} placeholder="Cerca per nome, telefono o e-mail" onChange={(event) => setSearch(event.target.value)} />
              </label>
              <button type="button" className="pick-card" style={{ padding: 10 }} onClick={() => setNewCustomer(true)}>
                <span className="tile-icon is-accent"><UserPlus size={18} /></span>
                <span className="pick-main"><h3>Nuova cliente</h3><p>Non ha un account: crea al volo la scheda</p></span>
              </button>
              <div className="customer-list">
                {customers === null ? <div className="skeleton" style={{ height: 120 }} /> : null}
                {customers && matches.length === 0 ? <p className="note m-0 p-2">Nessuna cliente trovata.</p> : null}
                {matches.map((row) => (
                  <button key={row.id} type="button" className="list-row" onClick={() => setCustomer(row)}>
                    <span className="tile-icon" style={{ fontWeight: 700, fontSize: 13 }}>{`${row.first_name.charAt(0)}${row.last_name.charAt(0)}`.toUpperCase()}</span>
                    <span className="grow">
                      {row.first_name} {row.last_name}
                      <small className="block text-xs font-normal text-muted">{row.phone || row.email || "Nessun contatto"}</small>
                    </span>
                    {row.in_attesa ? <span className="status-pill is-pending">Da approvare</span> : null}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 2. Trattamento, prezzo e durata */}
        <div className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon"><CalendarPlus size={20} /></span>
            <h2>2. Trattamento</h2>
          </div>
          <div className="grid gap-2">
            {services.map((item, index) => {
              const on = service?.id === item.id;
              return (
                <button key={item.id} type="button" className={`pick-card ${on ? "is-on" : ""}`} style={{ padding: 8 }} onClick={() => pickService(item)}>
                  <span className="pick-thumb" style={{ flexBasis: 52, height: 52 }}><ServiceArt name={item.name} tone={index} compact /></span>
                  <span className="pick-main">
                    <h3>{item.name}</h3>
                    <p>{shortDuration(item.duration_minutes)} · {item.price_cents == null ? "Prezzo da concordare" : formatPrice(item.price_cents)}</p>
                  </span>
                  {on ? <span className="round-arrow" style={{ background: "var(--primary)" }}><Check size={15} strokeWidth={2.6} /></span> : null}
                </button>
              );
            })}
          </div>
          {service ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="field">
                <span className="flex items-center gap-1"><Euro size={13} /> Prezzo</span>
                <input inputMode="decimal" value={price} placeholder="Da concordare" onChange={(event) => setPrice(event.target.value)} />
              </label>
              <label className="field">
                <span className="flex items-center gap-1"><Clock size={13} /> Durata</span>
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                  {Array.from({ length: 16 }, (_, index) => (index + 1) * 15).map((value) => (
                    <option key={value} value={value}>{shortDuration(value)}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {/* 3. Giorno e orario */}
        <div className="card grid gap-3 lg:col-span-2">
          <div className="card-title">
            <span className="tile-icon"><Clock size={20} /></span>
            <div>
              <h2>3. Giorno e orario</h2>
              <p className="note m-0">Ti mostriamo solo gli orari liberi. Se serve, puoi scrivere l&apos;orario a mano.</p>
            </div>
          </div>
          <div className="date-strip">
            {days.map((date) => {
              const key = iso(date);
              return (
                <button key={key} type="button" className={`date-chip ${key === day ? "is-on" : ""}`} aria-pressed={key === day} onClick={() => { setDay(key); setManualTime(""); }}>
                  <small>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", "")}</small>
                  <strong>{date.getDate()}</strong>
                </button>
              );
            })}
          </div>
          {!service ? <div className="empty-state">Scegli prima il trattamento per vedere gli orari liberi.</div> : null}
          {service && slots === null ? <div className="time-grid">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 44 }} />)}</div> : null}
          {service && slots && slots.length === 0 ? <div className="empty-state">Nessun orario libero in questo giorno per questa durata.</div> : null}
          {service && slots && slots.length ? (
            <div className="time-grid">
              {slots.map((item) => (
                <button key={item.inizio} type="button" className={`time-chip ${slot === item.inizio && !manualTime ? "is-on" : ""}`} onClick={() => { setSlot(item.inizio); setManualTime(""); }}>
                  {item.etichetta}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field">Oppure orario a mano<input type="time" value={manualTime} onChange={(event) => setManualTime(event.target.value)} /></label>
            <label className="field">Note interne<input value={notes} placeholder="Visibili solo al salone" onChange={(event) => setNotes(event.target.value)} /></label>
          </div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            <CalendarPlus size={18} /> {busy ? "Inserimento…" : "Inserisci appuntamento"}
          </button>
        </div>
      </form>
    </section>
  );
}
