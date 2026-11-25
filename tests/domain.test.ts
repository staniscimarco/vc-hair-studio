import { describe, expect, it } from "vitest";
import { buildPushPayload } from "@/lib/notifications/message";
import { canCustomerModify, canManageSalon, canReadAppointment, assertRoleUnchanged } from "@/lib/permissions";
import { isAllowedPushEndpoint, safeNext } from "@/lib/security/http";
import { loginSchema, recoverySchema, registrationSchema } from "@/lib/validators";
import { manifestData } from "@/lib/pwa/manifest-data";
import { formatDate, formatPrice, formatTime } from "@/lib/format";

describe("registrazione e accesso", () => {
  const valid = {
    nome: "Maria",
    cognome: "Rossi",
    email: "maria@example.com",
    telefono: "+39 333 1234567",
    indirizzo: "Via Roma 12",
    password: "Capelli2026",
    privacy: true as const,
  };

  it("accetta una registrazione completa", () => {
    expect(registrationSchema.safeParse(valid).success).toBe(true);
  });

  it("rifiuta privacy non accettata, e-mail e password deboli", () => {
    expect(registrationSchema.safeParse({ ...valid, privacy: false }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, email: "non-valida" }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, password: "solo lettere" }).success).toBe(false);
  });

  it("valida accesso e recupero password", () => {
    expect(loginSchema.safeParse({ email: "maria@example.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "admin", password: "x" }).success).toBe(true);
    expect(recoverySchema.safeParse({ email: "maria@example.com" }).success).toBe(true);
    expect(recoverySchema.safeParse({ email: "no" }).success).toBe(false);
  });
});

describe("permessi", () => {
  it("consente al cliente solo i propri appuntamenti", () => {
    expect(canReadAppointment("customer", "user-1", "user-1")).toBe(true);
    expect(canReadAppointment("customer", "user-2", "user-1")).toBe(false);
    expect(canReadAppointment("customer", null, "user-1")).toBe(false);
    expect(canReadAppointment("admin", "user-2", "admin-1")).toBe(true);
  });

  it("impedisce l'autoassegnazione del ruolo amministratore", () => {
    expect(() => assertRoleUnchanged("customer", "admin")).toThrow(/ruolo/);
    expect(canManageSalon("customer")).toBe(false);
    expect(canManageSalon("admin")).toBe(true);
  });

  it("rispetta il limite di modifica di 24 ore", () => {
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(canCustomerModify(new Date("2026-06-16T10:00:00.000Z"), now, 24)).toBe(true);
    expect(canCustomerModify(new Date("2026-06-16T09:00:00.000Z"), now, 24)).toBe(false);
  });
});

describe("notifiche e sicurezza", () => {
  it("compone la notifica senza dati personali e con la data dell'agenda", () => {
    const payload = buildPushPayload("created", new Date("2026-11-28T09:30:00.000Z"), "6d9f5c2a-7b14-4f0e-9c1a-2b3c4d5e6f70");
    expect(payload.title).toBe("Nuovo appuntamento");
    expect(payload.body).toBe("Hai ricevuto una nuova prenotazione per sabato 28 novembre alle 10:30.");
    expect(payload.body).not.toMatch(/@|rossi|333/i);
    expect(payload.url).toBe("/admin/calendario?date=2026-11-28&appointment=6d9f5c2a-7b14-4f0e-9c1a-2b3c4d5e6f70");
  });

  it("accetta solo endpoint push pubblici e destinazioni interne", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("http://127.0.0.1/admin")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.example/push")).toBe(false);
    expect(safeNext("/admin/calendario?date=2026-11-28")).toBe("/admin/calendario?date=2026-11-28");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
  });
});

describe("presentazione", () => {
  it("formatta data, ora e prezzo in italiano", () => {
    const instant = new Date("2026-11-28T09:30:00.000Z");
    expect(formatDate(instant)).toBe("28/11/2026");
    expect(formatTime(instant)).toBe("10:30");
    expect(formatPrice(null)).toBe("Prezzo da concordare in salone");
    expect(formatPrice(4500)).toMatch(/45,00/);
  });

  it("dichiara una web app installabile in italiano", () => {
    expect(manifestData.name).toBe("VC Hair Studio");
    expect(manifestData.lang).toBe("it");
    expect(manifestData.display).toBe("standalone");
    expect(manifestData.startUrl).toBe("/entra");
    expect(manifestData.themeColor).toBe("#5826B2");
  });
});
