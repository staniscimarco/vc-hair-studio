"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { formatTime } from "@/lib/format";
import { useLive } from "@/lib/live";
import { statusLabels, type AgendaAppointment } from "@/components/admin/appointment-sheet";

type Block = { id: string; starts_at: string; ends_at: string; reason: string | null };

const blockLabels: Record<string, string> = {
  pausa: "Pausa",
  impegno_personale: "Impegno personale",
  ferie: "Ferie",
  festivita: "Festività",
  chiusura_straordinaria: "Chiuso",
  altro: "Non disponibile",
};

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Agenda pensata per il telefono: giorni in alto, appuntamenti del giorno come schede leggibili. */
export function MobileAgenda({ focusDate, onSelect, refreshKey }: { focusDate?: string; onSelect: (item: AgendaAppointment) => void; refreshKey: number }) {
  const [anchor, setAnchor] = useState(() => {
    const date = focusDate ? new Date(`${focusDate}T12:00:00`) : new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  });
  const [selected, setSelected] = useState(() => iso(focusDate ? new Date(`${focusDate}T12:00:00`) : new Date()));
  const [items, setItems] = useState<AgendaAppointment[] | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const strip = useRef<HTMLDivElement>(null);

  // Finestra di 14 giorni a partire dal lunedì della settimana scelta.
  const days = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [anchor]);

  const load = useCallback(() => {
    const from = new Date(days[0]);
    from.setHours(0, 0, 0, 0);
    const to = new Date(days[days.length - 1]);
    to.setHours(23, 59, 59, 999);
    void fetch(`/api/admin/agenda?da=${encodeURIComponent(from.toISOString())}&a=${encodeURIComponent(to.toISOString())}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        setItems(body.appuntamenti ?? []);
        setBlocks(body.blocchi ?? []);
      })
      .catch(() => setItems([]));
  }, [days]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);
  useLive(load);

  useEffect(() => {
    strip.current?.querySelector(".is-on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selected, days]);

  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items ?? []) {
      if (item.status === "cancelled") continue;
      const key = iso(new Date(item.starts_at));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const dayItems = (items ?? []).filter((item) => iso(new Date(item.starts_at)) === selected).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const dayStart = new Date(`${selected}T00:00:00`).getTime();
  const dayEnd = dayStart + 86_400_000;
  const dayBlocks = blocks.filter((block) => new Date(block.starts_at).getTime() < dayEnd && new Date(block.ends_at).getTime() > dayStart);
  const selectedDate = new Date(`${selected}T12:00:00`);
  const title = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  const today = iso(new Date());

  function shift(weeks: number) {
    const next = new Date(anchor);
    next.setDate(next.getDate() + weeks * 7);
    setAnchor(next);
  }

  return (
    <div>
      <div className="month-head">
        <button className="icon-btn is-soft" style={{ width: 38, height: 38 }} type="button" aria-label="Settimana precedente" onClick={() => shift(-1)}>
          <ChevronLeft size={18} />
        </button>
        <strong>{new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(days[0])}</strong>
        <button className="icon-btn is-soft" style={{ width: 38, height: 38 }} type="button" aria-label="Settimana successiva" onClick={() => shift(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="date-strip" ref={strip}>
        {days.map((date) => {
          const key = iso(date);
          const count = perDay.get(key) ?? 0;
          return (
            <button key={key} type="button" className={`date-chip ${key === selected ? "is-on" : ""}`} onClick={() => setSelected(key)} aria-pressed={key === selected}>
              <small>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", "")}</small>
              <strong>{date.getDate()}</strong>
              {count ? <span className="day-count">{count}</span> : null}
            </button>
          );
        })}
      </div>
      {selected !== today ? (
        <button type="button" className="see-all mt-1" onClick={() => {
          setAnchor(new Date());
          setSelected(today);
        }}>Torna a oggi</button>
      ) : null}

      <div className="section-head" style={{ marginTop: 18 }}>
        <div>
          <h2 className="first-letter:uppercase">{title}</h2>
          <p>{dayItems.filter((item) => item.status !== "cancelled").length} appuntamenti</p>
        </div>
        <Link className="icon-btn" href={`/admin/appuntamenti?inizio=${encodeURIComponent(`${selected}T09:00`)}`} aria-label="Nuovo appuntamento in questo giorno">
          <CalendarPlus size={19} />
        </Link>
      </div>

      <div className="agenda-day">
        {items === null ? [0, 1, 2].map((index) => <div key={index} className="skeleton" style={{ height: 76 }} />) : null}
        {dayBlocks.map((block) => (
          <div key={block.id} className="agenda-block">
            <Coffee size={16} />
            <span>{blockLabels[block.reason ?? ""] ?? "Non disponibile"} · {formatTime(new Date(block.starts_at))}–{formatTime(new Date(block.ends_at))}</span>
          </div>
        ))}
        {items && dayItems.length === 0 ? <div className="empty-state">Nessun appuntamento in questa giornata.</div> : null}
        {dayItems.map((item) => {
          const customer = one(item.customers);
          const service = one(item.services);
          return (
            <button key={item.id} type="button" className={`agenda-item is-${item.status}`} onClick={() => onSelect(item)}>
              <span className="bar" aria-hidden />
              <span className="time">
                {formatTime(new Date(item.starts_at))}
                <small>{formatTime(new Date(item.ends_at))}</small>
              </span>
              <span className="who">
                <strong>{`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Cliente"}</strong>
                <span>{service?.name ?? "Trattamento"}</span>
              </span>
              <span className={`status-pill self-start ${item.status === "pending" ? "is-pending" : item.status === "completed" ? "is-completed" : item.status === "cancelled" || item.status === "no_show" ? "is-cancelled" : "is-confirmed"}`}>
                {statusLabels[item.status] ?? item.status}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
