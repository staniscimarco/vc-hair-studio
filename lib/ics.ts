/** Generazione di file iCalendar (.ics) compatibili con Calendario di iPhone, Google e Outlook. */

export type IcsEvent = {
  uid: string;
  start: string | Date;
  end: string | Date;
  summary: string;
  description?: string;
  location?: string;
  /** Promemoria in minuti prima dell'inizio. */
  alarmMinutes?: number;
};

function stamp(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Spezza le righe a 75 caratteri come richiesto dallo standard. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildCalendar(events: IcsEvent[], name = "VC Hair Studio") {
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VC Hair Studio//Agenda//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    "X-WR-TIMEZONE:Europe/Rome",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}@vc-hair-studio`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(event.start)}`,
      `DTEND:${stamp(event.end)}`,
      `SUMMARY:${escape(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escape(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escape(event.location)}`);
    if (event.alarmMinutes) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escape(event.summary)}`, `TRIGGER:-PT${event.alarmMinutes}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n");
}

type Row = {
  id: string;
  code: string;
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  notes?: string | null;
  customers: { first_name?: string; last_name?: string; phone?: string | null; address?: string | null } | { first_name?: string; last_name?: string; phone?: string | null; address?: string | null }[] | null;
  services: { name?: string } | { name?: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** Evento per l'agenda del salone: titolo "Nome Cognome · Servizio". */
export function salonEvent(row: Row, address?: string): IcsEvent {
  const customer = one(row.customers);
  const service = one(row.services);
  const name = `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Cliente";
  const details = [
    `Cliente: ${name}`,
    customer?.phone ? `Telefono: ${customer.phone}` : null,
    customer?.address ? `Indirizzo: ${customer.address}` : null,
    `Trattamento: ${service?.name ?? "Trattamento"}`,
    row.price_cents != null ? `Prezzo: ${(row.price_cents / 100).toFixed(2).replace(".", ",")} €` : "Prezzo da concordare",
    `Codice: ${row.code}`,
    row.notes ? `Note: ${row.notes}` : null,
  ].filter(Boolean);
  return {
    uid: row.id,
    start: row.starts_at,
    end: row.ends_at,
    summary: `${name} · ${service?.name ?? "Trattamento"}`,
    description: details.join("\n"),
    // Toccando il luogo nel Calendario dell'iPhone si apre Mappe con l'itinerario.
    location: customer?.address || address || undefined,
    alarmMinutes: 30,
  };
}

export const salonSelect = "id, code, starts_at, ends_at, price_cents, notes, status, customers(first_name, last_name, phone, address), services(name)";
