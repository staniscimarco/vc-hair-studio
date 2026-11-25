"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarHeart, Copy, RefreshCw } from "lucide-react";

/** Collega l'agenda al Calendario dell'iPhone: le prenotazioni confermate compaiono da sole. */
export function CalendarSubscribe() {
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.host);
    void fetch("/api/admin/calendario-iphone")
      .then((response) => response.json())
      .then((body) => setToken(body.token ?? null))
      .catch(() => undefined);
  }, []);

  if (!token) return null;
  const https = `https://${origin}/api/feed/${token}.ics`;
  const webcal = `webcal://${origin}/api/feed/${token}.ics`;

  return (
    <div className="card grid gap-3">
      <div className="card-title">
        <span className="tile-icon is-accent"><CalendarHeart size={20} /></span>
        <div>
          <h2>Agenda nel Calendario dell&apos;iPhone</h2>
          <p className="note m-0">Ogni appuntamento confermato compare da solo, con nome della cliente e trattamento, e un promemoria 30 minuti prima.</p>
        </div>
      </div>
      <a className="btn btn-primary btn-block" href={webcal}>
        <CalendarHeart size={18} /> Collega al Calendario
      </a>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-soft btn-sm" type="button" onClick={async () => {
          try {
            await navigator.clipboard.writeText(https);
            toast.success("Link copiato: incollalo in Google Calendar o Outlook.");
          } catch {
            toast.error("Copia non riuscita.");
          }
        }}><Copy size={14} /> Copia link</button>
        <button className="btn btn-white btn-sm" type="button" onClick={async () => {
          if (!confirm("Rigenerare il link? Il calendario già collegato smetterà di aggiornarsi e andrà ricollegato.")) return;
          const response = await fetch("/api/admin/calendario-iphone", { method: "POST" });
          const body = await response.json();
          if (response.ok) {
            setToken(body.token);
            toast.success("Nuovo link creato.");
          } else toast.error(body.errore);
        }}><RefreshCw size={14} /> Rigenera</button>
      </div>
      <p className="note m-0">Il link è personale: non condividerlo. Sull&apos;iPhone il calendario si aggiorna ogni 15 minuti circa.</p>
    </div>
  );
}
