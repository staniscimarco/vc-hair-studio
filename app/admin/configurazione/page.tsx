import Link from "next/link";

const steps = [
  ["Dati del salone", "/admin/impostazioni"],
  ["Orari lavorativi", "/admin/disponibilita"],
  ["Giorni di chiusura", "/admin/disponibilita"],
  ["Servizi, prezzi e durate", "/admin/servizi"],
  ["Regole di prenotazione", "/admin/impostazioni"],
  ["Notifiche", "/admin/notifiche"],
  ["E-mail", "/admin/impostazioni"],
  ["Informazioni legali", "/admin/impostazioni"],
];

export default function SetupPage() {
  return (
    <section className="max-w-xl">
      <h1 className="font-display text-5xl text-cocoa">Prima configurazione</h1>
      <p className="mt-3 leading-7">Le prenotazioni pubbliche restano chiuse finché non segni la configurazione come completata e attivi le prenotazioni. Gli orari del salone non sono precompilati con un turno reale.</p>
      <ol className="mt-6 grid gap-3">
        {steps.map(([label, href], index) => (
          <li key={label}>
            <Link className="flex items-center justify-between rounded-3xl bg-white px-4 py-3" href={href}>
              <span>{index + 1}. {label}</span>
              <span>Apri</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
