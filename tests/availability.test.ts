import { describe, expect, it } from "vitest";
import {
  conflictsWithAppointments,
  getAvailableSlots,
  occursOn,
  PrenotazioniSimultanee,
  type AvailabilityInput,
  type BusyAppointment,
  type ScheduleException,
  type ScheduleRule,
  type WorkingWindow,
} from "@/lib/availability/engine";
import { addDays, zonedDateTime } from "@/lib/availability/time";

const DATE = "2026-06-15";
const NOW = new Date("2026-06-14T22:00:00.000Z");

function hours(partial: WorkingWindow[] = [{ weekday: 1, startMin: 9 * 60, endMin: 18 * 60 }]): WorkingWindow[] {
  return partial;
}

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    now: NOW,
    durationMinutes: 30,
    prepMinutes: 0,
    bufferMinutes: 0,
    slotMinutes: 15,
    minAdvanceMinutes: 0,
    maxHorizonDays: 60,
    workingHours: hours(),
    rules: [],
    exceptions: [],
    appointments: [],
    ...overrides,
  };
}

function labels(overrides: Partial<AvailabilityInput> = {}): string[] {
  return getAvailableSlots(input(overrides)).map((slot) => slot.label);
}

function at(date: string, hoursValue: number, minutes = 0): Date {
  const instant = zonedDateTime(date, hoursValue * 60 + minutes);
  if (!instant) throw new Error(`Orario inesistente ${date} ${hoursValue}:${minutes}`);
  return instant;
}

