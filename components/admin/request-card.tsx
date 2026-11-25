"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Clock, MapPin, Navigation, Phone, X } from "lucide-react";
import { appleMapsUrl, googleMapsUrl } from "@/lib/maps";
import { formatPrice, formatTime } from "@/lib/format";
import { ServiceArt } from "@/components/ui/service-icon";

export type Request = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number | null;
  customers: { first_name?: string; last_name?: string; phone?: string | null; email?: string | null; address?: string | null } | { first_name?: string; last_name?: string; phone?: string | null; email?: string | null; address?: string | null }[] | null;
  services: { name?: string; duration_minutes?: number } | { name?: string; duration_minutes?: number }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Card di una richiesta online con i pulsanti Accetta / Rifiuta. */
export function RequestCard({ request, onDone }: { request: Request; onDone?: (status: "confirmed" | "cancelled") => void }) {
  const [busy, setBusy] = useState<"si" | "no" | null>(null);
  const [status, setStatus] = useState(request.status);
  const customer = one(request.customers);
  const service = one(request.services);
  const start = new Date(request.starts_at);
  const minutes = Math.round((new Date(request.ends_at).getTime() - start.getTime()) / 60000);
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(start);

  async function decide(accept: boolean) {
    if (!accept && !confirm("Rifiutare la richiesta? La cliente riceverà una notifica e potrà scegliere un altro orario.")) return;
    setBusy(accept ? "si" : "no");
    const response = await fetch("/api/admin/richieste", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: request.id, accetta: accept }),
    });
    const body = await response.json();
    setBusy(null);
    if (!response.ok) {
      toast.error(body.errore);
      return;
    }
    const next = accept ? "confirmed" : "cancelled";
    setStatus(next);
    toast.success(accept ? "Prenotazione accettata: la cliente è stata avvisata." : "Richiesta rifiutata: la cliente è stata avvisata.");
    onDone?.(next);
  }

  return (
    <article className="salon-card" style={{ cursor: "default" }}>
      <div className="flex gap-3">
        <span className="pick-thumb" style={{ flexBasis: 72, height: 72 }}><ServiceArt name={service?.name ?? ""} compact /></span>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="m-0 text-base">{service?.name ?? "Trattamento"}</h3>
            <span className={`status-pill ${status === "pending" ? "is-pending" : status === "confirmed" ? "is-completed" : "is-cancelled"}`}>
              {status === "pending" ? "Da confermare" : status === "confirmed" ? "Accettata" : "Rifiutata"}
            </span>
          </div>
          <p className="m-0 mt-1 text-[13px] font-medium">{customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "Cliente"}</p>
          <p className="m-0 mt-0.5 flex items-center gap-1 text-[13px] text-[#3d3b47]">
            <Clock size={13} className="flex-none" /> <span className="first-letter:uppercase">{day}</span> · {formatTime(start)} · {minutes} min
          </p>
          {customer?.address ? (
            <p className="m-0 mt-0.5 flex items-center gap-1 text-[13px] text-[#3d3b47]"><MapPin size={13} /> {customer.address}</p>
          ) : null}
          <p className="m-0 mt-0.5 text-[13px] font-semibold">{request.price_cents == null ? "Prezzo da concordare" : formatPrice(request.price_cents)}</p>
        </div>
      </div>
      {customer?.address ? (
        <div className="mt-3 grid grid-cols-2 gap-2 px-1">
          <a className="btn btn-white btn-xs" href={appleMapsUrl(customer.address)} target="_blank" rel="noreferrer"><Navigation size={13} /> Apple Mappe</a>
          <a className="btn btn-white btn-xs" href={googleMapsUrl(customer.address)} target="_blank" rel="noreferrer"><MapPin size={13} /> Google Maps</a>
        </div>
      ) : null}
      {status === "confirmed" ? (
        <div className="mt-3 px-1 pb-1">
          <a className="btn btn-soft btn-sm w-full" href={`/api/admin/evento/${request.id}`}>
            <CalendarPlus size={16} /> Aggiungi al mio calendario
          </a>
        </div>
      ) : null}
      {status === "pending" ? (
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2 px-1 pb-1">
          <button className="btn btn-primary btn-sm" type="button" disabled={busy !== null} onClick={() => void decide(true)}>
            <Check size={16} /> {busy === "si" ? "…" : "Accetta"}
          </button>
          <button className="btn btn-danger btn-sm" type="button" disabled={busy !== null} onClick={() => void decide(false)}>
            <X size={16} /> {busy === "no" ? "…" : "Rifiuta"}
          </button>
          {customer?.phone ? (
            <a className="icon-btn is-white" style={{ width: 36, height: 36 }} href={`tel:${customer.phone}`} aria-label="Chiama la cliente"><Phone size={15} /></a>
          ) : <span />}
        </div>
      ) : null}
    </article>
  );
}
