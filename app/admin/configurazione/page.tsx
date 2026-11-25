import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TitleHero } from "@/components/ui/app-header";

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
    <section>
      <TitleHero
        title="Prima configurazione"
        back="/admin"
        subtitle="Le prenotazioni pubbliche restano chiuse finché non segni la configurazione come completata e attivi le prenotazioni. Gli orari del salone non sono precompilati con un turno reale."
      />
      <ol className="mx-auto mt-6 grid max-w-2xl gap-3 p-0">
        {steps.map(([label, href], index) => (
          <li key={label} className="list-none">
            <Link className="pick-card" href={href} style={{ padding: 12 }}>
              <span className="tile-icon is-primary" style={{ fontWeight: 600 }}>{index + 1}</span>
              <span className="pick-main"><h3>{label}</h3></span>
              <span className="round-arrow" aria-hidden><ArrowUpRight size={16} /></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
