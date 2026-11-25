import { z } from "zod";

const privacyMessage =
  "Per continuare è necessario prendere visione dell'informativa sulla privacy.";

export const passwordSchema = z
  .string()
  .min(8, "La password deve contenere almeno 8 caratteri.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inserisci almeno una lettera.")
  .regex(/[0-9]/, "Inserisci almeno un numero.");

/** Il servizio copre solo Brindisi: si inserisce via e civico, città e CAP sono fissi. */
export const CITY = "Brindisi";
export const POSTAL_CODE = "72100";

export const streetSchema = z
  .string()
  .trim()
  .min(4, "Inserisci via e numero civico.")
  .max(120, "L'indirizzo è troppo lungo.")
  .regex(/[A-Za-zÀ-ÿ]/, "Inserisci il nome della via.")
  .regex(/\d/, "Aggiungi il numero civico.");

export function fullAddress(street: string) {
  return `${street.trim()}, ${POSTAL_CODE} ${CITY}`;
}

export function streetOf(address: string | null | undefined) {
  return (address ?? "").replace(new RegExp(`,?\\s*${POSTAL_CODE}\\s*${CITY}\\s*$`, "i"), "").trim();
}

export const registrationSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(80, "Il nome è troppo lungo."),
  cognome: z.string().trim().min(2, "Inserisci il cognome.").max(80, "Il cognome è troppo lungo."),
  email: z.string().trim().email("Inserisci un indirizzo e-mail valido.").max(160),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s]{7,18}$/, "Inserisci un numero di telefono valido."),
  indirizzo: streetSchema,
  password: passwordSchema,
  privacy: z.literal(true, privacyMessage),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Inserisci e-mail o nome utente.").max(160),
  password: z.string().min(1, "Inserisci la password."),
});

export const recoverySchema = z.object({
  email: z.string().trim().email("Inserisci un indirizzo e-mail valido."),
});

export const profileSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(80),
  cognome: z.string().trim().min(2, "Inserisci il cognome.").max(80),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s]{7,18}$/, "Inserisci un numero di telefono valido."),
  indirizzo: streetSchema,
});

export const serviceSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome del trattamento.").max(80),
  descrizione: z.string().trim().min(2, "Inserisci una descrizione.").max(600),
  durataMinuti: z.number().int().min(15, "La durata minima è 15 minuti.").max(8 * 60),
  preparazioneMinuti: z.number().int().min(0).max(180),
  intervalloMinuti: z.number().int().min(0).max(180),
  prezzoCentesimi: z.number().int().min(0).nullable(),
  colore: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Inserisci un colore valido."),
  attivo: z.boolean(),
  visibile: z.boolean(),
  ordine: z.number().int().min(0).max(999),
});

export const manualAppointmentSchema = z.object({
  clienteId: z.string().uuid().nullable(),
  nuovoCliente: z
    .object({
      nome: z.string().trim().min(2),
      cognome: z.string().trim().min(2),
      email: z.string().trim().email().optional().or(z.literal("")),
      telefono: z.string().trim().optional().or(z.literal("")),
    })
    .nullable(),
  servizioId: z.string().uuid("Seleziona un trattamento."),
  inizio: z.string().datetime(),
  durataMinuti: z.number().int().min(15).max(8 * 60),
  prezzoCentesimi: z.number().int().min(0).nullable(),
  note: z.string().max(1000).optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
