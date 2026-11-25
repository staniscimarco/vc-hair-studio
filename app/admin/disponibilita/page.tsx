"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, ChevronLeft, ChevronRight, Clock, Coffee, ListChecks, Trash2 } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";

const days = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const shortDays = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const reasons: Record<string, string> = {
  ferie: "Ferie",
  festivita: "Festività",
  chiusura_straordinaria: "Chiusura straordinaria",
  impegno_personale: "Impegno personale",
  pausa: "Pausa",
  altro: "Altro",
};

const kinds: Record<string, string> = {
  block: "Orario bloccato",
  extra_opening: "Apertura straordinaria",
  full_day_closure: "Giorno di chiusura",
  reopen_day: "Giorno riaperto",
};

const frequencies: Record<string, string> = {
  daily: "ogni giorno",
  weekly: "ogni settimana",
  biweekly: "ogni due settimane",
  monthly: "ogni mese",
  weekdays: "nei giorni indicati",
};

/** Orari selezionabili dalle 06:00 alle 22:00 ogni 15 minuti, sempre in formato 24 ore. */
const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, index) => minutes(6 * 60 + index * 15));

type Exception = {
  id: string;
  kind: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_minute: number | null;
  end_minute: number | null;
  reason: string | null;
};

type Rule = {
  id: string;
  kind: string;
  frequency: string;
  start_date: string;
  until_date: string | null;
  all_day: boolean;
  start_minute: number | null;
  end_minute: number | null;
  reason: string | null;
};

