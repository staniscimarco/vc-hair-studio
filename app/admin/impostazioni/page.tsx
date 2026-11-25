"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    void fetch("/api/admin/impostazioni").then(async (response) => {
      const body = await response.json();
      if (!response.ok) toast.error(body.errore);
      else {
        setValues({
          nomeSalone: body.salonName ?? "",
          parrucchiera: body.stylistName ?? "",
          telefono: body.phone ?? "",
          email: body.email ?? "",
          indirizzo: body.address ?? "",
          citta: body.city ?? "",
          cap: body.postalCode ?? "",
          prenotazioniAttive: body.bookingEnabled,
          configurazioneCompleta: body.setupCompleted,
          slotMinuti: String(body.slotMinutes ?? 15),
          anticipoMinuti: String(body.minAdvanceMinutes ?? 120),
          orizzonteGiorni: String(body.maxHorizonDays ?? 60),
          oreAnnullamento: String(body.cancelMinHours ?? 24),
          oreModifica: String(body.rescheduleMinHours ?? 24),
          promemoriaAttivi: body.remindersEnabled,
          orePromemoria: String(body.reminderHoursBefore ?? 24),
          titolareNome: body.privacyControllerName ?? "",
          titolareEmail: body.privacyControllerEmail ?? "",
          titolareIndirizzo: body.privacyControllerAddress ?? "",
          partitaIva: body.vatNumber ?? "",
          conservazioneMesi: String(body.retentionMonths ?? 24),
          noteLegali: body.legalNotes ?? "",
        });
        setReady(true);
      }
    });
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/impostazioni", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nomeSalone: form.get("nomeSalone"),
        parrucchiera: form.get("parrucchiera"),
        telefono: form.get("telefono"),
        email: form.get("email"),
        indirizzo: form.get("indirizzo"),
        citta: form.get("citta"),
        cap: form.get("cap"),
        prenotazioniAttive: form.get("prenotazioniAttive") === "on",
        configurazioneCompleta: form.get("configurazioneCompleta") === "on",
        slotMinuti: Number(form.get("slotMinuti")),
        anticipoMinuti: Number(form.get("anticipoMinuti")),
        orizzonteGiorni: Number(form.get("orizzonteGiorni")),
        oreAnnullamento: Number(form.get("oreAnnullamento")),
        oreModifica: Number(form.get("oreModifica")),
        promemoriaAttivi: form.get("promemoriaAttivi") === "on",
        orePromemoria: Number(form.get("orePromemoria")),
        titolareNome: form.get("titolareNome"),
        titolareEmail: form.get("titolareEmail"),
        titolareIndirizzo: form.get("titolareIndirizzo"),
        partitaIva: form.get("partitaIva"),
        conservazioneMesi: Number(form.get("conservazioneMesi")),
        noteLegali: form.get("noteLegali"),
      }),
    });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else toast.success("Impostazioni salvate.");
  }

  if (!ready) return <div className="h-40 animate-pulse rounded-3xl bg-blush-soft" />;
  return (
    <form onSubmit={(event) => void save(event)} className="grid max-w-xl gap-3">
      <h1 className="font-display text-5xl text-cocoa">Impostazioni</h1>
      <Field name="nomeSalone" label="Nome del salone" defaultValue={String(values.nomeSalone ?? "")} />
      <Field name="parrucchiera" label="Nome della parrucchiera" defaultValue={String(values.parrucchiera ?? "")} />
      <Field name="telefono" label="Telefono" defaultValue={String(values.telefono ?? "")} />
      <Field name="email" label="E-mail" defaultValue={String(values.email ?? "")} />
      <Field name="indirizzo" label="Indirizzo" defaultValue={String(values.indirizzo ?? "")} />
      <Field name="citta" label="Città" defaultValue={String(values.citta ?? "")} />
      <Field name="cap" label="CAP" defaultValue={String(values.cap ?? "")} />
      <Field name="slotMinuti" label="Intervallo degli orari (minuti)" defaultValue={String(values.slotMinuti)} />
      <Field name="anticipoMinuti" label="Anticipo minimo (minuti)" defaultValue={String(values.anticipoMinuti)} />
      <Field name="orizzonteGiorni" label="Limite massimo di prenotazione (giorni)" defaultValue={String(values.orizzonteGiorni)} />
      <Field name="oreAnnullamento" label="Ore minime per annullare" defaultValue={String(values.oreAnnullamento)} />
      <Field name="oreModifica" label="Ore minime per modificare" defaultValue={String(values.oreModifica)} />
      <Field name="orePromemoria" label="Promemoria ore prima" defaultValue={String(values.orePromemoria)} />
      <label><input name="promemoriaAttivi" type="checkbox" defaultChecked={Boolean(values.promemoriaAttivi)} /> Promemoria attivi</label>
      <label><input name="prenotazioniAttive" type="checkbox" defaultChecked={Boolean(values.prenotazioniAttive)} /> Prenotazioni pubbliche attive</label>
      <label><input name="configurazioneCompleta" type="checkbox" defaultChecked={Boolean(values.configurazioneCompleta)} /> Configurazione essenziale completata</label>
      <h2 className="font-display text-3xl">Informazioni legali</h2>
      <Field name="titolareNome" label="Titolare del trattamento" defaultValue={String(values.titolareNome ?? "")} />
      <Field name="titolareEmail" label="E-mail del titolare" defaultValue={String(values.titolareEmail ?? "")} />
      <Field name="titolareIndirizzo" label="Indirizzo del titolare" defaultValue={String(values.titolareIndirizzo ?? "")} />
      <Field name="partitaIva" label="Partita IVA" defaultValue={String(values.partitaIva ?? "")} />
      <Field name="conservazioneMesi" label="Conservazione dati (mesi)" defaultValue={String(values.conservazioneMesi)} />
      <textarea name="noteLegali" defaultValue={String(values.noteLegali ?? "")} className="rounded-2xl border border-line px-3 py-3" />
      <button className="rounded-full bg-cocoa px-4 py-3 text-cream" type="submit">Salva impostazioni</button>
    </form>
  );
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input name={name} defaultValue={defaultValue} className="rounded-2xl border border-line px-3 py-3" />
    </label>
  );
}
