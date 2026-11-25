export const metadata = { title: "Condizioni di prenotazione" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-8">
      <p className="rounded-2xl bg-blush-soft p-4 text-sm">
        Testo operativo iniziale. Va riletto dal salone prima dell&apos;apertura al pubblico.
      </p>
      <h1 className="mt-6 font-display text-5xl text-cocoa">Condizioni di prenotazione</h1>
      <p className="mt-4">La prenotazione online è confermata automaticamente quando l&apos;orario risulta libero. Ricevi un codice personale.</p>
      <p>Il pagamento avviene in salone al termine del trattamento. Se il prezzo non è indicato, resta da concordare in salone.</p>
      <p>Modifica e annullamento sono possibili entro il termine impostato dal salone. Il valore iniziale è di 24 ore prima dell&apos;appuntamento.</p>
      <p>Gli orari visibili tengono conto degli impegni, delle chiusure e dei tempi di lavorazione. Un orario può risultare non più disponibile se prenotato da un&apos;altra persona negli stessi istanti.</p>
    </article>
  );
}
