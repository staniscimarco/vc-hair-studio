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
  completed: "#2F6B4F",
  cancelled: "#B7B1AE",
  no_show: "#8C3A3A",
  in_progress: "#69423C",
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function SalonCalendar({ focusDate, focusId }: { focusDate?: string; focusId?: string }) {
  const [events, setEvents] = useState<object[]>([]);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
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
        backgroundColor: statusColor[item.status] ?? service?.color ?? "#E8B4B8",
        borderColor: item.id === focusId ? "#69423C" : "transparent",
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
      backgroundColor: "#d9d4d2",
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
    <div className="rounded-3xl bg-white p-3 shadow-[var(--shadow)]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={itLocale}
        initialView={mobile ? "timeGridDay" : "timeGridWeek"}
        initialDate={focusDate}
        headerToolbar={mobile
          ? { left: "prev,next", center: "title", right: "timeGridDay,listWeek" }
          : { left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
        buttonText={{ today: "Oggi", month: "Mese", week: "Settimana", day: "Giorno", list: "Elenco" }}
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
        select={async (info) => {
          const action = window.prompt("Scrivi 1 per inserire un appuntamento, 2 per bloccare la disponibilità.");
          if (action === "2") {
            router.push(`/admin/disponibilita?inizio=${encodeURIComponent(info.startStr)}&fine=${encodeURIComponent(info.endStr)}`);
          }
          if (action === "1") {
            router.push(`/admin/appuntamenti?inizio=${encodeURIComponent(info.startStr)}`);
          }
        }}
      />
      {selected?.id ? (
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <p className="font-display text-2xl">Dettaglio</p>
          <p>Codice {selected.code} · {selected.status}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["confirmed", "in_progress", "completed", "cancelled", "no_show"] as const).map((status) => (
              <button
                key={status}
                className="rounded-full border border-line px-3 py-1 text-sm"
                type="button"
                onClick={async () => {
                  await fetch("/api/admin/agenda", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ id: selected.id, stato: status }),
                  });
                  toast.success("Stato aggiornato.");
                }}
              >
                {status === "confirmed" ? "Confermato" : status === "in_progress" ? "In corso" : status === "completed" ? "Completato" : status === "cancelled" ? "Annullato" : "Mancata presentazione"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm">La registrazione degli incassi non sostituisce gli adempimenti fiscali.</p>
        </div>
      ) : null}
    </div>
  );
}
