import { TitleHero } from "@/components/ui/app-header";

export const metadata = { title: "Condizioni di prenotazione" };

export default function TermsPage() {
  return (
    <div className="app-screen">
      <TitleHero title="Condizioni di prenotazione" back="/profilo" />
      <article className="card mx-auto mt-6 max-w-3xl text-[15px] leading-7 [&_h2]:mt-6 [&_h2]:text-lg [&_p]:mt-3">
        <p className="card-soft !mt-0 text-sm">
          Testo operativo iniziale. Va riletto dal salone prima dell&apos;apertura al pubblico.
        </p>
        <p>La prenotazione online è confermata automaticamente quando l&apos;orario risulta libero. Ricevi un codice personale.</p>
        <p>Il pagamento avviene in salone al termine del trattamento. Se il prezzo non è indicato, resta da concordare in salone.</p>
        <p>Modifica e annullamento sono possibili entro il termine impostato dal salone. Il valore iniziale è di 24 ore prima dell&apos;appuntamento.</p>
        <p>Gli orari visibili tengono conto degli impegni, delle chiusure e dei tempi di lavorazione. Un orario può risultare non più disponibile se prenotato da un&apos;altra persona negli stessi istanti.</p>
      </article>
    </div>
  );
}
