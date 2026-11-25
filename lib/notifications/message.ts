import { romeDate } from "@/lib/availability/time";
import { formatDateLong, formatTime } from "@/lib/format";

export type PushEvent = "created" | "updated" | "cancelled";

const titles: Record<PushEvent, string> = {
  created: "Nuovo appuntamento",
  updated: "Appuntamento modificato",
  cancelled: "Appuntamento annullato",
};

const leads: Record<PushEvent, string> = {
  created: "Hai ricevuto una nuova prenotazione per",
  updated: "Una prenotazione è stata modificata:",
  cancelled: "Una prenotazione è stata annullata:",
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function buildPushPayload(event: PushEvent, when: Date, appointmentId: string): PushPayload {
  return {
    title: titles[event],
    body: `${leads[event]} ${formatDateLong(when)} alle ${formatTime(when)}.`,
    url: `/admin/calendario?date=${romeDate(when)}&appointment=${appointmentId}`,
  };
}
