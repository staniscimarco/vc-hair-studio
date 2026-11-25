"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";
import type { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { toast } from "sonner";
import { AppointmentSheet, type AgendaAppointment } from "@/components/admin/appointment-sheet";
import { MobileAgenda } from "@/components/admin/mobile-agenda";
import { notifyLive, useLive } from "@/lib/live";

type Appointment = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customers: { first_name?: string; last_name?: string; phone?: string; address?: string } | { first_name?: string; last_name?: string; phone?: string; address?: string }[] | null;
  services: { name?: string; color?: string } | { name?: string; color?: string }[] | null;
};

const blockLabels: Record<string, string> = {
  pausa: "Pausa",
  impegno_personale: "Impegno",
  ferie: "Ferie",
  festivita: "Festività",
  chiusura_straordinaria: "Chiuso",
  altro: "Non disponibile",
};

const statusColor: Record<string, string> = {
  pending: "#F0A500",
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
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [slot, setSlot] = useState({ minutes: 60, from: "08:00:00", to: "20:00:00" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(null);
  const router = useRouter();
  const range = useRef<{ from: string; to: string } | null>(null);

  function reload() {
    if (range.current) void load(range.current.from, range.current.to);
  }
  // L'agenda si aggiorna da sola: nuove prenotazioni, accettazioni e annullamenti.
  useLive(reload);

  async function load(from: string, to: string) {
    range.current = { from, to };
    const response = await fetch(`/api/admin/agenda?da=${encodeURIComponent(from)}&a=${encodeURIComponent(to)}`);
    const body = await response.json();
    if (!response.ok) {
      toast.error(body.errore || "Agenda non disponibile.", { id: "agenda-caricamento" });
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
      title: blockLabels[item.reason ?? ""] ?? "Non disponibile",
      start: item.starts_at,
      end: item.ends_at,
      display: "background",
      backgroundColor: "#ECEBFB",
    }));
    setEvents([...appointments, ...blocks]);
  }

  // Intervallo dell'agenda e fascia oraria presi dalle impostazioni del salone (es. ogni ora).
  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/impostazioni").then((response) => response.json()).catch(() => ({})),
      fetch("/api/admin/eccezioni").then((response) => response.json()).catch(() => ({})),
    ]).then(([settings, availability]) => {
      const minutes = Number(settings.slotMinutes) > 0 ? Number(settings.slotMinutes) : 60;
      const hours = (availability.orari ?? []) as { start_minute: number; end_minute: number }[];
      const first = hours.length ? Math.min(...hours.map((row) => row.start_minute)) : 8 * 60;
      const last = hours.length ? Math.max(...hours.map((row) => row.end_minute)) : 20 * 60;
      const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}:00`;
      setSlot({ minutes, from: clock(Math.max(0, Math.floor(first / 60) * 60 - 60)), to: clock(Math.min(24 * 60, Math.ceil(last / 60) * 60 + 60)) });
    });
  }, []);

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
    } else toast.success("Appuntamento spostato: la cliente è stata avvisata.");
  }

  return (
    <div className="salon-agenda card p-3 lg:p-5">
      {mobile === null ? <div className="skeleton" style={{ height: 320 }} /> : null}
      {mobile ? (
        <MobileAgenda focusDate={focusDate} refreshKey={refreshKey} onSelect={(item) => setSelected(item as unknown as Appointment)} />
      ) : null}
      {mobile === false ? (
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={itLocale}
        initialView="timeGridWeek"
        initialDate={focusDate}
        headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
        buttonIcons={false}
        buttonText={{ prev: "‹", next: "›", today: "Oggi", month: "Mese", week: "Settimana", day: "Giorno", list: "Elenco" }}
        allDayText="Intera giornata"
        slotMinTime={slot.from}
        slotMaxTime={slot.to}
        slotDuration={`${String(Math.floor(slot.minutes / 60)).padStart(2, "0")}:${String(slot.minutes % 60).padStart(2, "0")}:00`}
        snapDuration="00:15:00"
        slotLabelInterval={`${String(Math.floor(slot.minutes / 60)).padStart(2, "0")}:${String(slot.minutes % 60).padStart(2, "0")}:00`}
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
      ) : null}
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
        <AppointmentSheet
          key={selected.id}
          appointment={selected as unknown as AgendaAppointment}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
            setRefreshKey((value) => value + 1);
            notifyLive();
          }}
        />
      ) : null}
    </div>
  );
}
