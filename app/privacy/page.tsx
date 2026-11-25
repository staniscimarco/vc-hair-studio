export const metadata = { title: "Informativa sulla privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-8">
      <p className="rounded-2xl bg-blush-soft p-4 text-sm">
        Bozza da completare con i dati reali del titolare e da far verificare prima dell&apos;apertura al pubblico. Non contiene dati societari inventati.
      </p>
      <h1 className="mt-6 font-display text-5xl text-cocoa">Informativa sulla privacy</h1>
      <p className="mt-4">
        VC Hair Studio tratta i dati necessari a creare il profilo, fissare e gestire gli appuntamenti: nome, cognome, e-mail, telefono e storico delle prenotazioni.
      </p>
      <h2 className="mt-6 font-display text-3xl">Titolare del trattamento</h2>
      <p>Nome, indirizzo, e-mail e partita IVA vanno inseriti dall&apos;amministratore in Impostazioni prima della pubblicazione. Finché i campi sono vuoti, l&apos;informativa non è completa.</p>
      <h2 className="mt-6 font-display text-3xl">Finalità</h2>
      <p>I dati servono a erogare la prenotazione, inviare conferme e promemoria se il servizio e-mail è attivo, e permettere al salone di organizzare l&apos;agenda. Non usiamo cookie di profilazione né strumenti pubblicitari.</p>
      <h2 className="mt-6 font-display text-3xl">Diritti</h2>
      <p>Puoi chiedere l&apos;accesso, la rettifica, l&apos;esportazione o la cancellazione dei tuoi dati dall&apos;area profilo. La cancellazione viene valutata dal salone, anche in relazione agli obblighi di conservazione.</p>
      <h2 className="mt-6 font-display text-3xl">Conservazione</h2>
      <p>Il periodo di conservazione è impostato dal salone. Il valore iniziale previsto è di 24 mesi, modificabile prima dell&apos;apertura.</p>
    </article>
  );
}
