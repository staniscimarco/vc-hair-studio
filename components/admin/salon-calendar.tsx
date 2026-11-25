"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { toast } from "sonner";

type Appointment = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customers: { first_name?: string; last_name?: string; phone?: string } | { first_name?: string; last_name?: string; phone?: string }[] | null;
  services: { name?: string; color?: string } | { name?: string; color?: string }[] | null;
};

const statusColor: Record<string, string> = {
  confirmed: "#9D6CFB",
  completed: "#1F9D6B",
  cancelled: "#C9C5D6",
  no_show: "#D6455D",
  in_progress: "#5826B2",
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function SalonCalendar({ focusDate, focusId }: { focusDate?: string; focusId?: string }) {
  const [events, setEvents] = useState<object[]>([]);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const router = useRouter();

  async function load(from: string, to: string) {
    const response = await fetch(`/api/admin/agenda?da=${encodeURIComponent(from)}&a=${encodeURIComponent(to)}`);
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.errore || "Agenda non disponibile.");
      return;
    }
    const appointments = (body.appuntamenti as Appointment[]).map((item) => {
      const customer = one(item.customers);
      const service = one(item.services);
      const fresh = Date.now() - new Date(item.starts_at).getTime() < 0 && item.id === focusId;
      return {
        id: item.id,
        title: `${service?.name ?? "Trattamento"} · ${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim(),
        start: item.starts_at,
        end: item.ends_at,
        backgroundColor: statusColor[item.status] ?? service?.color ?? "#9D6CFB",
        borderColor: item.id === focusId ? "#5826B2" : "transparent",
        classNames: fresh || item.id === focusId ? ["ring-2"] : [],
        extendedProps: item,
      };
    });
    const blocks = (body.blocchi as { id: string; starts_at: string; ends_at: string; reason: string | null }[]).map((item) => ({
      id: `blocco-${item.id}`,
      title: item.reason || "Non disponibile",
      start: item.starts_at,
      end: item.ends_at,
      display: "background",
      backgroundColor: "#ECEBFB",
    }));
    setEvents([...appointments, ...blocks]);
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  async function move(info: EventDropArg) {
    if (!info.event.start) return;
    const response = await fetch("/api/admin/agenda", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: info.event.id, inizio: info.event.start.toISOString() }),
    });
    if (!response.ok) {
      info.revert();
      const body = await response.json();
      toast.error(body.errore || "Spostamento non consentito.");
    }
  }

  return (
    <div className="salon-agenda card p-3 lg:p-5">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={itLocale}
        initialView={mobile ? "timeGridDay" : "timeGridWeek"}
        initialDate={focusDate}
        headerToolbar={mobile
          ? { left: "prev,next", center: "title", right: "timeGridDay,listWeek" }
          : { left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
        buttonIcons={false}
        buttonText={{ prev: "‹", next: "›", today: "Oggi", month: "Mese", week: "Settimana", day: "Giorno", list: "Elenco" }}
        allDayText="Intera giornata"
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:15:00"
        nowIndicator
        selectable
        editable
        height="auto"
        events={events}
        datesSet={(arg) => void load(arg.start.toISOString(), arg.end.toISOString())}
        eventDrop={(info) => void move(info)}
        eventResize={(info) => void move(info as unknown as EventDropArg)}
        eventClick={(info: EventClickArg) => setSelected(info.event.extendedProps as Appointment)}
        select={(info) => setDraft({ start: info.startStr, end: info.endStr })}
      />
      {draft ? (
        <>
          <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={() => setDraft(null)} />
          <div className="sheet-panel" role="dialog" aria-label="Fascia libera">
            <div className="sheet-handle" />
            <p className="eyebrow">Fascia libera</p>
            <h2>Cosa vuoi fare?</h2>
            <div className="mt-3 grid gap-2">
              <button className="btn btn-primary btn-block" type="button" onClick={() => router.push(`/admin/appuntamenti?inizio=${encodeURIComponent(draft.start)}`)}>Inserisci appuntamento</button>
              <button className="btn btn-soft btn-block" type="button" onClick={() => router.push(`/admin/disponibilita?inizio=${encodeURIComponent(draft.start)}&fine=${encodeURIComponent(draft.end)}`)}>Blocca disponibilità</button>
            </div>
          </div>
        </>
      ) : null}
      {selected?.id ? (
        <div className="card-soft mt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-lg">Dettaglio appuntamento</h2>
            <button className="btn btn-white btn-xs" type="button" onClick={() => setSelected(null)}>Chiudi</button>
          </div>
          <p className="mt-1 text-sm">
            {one(selected.services)?.name ?? "Trattamento"} · {one(selected.customers)?.first_name ?? ""} {one(selected.customers)?.last_name ?? ""}
            {one(selected.customers)?.phone ? <> · <a className="font-medium text-primary-strong" href={`tel:${one(selected.customers)?.phone}`}>{one(selected.customers)?.phone}</a></> : null}
          </p>
          <p className="note m-0">Codice {selected.code}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["confirmed", "in_progress", "completed", "cancelled", "no_show"] as const).map((status) => (
              <button
                key={status}
                className={`chip ${selected.status === status ? "is-on" : "bg-white"}`}
                type="button"
                onClick={async () => {
                  await fetch("/api/admin/agenda", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: selected.id, stato: status }),
                  });
                  setSelected({ ...selected, status });
                  toast.success("Stato aggiornato.");
                }}
              >
                {status === "confirmed" ? "Confermato" : status === "in_progress" ? "In corso" : status === "completed" ? "Completato" : status === "cancelled" ? "Annullato" : "Mancata presentazione"}
              </button>
            ))}
          </div>
          <p className="note mt-3">La registrazione degli incassi non sostituisce gli adempimenti fiscali.</p>
        </div>
      ) : null}
    </div>
  );
}
