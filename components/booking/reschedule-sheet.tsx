"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, X } from "lucide-react";
import { formatDateLong, formatTime } from "@/lib/format";

type Slot = { inizio: string; etichetta: string };

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** La cliente sceglie un nuovo giorno e un orario libero per il suo appuntamento. */
export function RescheduleSheet({
  appointment,
  onClose,
  onDone,
}: {
  appointment: { id: string; serviceId: string; serviceName: string; startsAt: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const days = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + index);
        return date;
      }),
    [],
  );
  const [day, setDay] = useState(() => iso(new Date(appointment.startsAt)));
  const [free, setFree] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFree(null);
    setSlot(null);
    const params = new URLSearchParams({ servizio: appointment.serviceId, giorno: day, escludi: appointment.id });
    void fetch(`/api/disponibilita?${params}`)
      .then((response) => response.json())
      .then((body) => {
        setFree(body.orari ?? []);
        setBusy(body.occupati ?? []);
      })
      .catch(() => setFree([]));
  }, [appointment.id, appointment.serviceId, day]);

  async function save() {
    if (!slot) return;
    setSaving(true);
    const response = await fetch(`/api/prenotazioni/${appointment.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inizio: slot }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      toast.error(body.errore ?? "Non è stato possibile cambiare orario.");
      return;
    }
    const when = new Date(slot);
    toast.success(`Fatto! Nuovo orario: ${formatDateLong(when)} alle ${formatTime(when)}.`);
    onDone();
    onClose();
  }

  const merged = [...(free ?? []).map((item) => ({ ...item, busy: false })), ...busy.map((item) => ({ ...item, busy: true }))].sort((a, b) =>
    a.inizio.localeCompare(b.inizio),
  );

  return (
    <>
      <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={onClose} />
      <div className="sheet-panel appointment-sheet" role="dialog" aria-modal="true" aria-labelledby="sposta-titolo">
        <div className="sheet-handle" />
        <button className="icon-btn is-soft" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={onClose}>
          <X size={18} />
        </button>
        <p className="eyebrow">Cambia orario</p>
        <h2 id="sposta-titolo" className="pr-10">{appointment.serviceName}</h2>
        <p className="note m-0 mt-1 first-letter:uppercase">
          Ora: {formatDateLong(new Date(appointment.startsAt))} alle {formatTime(new Date(appointment.startsAt))}
        </p>

        <div className="date-strip mt-4">
          {days.map((date) => {
            const key = iso(date);
            return (
              <button key={key} type="button" className={`date-chip ${key === day ? "is-on" : ""}`} aria-pressed={key === day} onClick={() => setDay(key)}>
                <small>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", "")}</small>
                <strong>{date.getDate()}</strong>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          {free === null ? <div className="time-grid">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 44 }} />)}</div> : null}
          {free && merged.length === 0 ? <div className="empty-state">In questo giorno non ci sono orari: prova un altro giorno.</div> : null}
          {free && merged.length > 0 && free.length === 0 ? <div className="empty-state mb-3">Giornata al completo: prova un altro giorno.</div> : null}
          {free && merged.length > 0 ? (
            <div className="time-grid">
              {merged.map((item) =>
                item.busy ? (
                  <span key={item.inizio} className="time-chip is-busy" aria-disabled="true">
                    {item.etichetta}
                    <small>Occupato</small>
                  </span>
                ) : (
                  <button key={item.inizio} type="button" className={`time-chip ${slot === item.inizio ? "is-on" : ""}`} onClick={() => setSlot(item.inizio)}>
                    {item.etichetta}
                  </button>
                ),
              )}
            </div>
          ) : null}
        </div>

        <button className="btn btn-primary btn-block mt-5" type="button" disabled={!slot || saving} onClick={() => void save()}>
          <CalendarClock size={18} /> {saving ? "Salvataggio…" : "Conferma nuovo orario"}
        </button>
        <button className="btn btn-soft btn-block mt-2" type="button" onClick={onClose}>Lascia com&apos;è</button>
      </div>
    </>
  );
}