describe("disponibilità", () => {
  it("non offre orari se il giorno non è lavorativo", () => {
    expect(labels({ workingHours: [] })).toEqual([]);
  });

  it("genera slot da 15 minuti per una piega di 30 minuti", () => {
    const slots = labels();
    expect(slots[0]).toBe("09:00");
    expect(slots).toContain("12:30");
    expect(slots.at(-1)).toBe("17:30");
    expect(slots).not.toContain("17:45");
  });

  it("rispetta la durata e non propone un trattamento che non entra", () => {
    expect(labels({ durationMinutes: 90, workingHours: hours([{ weekday: 1, startMin: 17 * 60, endMin: 18 * 60 }]) })).toEqual([]);
    expect(labels({ durationMinutes: 60, workingHours: hours([{ weekday: 1, startMin: 17 * 60, endMin: 18 * 60 }]) })).toEqual(["17:00"]);
  });

  it("esclude gli orari sovrapposti a un appuntamento", () => {
    const appointments: BusyAppointment[] = [
      { id: "a1", start: at(DATE, 10), end: at(DATE, 11), prepMinutes: 0, bufferMinutes: 0 },
    ];
    const slots = labels({ durationMinutes: 60, appointments });
    expect(slots).toContain("09:00");
    expect(slots).not.toContain("09:15");
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("11:00");
  });

  it("applica l'intervallo tra trattamenti una sola volta", () => {
    const appointments: BusyAppointment[] = [
      { id: "a1", start: at(DATE, 10), end: at(DATE, 10, 30), prepMinutes: 0, bufferMinutes: 15 },
    ];
    const slots = labels({ bufferMinutes: 0, appointments });
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("10:45");
  });

  it("tiene conto del tempo di preparazione", () => {
    expect(labels({ prepMinutes: 15 })[0]).toBe("09:15");
  });

  it("chiude l'intera giornata", () => {
    const exceptions: ScheduleException[] = [
      {
        id: "c1",
        kind: "full_day_closure",
        startDate: DATE,
        endDate: DATE,
        allDay: true,
        startMin: null,
        endMin: null,
        recurrenceId: null,
      },
    ];
    expect(labels({ exceptions })).toEqual([]);
  });

  it("la riapertura rimuove solo la chiusura e conserva la pausa", () => {
    const exceptions: ScheduleException[] = [
      {
        id: "c1",
        kind: "full_day_closure",
        startDate: DATE,
        endDate: DATE,
        allDay: true,
        startMin: null,
        endMin: null,
        recurrenceId: null,
      },
      {
        id: "r1",
        kind: "reopen_day",
        startDate: DATE,
        endDate: DATE,
        allDay: true,
        startMin: null,
        endMin: null,
        recurrenceId: null,
      },
      {
        id: "p1",
        kind: "block",
        startDate: DATE,
        endDate: DATE,
        allDay: false,
        startMin: 10 * 60,
        endMin: 12 * 60,
        recurrenceId: null,
      },
    ];
    const slots = labels({ exceptions });
    expect(slots).toContain("09:00");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("11:30");
    expect(slots).toContain("12:00");
  });

  it("blocca una fascia oraria", () => {
    const exceptions: ScheduleException[] = [
      {
        id: "b1",
        kind: "block",
        startDate: DATE,
        endDate: DATE,
        allDay: false,
        startMin: 10 * 60,
        endMin: 12 * 60,
        recurrenceId: null,
      },
    ];
    const slots = labels({ exceptions });
    expect(slots).toContain("09:30");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("12:00");
  });

  it("blocca più giorni consecutivi di ferie", () => {
    const exceptions: ScheduleException[] = [
      {
        id: "f1",
        kind: "block",
        startDate: "2026-08-10",
        endDate: "2026-08-17",
        allDay: true,
        startMin: null,
        endMin: null,
        recurrenceId: null,
      },
    ];
    const allWeek = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMin: 9 * 60,
      endMin: 13 * 60,
    }));
    expect(labels({ date: "2026-08-12", workingHours: allWeek, exceptions, maxHorizonDays: 120 })).toEqual([]);
    expect(labels({ date: "2026-08-18", workingHours: allWeek, exceptions, maxHorizonDays: 120 }).length).toBeGreaterThan(0);
  });

  it("applica un'indisponibilità ricorrente e permette di saltare un'occorrenza", () => {
    const rules: ScheduleRule[] = [
      {
        id: "rec1",
        kind: "block",
        frequency: "weekly",
        weekdays: [],
        startDate: DATE,
        untilDate: "2026-12-31",
        allDay: false,
        startMin: 13 * 60,
        endMin: 15 * 60,
      },
    ];
    expect(labels({ rules })).not.toContain("13:00");
    expect(
      labels({
        date: "2026-06-16",
        rules,
        workingHours: hours([
          { weekday: 1, startMin: 9 * 60, endMin: 18 * 60 },
          { weekday: 2, startMin: 9 * 60, endMin: 18 * 60 },
        ]),
      }),
    ).toContain("13:00");
    const exceptions: ScheduleException[] = [
      {
        id: "skip1",
        kind: "skip_occurrence",
        startDate: DATE,
        endDate: DATE,
        allDay: true,
        startMin: null,
        endMin: null,
        recurrenceId: "rec1",
      },
    ];
    expect(labels({ rules, exceptions })).toContain("13:00");
  });

  it("gestisce ripetizioni ogni due settimane, mensili e per giorni scelti", () => {
    const biweekly: ScheduleRule = {
      id: "bi",
      kind: "block",
      frequency: "biweekly",
      weekdays: [],
      startDate: DATE,
      untilDate: null,
      allDay: true,
      startMin: null,
      endMin: null,
    };
    expect(occursOn(biweekly, DATE)).toBe(true);
    expect(occursOn(biweekly, "2026-06-22")).toBe(false);
    expect(occursOn(biweekly, "2026-06-29")).toBe(true);

    const monthly: ScheduleRule = { ...biweekly, id: "mo", frequency: "monthly" };
    expect(occursOn(monthly, "2026-07-15")).toBe(true);
    expect(occursOn(monthly, "2026-07-16")).toBe(false);
    expect(occursOn(monthly, "2026-02-15")).toBe(false);

    const mondays: ScheduleRule = {
      ...biweekly,
      id: "wd",
      frequency: "weekdays",
      weekdays: [1],
      allDay: false,
      startMin: 13 * 60,
      endMin: 15 * 60,
    };
    expect(labels({ rules: [mondays] })).not.toContain("13:30");
    expect(labels({ date: "2026-06-17", rules: [mondays], workingHours: hours([{ weekday: 3, startMin: 9 * 60, endMin: 18 * 60 }]) })).toContain("13:30");
  });

  it("apre un giorno normalmente chiuso", () => {
    const rules: ScheduleRule[] = [
      {
        id: "sun",
        kind: "extra_opening",
        frequency: "weekdays",
        weekdays: [7],
        startDate: "2026-06-01",
        untilDate: "2026-06-30",
        allDay: false,
        startMin: 10 * 60,
        endMin: 13 * 60,
      },
    ];
    const slots = labels({ date: "2026-06-21", workingHours: hours(), rules });
    expect(slots[0]).toBe("10:00");
    expect(slots.at(-1)).toBe("12:30");
  });

  it("applica anticipo minimo e orizzonte massimo", () => {
    const now = new Date("2026-06-15T08:00:00.000Z");
    const slots = labels({ now, minAdvanceMinutes: 120 });
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("12:00");
    const allWeek = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      startMin: 9 * 60,
      endMin: 13 * 60,
    }));
    expect(labels({ date: addDays(DATE, 61), workingHours: allWeek })).toEqual([]);
    expect(labels({ date: addDays(DATE, 60), workingHours: allWeek }).length).toBeGreaterThan(0);
    expect(labels({ date: addDays(DATE, 90), workingHours: allWeek, ignoreHorizon: true }).length).toBeGreaterThan(0);
  });

  it("gestisce ora solare, ora legale e l'orario inesistente", () => {
    expect(zonedDateTime("2026-03-29", 2 * 60 + 30)).toBeNull();
    expect(zonedDateTime("2026-01-15", 12 * 60)?.toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(zonedDateTime("2026-06-15", 12 * 60)?.toISOString()).toBe("2026-06-15T10:00:00.000Z");
    expect(zonedDateTime("2026-10-25", 12 * 60)?.toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("libera la fascia quando l'appuntamento annullato non viene passato", () => {
    expect(labels()).toContain("10:00");
  });

  it("segnala i conflitti con appuntamenti già confermati", () => {
    const appointments: BusyAppointment[] = [
      { id: "a1", start: at(DATE, 10), end: at(DATE, 11), prepMinutes: 15, bufferMinutes: 15 },
    ];
    const hit = conflictsWithAppointments(at(DATE, 11), at(DATE, 11, 15), 0, 0, appointments);
    const miss = conflictsWithAppointments(at(DATE, 11, 15), at(DATE, 12), 0, 0, appointments);
    expect(hit.map((item) => item.id)).toEqual(["a1"]);
    expect(miss).toEqual([]);
  });

  it("ignora l'appuntamento in modifica", () => {
    const appointments: BusyAppointment[] = [
      { id: "a1", start: at(DATE, 10), end: at(DATE, 11), prepMinutes: 0, bufferMinutes: 0 },
    ];
    expect(labels({ durationMinutes: 60, appointments, ignoreAppointmentId: "a1" })).toContain("10:00");
  });

  it("accetta una sola prenotazione simultanea e riconosce la richiesta duplicata", () => {
    const book = new PrenotazioniSimultanee();
    expect(book.prova("idem-1", 600, 660)).toBe("confermato");
    expect(book.prova("idem-2", 630, 690)).toBe("occupato");
    expect(book.prova("idem-1", 600, 660)).toBe("duplicato");
    expect(book.prova("idem-3", 660, 720)).toBe("confermato");
  });

  it("non propone orari nella pausa tra due fasce", () => {
    const slots = labels({
      durationMinutes: 60,
      workingHours: hours([
        { weekday: 1, startMin: 9 * 60, endMin: 13 * 60 },
        { weekday: 1, startMin: 15 * 60, endMin: 19 * 60 },
      ]),
    });
    expect(slots).toContain("12:00");
    expect(slots).not.toContain("12:15");
    expect(slots).not.toContain("13:00");
    expect(slots).toContain("15:00");
  });
});
