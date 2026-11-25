"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, Check, Clock, Euro, MapPin, MessageCircle, Navigation, Phone, Trash2, UserRound, X } from "lucide-react";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import { appleMapsUrl, googleMapsUrl } from "@/lib/maps";
import { ServiceArt } from "@/components/ui/service-icon";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Person = { first_name?: string; last_name?: string; phone?: string | null; address?: string | null };
type Service = { name?: string; color?: string };

export type AgendaAppointment = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents?: number | null;
  notes?: string | null;
  customers: Person | Person[] | null;
  services: Service | Service[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export const statusLabels: Record<string, string> = {
  pending: "Da confermare",
  confirmed: "Confermato",
  in_progress: "In corso",
  completed: "Completato",
  no_show: "Non presentata",
  cancelled: "Annullato",
};

const statusClass: Record<string, string> = {
  pending: "is-pending",
  confirmed: "is-confirmed",
  in_progress: "is-confirmed",
  completed: "is-completed",
  no_show: "is-cancelled",
  cancelled: "is-cancelled",
};

function toLocalInput(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Dettaglio di un appuntamento dell'agenda: dati, stato, spostamento ed eliminazione. */
export function AppointmentSheet({
  appointment,
  onClose,
  onChanged,
}: {
  appointment: AgendaAppointment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState(appointment.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState(toLocalInput(appointment.starts_at));
  const [ask, setAsk] = useState<null | "annulla" | "elimina" | "rifiuta">(null);
  const customer = one(appointment.customers);
  const service = one(appointment.services);
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  const name = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Cliente";
  const digits = (customer?.phone ?? "").replace(/\D/g, "");
  const whatsapp = digits ? `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}` : "";

  async function patch(body: object, label: string) {
    setBusy(label);
    const response = await fetch("/api/admin/agenda", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: appointment.id, ...body }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      toast.error(result.errore ?? "Operazione non riuscita.");
      return false;
    }
    onChanged();
    return true;
  }

  async function changeStatus(next: string) {
    if (next === status) return;
    if (await patch({ stato: next }, next)) {
      setStatus(next);
      toast.success(
        status === "pending"
          ? next === "confirmed" ? "Prenotazione accettata: la cliente è stata avvisata." : "Richiesta rifiutata: la cliente è stata avvisata."
          : next === "cancelled" ? "Appuntamento annullato: la cliente è stata avvisata." : `Stato: ${statusLabels[next]}.`,
      );
      // Dopo accetta, rifiuta o annulla la finestra si chiude; per gli altri stati resta aperta.
      if (status === "pending" || next === "cancelled") onClose();
    }
  }

  async function move() {
    const date = new Date(moveTo);
    if (Number.isNaN(date.getTime())) return toast.error("Data o ora non valida.");
    if (await patch({ inizio: date.toISOString() }, "sposta")) {
      toast.success("Appuntamento spostato: la cliente è stata avvisata.");
      onClose();
    }
  }

  async function remove() {
    setBusy("elimina");
    const response = await fetch(`/api/admin/agenda?id=${appointment.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return toast.error(result.errore ?? "Eliminazione non riuscita.");
    toast.success("Appuntamento eliminato.");
    onChanged();
    onClose();
  }

  return (
    <>
      <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={onClose} />
      <div className="sheet-panel appointment-sheet" role="dialog" aria-modal="true" aria-labelledby="dettaglio-titolo">
        <div className="sheet-handle" />
        <button className="icon-btn is-soft" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <span className="pick-thumb" style={{ flexBasis: 60, height: 60 }}><ServiceArt name={service?.name ?? ""} compact /></span>
          <div className="min-w-0">
            <h2 id="dettaglio-titolo" className="m-0 truncate">{service?.name ?? "Trattamento"}</h2>
            <span className={`status-pill mt-1 ${statusClass[status] ?? ""}`}>{statusLabels[status] ?? status}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="summary-row">
            <span className="tile-icon" style={{ width: 36, height: 36 }}><UserRound size={17} /></span>
            <span className="grow"><small>Cliente</small>{name}</span>
            {customer?.phone ? <a className="icon-btn is-soft" style={{ width: 36, height: 36 }} href={`tel:${customer.phone}`} aria-label="Chiama"><Phone size={15} /></a> : null}
            {whatsapp ? <a className="icon-btn is-soft" style={{ width: 36, height: 36 }} href={whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={15} /></a> : null}
          </div>
          <div className="summary-row">
            <span className="tile-icon" style={{ width: 36, height: 36 }}><Clock size={17} /></span>
            <span className="grow first-letter:uppercase"><small>Quando</small>{formatDateLong(start)}, {formatTime(start)}–{formatTime(end)}</span>
          </div>
          {customer?.address ? (
            <div className="summary-row">
              <span className="tile-icon" style={{ width: 36, height: 36 }}><MapPin size={17} /></span>
              <span className="grow"><small>Indirizzo</small>{customer.address}</span>
              <a className="icon-btn is-soft" style={{ width: 36, height: 36 }} href={appleMapsUrl(customer.address)} target="_blank" rel="noreferrer" aria-label="Itinerario con Apple Mappe"><Navigation size={15} /></a>
              <a className="icon-btn is-soft" style={{ width: 36, height: 36 }} href={googleMapsUrl(customer.address)} target="_blank" rel="noreferrer" aria-label="Itinerario con Google Maps"><MapPin size={15} /></a>
            </div>
          ) : null}
          <div className="summary-row">
            <span className="tile-icon" style={{ width: 36, height: 36 }}><Euro size={17} /></span>
            <span className="grow"><small>Prezzo · codice</small>{appointment.price_cents == null ? "Da concordare" : formatPrice(appointment.price_cents)} · {appointment.code}</span>
          </div>
          {appointment.notes ? <p className="card-soft m-0 mt-2 text-sm">{appointment.notes}</p> : null}
        </div>

        {status === "pending" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-primary" type="button" disabled={busy !== null} onClick={() => void changeStatus("confirmed")}><Check size={17} /> Accetta</button>
            <button className="btn btn-danger" type="button" disabled={busy !== null} onClick={() => setAsk("rifiuta")}><X size={17} /> Rifiuta</button>
          </div>
        ) : (
          <>
            <p className="eyebrow mt-5">Cambia stato</p>
            <div className="status-grid mt-2">
              {(["confirmed", "in_progress", "completed", "no_show", "cancelled"] as const).map((value) => (
                <button key={value} type="button" disabled={busy !== null} className={`chip ${status === value ? "is-on" : ""}`} onClick={() => (value === "cancelled" && status !== "cancelled" ? setAsk("annulla") : void changeStatus(value))}>
                  {statusLabels[value]}
                </button>
              ))}
            </div>
          </>
        )}

        {status !== "cancelled" ? (
          <>
            <p className="eyebrow mt-5">Sposta</p>
            <div className="mt-2 flex gap-2">
              <input type="datetime-local" value={moveTo} onChange={(event) => setMoveTo(event.target.value)} aria-label="Nuova data e ora" className="min-h-[46px] flex-1 rounded-2xl bg-field px-3" />
              <button className="btn btn-soft flex-none" type="button" disabled={busy !== null || moveTo === toLocalInput(appointment.starts_at)} onClick={() => void move()}>
                <CalendarClock size={16} /> Sposta
              </button>
            </div>
          </>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          {status !== "pending" && status !== "cancelled" ? (
            <a className="btn btn-white btn-sm" href={`/api/admin/evento/${appointment.id}`} style={{ boxShadow: "inset 0 0 0 1.5px var(--line)" }}>
              <CalendarPlus size={15} /> Nel mio calendario
            </a>
          ) : <span />}
          <button className="btn btn-danger btn-sm" type="button" disabled={busy !== null} onClick={() => setAsk("elimina")}>
            <Trash2 size={15} /> {busy === "elimina" ? "Elimino…" : "Elimina"}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={ask !== null}
        tone="danger"
        icon={ask === "elimina" ? <Trash2 size={28} /> : <X size={30} />}
        title={ask === "elimina" ? "Eliminare l'appuntamento?" : ask === "rifiuta" ? "Rifiutare la richiesta?" : "Annullare l'appuntamento?"}
        message={
          ask === "elimina"
            ? "Sparirà dall'agenda. Se è nel futuro, la cliente riceverà un avviso di annullamento."
            : ask === "rifiuta"
              ? `${name} riceverà una notifica e potrà scegliere un altro orario.`
              : `${name} riceverà una notifica di annullamento.`
        }
        confirmLabel={ask === "elimina" ? "Elimina" : ask === "rifiuta" ? "Rifiuta" : "Annulla appuntamento"}
        cancelLabel="Indietro"
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          const action = ask;
          setAsk(null);
          if (action === "elimina") await remove();
          else await changeStatus("cancelled");
        }}
      />
    </>
  );
}
