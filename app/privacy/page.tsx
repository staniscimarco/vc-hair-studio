import { TitleHero } from "@/components/ui/app-header";

export const metadata = { title: "Informativa sulla privacy" };

export default function PrivacyPage() {
  return (
    <div className="app-screen">
      <TitleHero title="Informativa sulla privacy" back="/profilo" />
      <article className="card mx-auto mt-6 max-w-3xl text-[15px] leading-7 [&_h2]:mt-6 [&_h2]:text-lg [&_p]:mt-3">
        <p className="card-soft !mt-0 text-sm">
          Bozza da completare con i dati reali del titolare e da far verificare prima dell&apos;apertura al pubblico. Non contiene dati societari inventati.
        </p>
        <p>
          VC Hair Studio tratta i dati necessari a creare il profilo, fissare e gestire gli appuntamenti: nome, cognome, e-mail, telefono e storico delle prenotazioni.
        </p>
        <h2>Titolare del trattamento</h2>
        <p>Nome, indirizzo, e-mail e partita IVA vanno inseriti dall&apos;amministratore in Impostazioni prima della pubblicazione. Finché i campi sono vuoti, l&apos;informativa non è completa.</p>
        <h2>Finalità</h2>
        <p>I dati servono a erogare la prenotazione, inviare conferme e promemoria se il servizio e-mail è attivo, e permettere al salone di organizzare l&apos;agenda. Non usiamo cookie di profilazione né strumenti pubblicitari.</p>
        <h2>Diritti</h2>
        <p>Puoi chiedere l&apos;accesso, la rettifica, l&apos;esportazione o la cancellazione dei tuoi dati dall&apos;area profilo. La cancellazione viene valutata dal salone, anche in relazione agli obblighi di conservazione.</p>
        <h2>Conservazione</h2>
        <p>Il periodo di conservazione è impostato dal salone. Il valore iniziale previsto è di 24 mesi, modificabile prima dell&apos;apertura.</p>
      </article>
    </div>
  );
}