export default function AvailabilityPage() {
  const [hours, setHours] = useState<{ weekday: number; start: string; end: string; closed: boolean }[]>(
    days.map((_, index) => ({ weekday: index + 1, start: "09:00", end: "18:00", closed: index > 4 })),
  );
  const [items, setItems] = useState<Exception[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("ferie");
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [block, setBlock] = useState({ date: "", from: "13:00", to: "14:00", repeat: "", reason: "pausa", kind: "block", notes: "" });

  const today = isoOf(new Date());

  async function load() {
    const body = await fetch("/api/admin/eccezioni").then((response) => response.json());
    setItems(body.eccezioni ?? []);
    setRules(body.regole ?? []);
    if ((body.orari ?? []).length) {
      setHours(days.map((_, index) => {
        const row = (body.orari as { weekday: number; start_minute: number; end_minute: number }[]).find((item) => item.weekday === index + 1);
        return row
          ? { weekday: index + 1, start: minutes(row.start_minute), end: minutes(row.end_minute), closed: false }
          : { weekday: index + 1, start: "09:00", end: "18:00", closed: true };
      }));
    }
  }

  useEffect(() => {
    void load();
    // Arrivando dall'agenda con una fascia selezionata, precompila il blocco orario.
    const params = new URLSearchParams(window.location.search);
    const inizio = params.get("inizio");
    const fine = params.get("fine");
    if (inizio) {
      const start = new Date(inizio);
      const end = fine ? new Date(fine) : null;
      if (!Number.isNaN(start.getTime())) {
        setBlock((current) => ({
          ...current,
          date: isoOf(start),
          from: minutes(start.getHours() * 60 + start.getMinutes()),
          to: end && !Number.isNaN(end.getTime()) ? minutes(end.getHours() * 60 + end.getMinutes()) : current.to,
        }));
      }
    }
  }, []);

  /** Ogni giorno chiuso, con l'eccezione da cui deriva. */
  const closures = useMemo(() => {
    const map = new Map<string, Exception>();
    for (const item of items) {
      if (item.kind !== "full_day_closure") continue;
      for (const date of eachIso(item.start_date, item.end_date)) map.set(date, item);
    }
    return map;
  }, [items]);

  const weeklyOff = new Set(hours.filter((day) => day.closed).map((day) => day.weekday));
  const toClose = selected.filter((date) => !closures.has(date));
  const toReopen = selected.filter((date) => closures.has(date));

  function toggle(date: string) {
    setSelected((current) => (current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort()));
  }

  function addRange() {
    if (!range.from || !range.to || range.to < range.from) {
      toast.error("Indica un periodo valido: la data di fine deve essere uguale o successiva all'inizio.");
      return;
    }
    const dates = eachIso(range.from, range.to).filter((date) => date >= today && !weeklyOff.has(weekdayOf(date)));
    setSelected((current) => [...new Set([...current, ...dates])].sort());
    const first = new Date(`${range.from}T12:00:00`);
    setCursor({ year: first.getFullYear(), month: first.getMonth() });
    toast.success(`${dates.length} giorni aggiunti alla selezione.`);
  }

  async function closeDay(date: string, why: string) {
    const response = await fetch("/api/admin/eccezioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "full_day_closure", startDate: date, endDate: date, allDay: true, startMin: null, endMin: null, frequency: null, reason: why }),
    });
    return response;
  }

  async function closeSelected() {
    setBusy(true);
    const blocked: string[] = [];
    for (const date of toClose) {
      const response = await closeDay(date, reason);
      if (!response.ok) blocked.push(date);
    }
    setBusy(false);
    setSelected([]);
    await load();
    const closed = toClose.length - blocked.length;
    if (closed) toast.success(closed === 1 ? "Giorno chiuso." : `${closed} giorni chiusi.`);
    if (blocked.length) {
      toast.error(`Non ho chiuso ${blocked.map(prettyDate).join(", ")}: ci sono appuntamenti confermati. Spostali o annullali dall'agenda e riprova.`, { duration: 9000 });
    }
  }

  async function reopenSelected() {
    setBusy(true);
    const reopen = new Set(toReopen);
    const handled = new Set<string>();
    for (const date of toReopen) {
      const exception = closures.get(date);
      if (!exception || handled.has(exception.id)) continue;
      handled.add(exception.id);
      await fetch(`/api/admin/eccezioni?id=${exception.id}&tipo=eccezione`, { method: "DELETE" });
      // Se la chiusura copriva un periodo, richiude i giorni del periodo che non vanno riaperti.
      for (const other of eachIso(exception.start_date, exception.end_date)) {
        if (!reopen.has(other) && other >= today) await closeDay(other, exception.reason ?? "chiusura_straordinaria");
      }
    }
    setBusy(false);
    setSelected([]);
    await load();
    toast.success(toReopen.length === 1 ? "Giorno riaperto." : `${toReopen.length} giorni riaperti.`);
  }

  async function saveHours() {
    const invalid = hours.find((day) => !day.closed && toMinutes(day.end) <= toMinutes(day.start));
    if (invalid) {
      toast.error(`${days[invalid.weekday - 1]}: l'orario di chiusura deve essere dopo l'apertura.`);
      return;
    }
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

  async function saveBlock() {
    if (!block.date) {
      toast.error("Scegli il giorno.");
      return;
    }
    if (toMinutes(block.to) <= toMinutes(block.from)) {
      toast.error("L'orario di fine deve essere dopo l'inizio.");
      return;
    }
    const response = await fetch("/api/admin/eccezioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: block.kind,
        startDate: block.date,
        endDate: block.date,
        allDay: false,
        startMin: toMinutes(block.from),
        endMin: toMinutes(block.to),
        frequency: block.repeat || null,
        reason: block.reason,
        notes: block.notes,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.errore);
      return;
    }
    toast.success(block.kind === "extra_opening" ? "Apertura straordinaria salvata." : "Orario bloccato.");
    setBlock((current) => ({ ...current, notes: "" }));
    await load();
  }

  const grid = monthGrid(cursor.year, cursor.month);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(cursor.year, cursor.month, 1));
  const upcoming = items.filter((item) => item.end_date >= today && item.kind !== "full_day_closure");
  const upcomingClosures = groupClosures(items.filter((item) => item.kind === "full_day_closure" && item.end_date >= today));

  return (
    <section>
      <TitleHero title="Disponibilità" back="/admin" subtitle="Decidi quando il salone è aperto. Le clienti vedono solo gli orari liberi." />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* 1. Giorni di chiusura */}
        <div className="card">
          <div className="card-title">
            <span className="tile-icon is-accent"><CalendarOff size={20} /></span>
            <div>
              <h2>Giorni di chiusura e ferie</h2>
              <p className="note m-0">Tocca uno o più giorni per chiuderli. Tocca un giorno rosso per riaprirlo.</p>
            </div>
          </div>

          <div className="month-head">
            <button className="icon-btn is-soft" style={{ width: 38, height: 38 }} type="button" aria-label="Mese precedente" onClick={() => setCursor(shift(cursor, -1))}>
              <ChevronLeft size={18} />
            </button>
            <strong>{monthLabel}</strong>
            <button className="icon-btn is-soft" style={{ width: 38, height: 38 }} type="button" aria-label="Mese successivo" onClick={() => setCursor(shift(cursor, 1))}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="month-grid" role="grid" aria-label={`Calendario di ${monthLabel}`}>
            {shortDays.map((label) => <span key={label} className="wd">{label}</span>)}
            {grid.map((cell, index) => {
              if (!cell) return <span key={`vuoto-${index}`} />;
              const past = cell < today;
              const closed = closures.has(cell);
              const off = weeklyOff.has(weekdayOf(cell));
              const on = selected.includes(cell);
              const label = `${prettyDate(cell)}${closed ? ", chiuso" : off ? ", giorno di riposo settimanale" : ""}`;
              return (
                <button
                  key={cell}
                  type="button"
                  disabled={past || (off && !closed)}
                  aria-pressed={on}
                  aria-label={label}
                  title={closed ? `${reasons[closures.get(cell)?.reason ?? ""] ?? "Chiuso"}` : off ? "Riposo settimanale" : undefined}
                  className={`day-cell ${closed ? "is-closed" : ""} ${off && !closed ? "is-weekly-off" : ""} ${on ? "is-selected" : ""} ${cell === today ? "is-today" : ""}`}
                  onClick={() => toggle(cell)}
                >
                  {Number(cell.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: "var(--lavender-soft)" }} /> Aperto</span>
            <span><i style={{ background: "var(--primary)" }} /> Selezionato</span>
            <span><i style={{ background: "#fdecef", boxShadow: "inset 0 0 0 1px var(--danger)" }} /> Chiuso</span>
            <span><i style={{ background: "#f3f2f6" }} /> Riposo settimanale</span>
          </div>

          <details className="mt-4 rounded-2xl bg-lavender-soft p-3">
            <summary className="cursor-pointer text-sm font-semibold text-primary">Seleziona un periodo (es. ferie di due settimane)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="field">Dal<input type="date" value={range.from} min={today} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
              <label className="field">Al<input type="date" value={range.to} min={range.from || today} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
            </div>
            <button className="btn btn-soft btn-sm mt-3 w-full" type="button" onClick={addRange}>Aggiungi il periodo alla selezione</button>
          </details>

          {selected.length ? (
            <div className="mt-4 grid gap-3 rounded-2xl bg-lavender p-3">
              <p className="m-0 text-sm">
                <strong>{selected.length}</strong> {selected.length === 1 ? "giorno selezionato" : "giorni selezionati"}:{" "}
                <span className="text-muted">{selected.slice(0, 6).map(prettyDate).join(", ")}{selected.length > 6 ? "…" : ""}</span>
              </p>
              {toClose.length ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Motivo della chiusura">
                    <option value="ferie">Ferie</option>
                    <option value="festivita">Festività</option>
                    <option value="chiusura_straordinaria">Chiusura straordinaria</option>
                    <option value="impegno_personale">Impegno personale</option>
                    <option value="altro">Altro</option>
                  </select>
                  <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void closeSelected()}>
                    {busy ? "Attendere…" : `Chiudi ${toClose.length === 1 ? "il giorno" : `${toClose.length} giorni`}`}
                  </button>
                </div>
              ) : null}
              {toReopen.length ? (
                <button className="btn btn-outline" type="button" disabled={busy} onClick={() => void reopenSelected()}>
                  Riapri {toReopen.length === 1 ? "il giorno" : `${toReopen.length} giorni`}
                </button>
              ) : null}
              <button className="btn btn-white btn-sm" type="button" onClick={() => setSelected([])}>Annulla selezione</button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          {/* 2. Orari settimanali */}
          <div className="card grid gap-2">
            <div className="card-title">
              <span className="tile-icon"><Clock size={20} /></span>
              <div>
                <h2>Orari di apertura</h2>
                <p className="note m-0">L&apos;orario di ogni settimana. Spegni i giorni di riposo.</p>
              </div>
            </div>
            {hours.map((day, index) => (
              <div key={day.weekday} className={`hour-row ${day.closed ? "is-off" : ""}`}>
                <span className="name">{days[index]}</span>
                <label className="toggle !bg-transparent !p-0 text-xs">
                  {day.closed ? "Chiuso" : "Aperto"}
                  <input type="checkbox" checked={!day.closed} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, closed: !event.target.checked } : item))} />
                </label>
                {day.closed ? (
                  <span className="times text-[13px] text-muted">Riposo: nessuna prenotazione</span>
                ) : (
                  <div className="times">
                    <select aria-label={`${days[index]}, apertura`} value={day.start} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, start: event.target.value } : item))}>
                      {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                    <span>alle</span>
                    <select aria-label={`${days[index]}, chiusura`} value={day.end} onChange={(event) => setHours(hours.map((item) => item.weekday === day.weekday ? { ...item, end: event.target.value } : item))}>
                      {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <button className="btn btn-primary btn-block mt-2" type="button" onClick={() => void saveHours()}>Salva orari</button>
          </div>

          {/* 3. Pause e impegni */}
          <div className="card grid gap-3">
            <div className="card-title">
              <span className="tile-icon"><Coffee size={20} /></span>
              <div>
                <h2>Pause e impegni</h2>
                <p className="note m-0">Blocca solo alcune ore di un giorno, ad esempio la pausa pranzo.</p>
              </div>
            </div>
            <div className="segmented">
              <button type="button" className={block.kind === "block" ? "is-on" : ""} onClick={() => setBlock({ ...block, kind: "block" })}>Blocca ore</button>
              <button type="button" className={block.kind === "extra_opening" ? "is-on" : ""} onClick={() => setBlock({ ...block, kind: "extra_opening" })}>Apri in più</button>
            </div>
            <label className="field">Giorno<input type="date" value={block.date} min={today} onChange={(event) => setBlock({ ...block, date: event.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Dalle
                <select value={block.from} onChange={(event) => setBlock({ ...block, from: event.target.value })}>
                  {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </label>
              <label className="field">Alle
                <select value={block.to} onChange={(event) => setBlock({ ...block, to: event.target.value })}>
                  {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">Ripeti
                <select value={block.repeat} onChange={(event) => setBlock({ ...block, repeat: event.target.value })}>
                  <option value="">Solo questo giorno</option>
                  <option value="daily">Ogni giorno</option>
                  <option value="weekly">Ogni settimana</option>
                  <option value="biweekly">Ogni due settimane</option>
                  <option value="monthly">Ogni mese</option>
                </select>
              </label>
              <label className="field">Motivo
                <select value={block.reason} onChange={(event) => setBlock({ ...block, reason: event.target.value })}>
                  <option value="pausa">Pausa</option>
                  <option value="impegno_personale">Impegno personale</option>
                  <option value="altro">Altro</option>
                </select>
              </label>
            </div>
            <label className="field">Note private<input value={block.notes} placeholder="Visibili solo al salone" onChange={(event) => setBlock({ ...block, notes: event.target.value })} /></label>
            <button className="btn btn-primary btn-block" type="button" onClick={() => void saveBlock()}>
              {block.kind === "extra_opening" ? "Salva apertura straordinaria" : "Blocca questo orario"}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Riepilogo */}
      <SectionHead title="In programma" subtitle="Chiusure, pause e aperture dei prossimi giorni" />
      {upcomingClosures.length === 0 && upcoming.length === 0 && rules.length === 0 ? (
        <div className="empty-state"><span className="tile-icon"><ListChecks size={20} /></span>Nessuna chiusura o pausa in programma.</div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {upcomingClosures.map((group) => (
          <article key={group.ids.join("-")} className="pick-card" style={{ cursor: "default", padding: 12 }}>
            <span className="tile-icon" style={{ background: "#fdecef", color: "var(--danger)" }}><CalendarOff size={18} /></span>
            <div className="pick-main">
              <h3>{reasons[group.reason ?? ""] ?? "Chiusura"}</h3>
              <p>{group.from === group.to ? prettyDate(group.from) : `Dal ${prettyDate(group.from)} al ${prettyDate(group.to)}`} · tutto il giorno</p>
            </div>
            <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Riapri" title="Riapri" onClick={async () => {
              for (const id of group.ids) await fetch(`/api/admin/eccezioni?id=${id}&tipo=eccezione`, { method: "DELETE" });
              toast.success("Giorni riaperti.");
              await load();
            }}><Trash2 size={16} /></button>
          </article>
        ))}
        {upcoming.map((item) => (
          <article key={item.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
            <span className="tile-icon is-accent"><Coffee size={18} /></span>
            <div className="pick-main">
              <h3>{kinds[item.kind] ?? item.kind}{item.reason ? ` · ${reasons[item.reason] ?? item.reason}` : ""}</h3>
              <p>
                {item.start_date === item.end_date ? prettyDate(item.start_date) : `Dal ${prettyDate(item.start_date)} al ${prettyDate(item.end_date)}`}
                {item.all_day || item.start_minute == null || item.end_minute == null ? " · tutto il giorno" : ` · ${minutes(item.start_minute)}–${minutes(item.end_minute)}`}
              </p>
            </div>
            <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Elimina" onClick={async () => {
              await fetch(`/api/admin/eccezioni?id=${item.id}&tipo=eccezione`, { method: "DELETE" });
              await load();
            }}><Trash2 size={16} /></button>
          </article>
        ))}
        {rules.map((rule) => (
          <article key={rule.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
            <span className="tile-icon is-accent"><Coffee size={18} /></span>
            <div className="pick-main">
              <h3>{kinds[rule.kind] ?? rule.kind}{rule.reason ? ` · ${reasons[rule.reason] ?? rule.reason}` : ""}</h3>
              <p>
                Si ripete {frequencies[rule.frequency] ?? rule.frequency} dal {prettyDate(rule.start_date)}
                {rule.all_day || rule.start_minute == null || rule.end_minute == null ? " · tutto il giorno" : ` · ${minutes(rule.start_minute)}–${minutes(rule.end_minute)}`}
              </p>
            </div>
            <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Elimina" onClick={async () => {
              await fetch(`/api/admin/eccezioni?id=${rule.id}&tipo=regola`, { method: "DELETE" });
              await load();
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
  const [hoursPart, mins] = value.split(":").map(Number);
  return hoursPart * 60 + mins;
}

function isoOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eachIso(from: string, to: string) {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end && out.length < 800) {
    out.push(isoOf(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** 1 = lunedì … 7 = domenica, come nella tabella degli orari. */
function weekdayOf(iso: string) {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function prettyDate(iso: string) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));
}

function shift(cursor: { year: number; month: number }, delta: number) {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Celle del mese a partire da lunedì; `null` per gli spazi vuoti. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1, 12);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: count }, (_, index) => isoOf(new Date(year, month, index + 1, 12))),
  ];
}

/** Unisce le chiusure di giorni consecutivi con lo stesso motivo, per un elenco più leggibile. */
function groupClosures(list: Exception[]) {
  const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const groups: { ids: string[]; from: string; to: string; reason: string | null }[] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    const follows = last && eachIso(last.to, item.start_date).length === 2 && last.reason === item.reason;
    if (last && follows) {
      last.ids.push(item.id);
      last.to = item.end_date;
    } else {
      groups.push({ ids: [item.id], from: item.start_date, to: item.end_date, reason: item.reason });
    }
  }
  return groups;
}
