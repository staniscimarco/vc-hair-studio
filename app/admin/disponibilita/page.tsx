"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, CalendarX, Clock, Trash2 } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";

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

  const kinds: Record<string, string> = { block: "Blocco", extra_opening: "Apertura straordinaria", full_day_closure: "Chiusura" };

  return (
    <section>
      <TitleHero title="Disponibilità" back="/admin" subtitle="Orari settimanali, chiusure, pause e aperture straordinarie." />

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="card grid gap-2">
          <div className="card-title"><span className="tile-icon"><Clock size={20} /></span><h2>Orari settimanali</h2></div>
          {hours.map((day, index) => (
            <div key={day.weekday} className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl p-2 sm:grid-cols-[6.5rem_1fr_1fr_auto] ${day.closed ? "bg-lavender-soft" : "bg-lavender"}`}>
              <span className="text-sm font-semibold">{days[index]}</span>
              <label className="toggle !bg-transparent !p-0 text-xs sm:order-last">
                {day.closed ? "Chiuso" : "Aperto"}
                <input type="checkbox" checked={!day.closed} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, closed: !event.target.checked } : item))} />
              </label>
              <input type="time" aria-label={`${days[index]} apertura`} disabled={day.closed} value={day.start} className="!min-h-10 !bg-white !py-2" onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, start: event.target.value } : item))} />
              <input type="time" aria-label={`${days[index]} chiusura`} disabled={day.closed} value={day.end} className="!min-h-10 !bg-white !py-2" onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, end: event.target.value } : item))} />
            </div>
          ))}
          <button className="btn btn-primary btn-block mt-2" type="button" onClick={() => void saveHours()}>Salva orari</button>
        </div>

        <div className="grid gap-5">
          <div className="card grid gap-3">
            <div className="card-title"><span className="tile-icon"><CalendarX size={20} /></span><h2>Chiudi o riapri una giornata</h2></div>
            <form action={async (formData) => {
              const data = String(formData.get("giorno"));
              await fetch("/api/admin/orari", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, azione: "chiudi" }) });
              toast.success("Giornata chiusa.");
            }} className="flex gap-2">
              <input name="giorno" type="date" required aria-label="Giorno da chiudere" />
              <button className="btn btn-primary flex-none" type="submit">Chiudi</button>
            </form>
            <form action={async (formData) => {
              const data = String(formData.get("giorno"));
              await fetch("/api/admin/orari", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, azione: "riapri" }) });
              toast.success("Chiusura rimossa. Pause e appuntamenti restano invariati.");
            }} className="flex gap-2">
              <input name="giorno" type="date" required aria-label="Giorno da riaprire" />
              <button className="btn btn-soft flex-none" type="submit">Riapri</button>
            </form>
          </div>

          <form action={block} className="card grid gap-3">
            <div className="card-title"><span className="tile-icon is-accent"><Ban size={20} /></span><h2>Nuovo blocco o apertura</h2></div>
            <label className="field">Tipo
              <select name="kind">
                <option value="block">Blocca disponibilità</option>
                <option value="extra_opening">Apertura straordinaria</option>
                <option value="full_day_closure">Chiudi intervallo di giorni</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Dal<input name="inizio" type="date" required /></label>
              <label className="field">Al<input name="fine" type="date" required /></label>
              <label className="field">Dalle<input name="oraInizio" type="time" defaultValue="10:00" /></label>
              <label className="field">Alle<input name="oraFine" type="time" defaultValue="12:00" /></label>
            </div>
            <label className="toggle">Intera giornata<input name="intera" type="checkbox" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Ripetizione
                <select name="ripeti">
                  <option value="">Nessuna</option>
                  <option value="daily">Ogni giorno</option>
                  <option value="weekly">Ogni settimana</option>
                  <option value="biweekly">Ogni due settimane</option>
                  <option value="monthly">Ogni mese</option>
                </select>
              </label>
              <label className="field">Motivo
                <select name="motivo">
                  <option value="pausa">Pausa</option>
                  <option value="impegno_personale">Impegno personale</option>
                  <option value="ferie">Ferie</option>
                  <option value="festivita">Festività</option>
                  <option value="chiusura_straordinaria">Chiusura straordinaria</option>
                  <option value="altro">Altro</option>
                </select>
              </label>
            </div>
            <label className="field">Note<textarea name="note" placeholder="Note private, visibili solo al salone" /></label>
            <button className="btn btn-primary btn-block" type="submit">Salva</button>
          </form>
        </div>
      </div>

      <SectionHead title="Eccezioni in programma" subtitle={`${items.length} attive`} />
      {items.length === 0 ? <div className="empty-state"><span className="tile-icon"><CalendarX size={20} /></span>Nessun blocco o chiusura in programma.</div> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
            <span className="tile-icon is-accent"><Ban size={18} /></span>
            <div className="pick-main">
              <h3>{kinds[item.kind] ?? item.kind}{item.reason ? ` · ${item.reason.replace(/_/g, " ")}` : ""}</h3>
              <p>{item.start_date} → {item.end_date}</p>
            </div>
            <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Elimina" onClick={async () => {
              await fetch(`/api/admin/eccezioni?id=${item.id}&tipo=eccezione`, { method: "DELETE" });
              setItems(items.filter((row) => row.id !== item.id));
            }}><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
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
