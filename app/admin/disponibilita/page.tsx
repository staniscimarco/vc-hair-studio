"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

const days = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export default function AvailabilityPage() {
  const [hours, setHours] = useState<{ weekday: number; start: string; end: string; closed: boolean }[]>(
    days.map((_, index) => ({ weekday: index + 1, start: "09:00", end: "18:00", closed: index > 4 })),
  );
  const [items, setItems] = useState<{ id: string; kind: string; start_date: string; end_date: string; reason: string | null }[]>([]);

  useEffect(() => {
    void fetch("/api/admin/eccezioni").then((response) => response.json()).then((body) => {
      setItems(body.eccezioni ?? []);
      if ((body.orari ?? []).length) {
        setHours(days.map((_, index) => {
          const row = (body.orari as { weekday: number; start_minute: number; end_minute: number }[]).find((item) => item.weekday === index + 1);
          return row
            ? { weekday: index + 1, start: minutes(row.start_minute), end: minutes(row.end_minute), closed: false }
            : { weekday: index + 1, start: "09:00", end: "18:00", closed: true };
        }));
      }
    });
  }, []);

  async function saveHours() {
    const response = await fetch("/api/admin/orari", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        giorni: hours.filter((day) => !day.closed).map((day) => ({
          weekday: day.weekday,
          startMin: toMinutes(day.start),
          endMin: toMinutes(day.end),
        })),
      }),
    });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else toast.success("Orari salvati.");
  }

  async function block(formData: FormData) {
    const response = await fetch("/api/admin/eccezioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: formData.get("kind"),
        startDate: formData.get("inizio"),
        endDate: formData.get("fine"),
        allDay: formData.get("intera") === "on",
        startMin: formData.get("intera") === "on" ? null : toMinutes(String(formData.get("oraInizio"))),
        endMin: formData.get("intera") === "on" ? null : toMinutes(String(formData.get("oraFine"))),
        frequency: formData.get("ripeti") || null,
        reason: formData.get("motivo"),
        notes: formData.get("note"),
      }),
    });
    const body = await response.json();
    if (response.status === 409) {
      toast.error(body.errore);
      return;
    }
    if (!response.ok) toast.error(body.errore);
    else toast.success("Disponibilità aggiornata.");
  }

  return (
    <section className="grid gap-8">
      <h1 className="font-display text-5xl text-cocoa">Disponibilità</h1>
      <div className="grid gap-3">
        {hours.map((day, index) => (
          <div key={day.weekday} className="grid grid-cols-[8rem_1fr_1fr_auto] items-center gap-2">
            <span>{days[index]}</span>
            <input type="time" value={day.start} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, start: event.target.value } : item))} />
            <input type="time" value={day.end} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, end: event.target.value } : item))} />
            <label className="text-sm"><input type="checkbox" checked={day.closed} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, closed: event.target.checked } : item))} /> Chiuso</label>
          </div>
        ))}
        <button className="w-fit rounded-full bg-cocoa px-4 py-2 text-cream" type="button" onClick={() => void saveHours()}>Salva orari</button>
      </div>
      <form action={async (formData) => {
        const data = String(formData.get("giorno"));
        await fetch("/api/admin/orari", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, azione: "chiudi" }) });
        toast.success("Giornata chiusa.");
      }} className="flex gap-2">
        <input name="giorno" type="date" required className="rounded-2xl border border-line px-3 py-2" />
        <button className="rounded-full border border-cocoa px-4" type="submit">Chiudi giornata</button>
      </form>
      <form action={async (formData) => {
        const data = String(formData.get("giorno"));
        await fetch("/api/admin/orari", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, azione: "riapri" }) });
        toast.success("Chiusura rimossa. Pause e appuntamenti restano invariati.");
      }} className="flex gap-2">
        <input name="giorno" type="date" required className="rounded-2xl border border-line px-3 py-2" />
        <button className="rounded-full border border-cocoa px-4" type="submit">Riapri giornata</button>
      </form>
      <form action={block} className="grid gap-2 rounded-3xl bg-white p-4">
        <h2 className="font-display text-3xl">Nuovo blocco o apertura</h2>
        <select name="kind" className="rounded-2xl border border-line px-3 py-2">
          <option value="block">Blocca disponibilità</option>
          <option value="extra_opening">Apertura straordinaria</option>
          <option value="full_day_closure">Chiudi intervallo di giorni</option>
        </select>
        <input name="inizio" type="date" required className="rounded-2xl border border-line px-3 py-2" />
        <input name="fine" type="date" required className="rounded-2xl border border-line px-3 py-2" />
        <label><input name="intera" type="checkbox" /> Intera giornata</label>
        <input name="oraInizio" type="time" defaultValue="10:00" />
        <input name="oraFine" type="time" defaultValue="12:00" />
        <select name="ripeti" className="rounded-2xl border border-line px-3 py-2">
          <option value="">Nessuna ripetizione</option>
          <option value="daily">Ogni giorno</option>
          <option value="weekly">Ogni settimana</option>
          <option value="biweekly">Ogni due settimane</option>
          <option value="monthly">Ogni mese</option>
        </select>
        <select name="motivo" className="rounded-2xl border border-line px-3 py-2">
          <option value="pausa">Pausa</option>
          <option value="impegno_personale">Impegno personale</option>
          <option value="ferie">Ferie</option>
          <option value="festivita">Festività</option>
          <option value="chiusura_straordinaria">Chiusura straordinaria</option>
          <option value="altro">Altro</option>
        </select>
        <textarea name="note" placeholder="Note private, visibili solo al salone" className="rounded-2xl border border-line px-3 py-2" />
        <button className="rounded-full bg-cocoa px-4 py-2 text-cream" type="submit">Salva</button>
      </form>
      <ul className="grid gap-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2">
            <span>{item.kind} · {item.start_date} → {item.end_date} · {item.reason}</span>
            <button type="button" onClick={async () => {
              await fetch(`/api/admin/eccezioni?id=${item.id}&tipo=eccezione`, { method: "DELETE" });
              setItems(items.filter((row) => row.id !== item.id));
            }}>Elimina</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function minutes(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function toMinutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}
