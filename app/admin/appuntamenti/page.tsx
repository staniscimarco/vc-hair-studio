"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, UserRound } from "lucide-react";
import { TitleHero } from "@/components/ui/app-header";

type Service = { id: string; name: string; duration_minutes: number };
type Customer = { id: string; first_name: string; last_name: string };

export default function ManualAppointmentsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [nuova, setNuova] = useState(false);
  const [initialStart, setInitialStart] = useState("");
  useEffect(() => {
    const inizio = new URLSearchParams(window.location.search).get("inizio");
    if (inizio) setInitialStart(toLocalInput(inizio));
    void fetch("/api/admin/servizi").then((response) => response.json()).then((body) => setServices(body.servizi ?? []));
    void fetch("/api/admin/clienti").then((response) => response.json()).then((body) => setCustomers(body.clienti ?? []));
  }, []);

  async function submit(formData: FormData) {
    const nuovo = String(formData.get("clienteId") ?? "") === "nuovo";
    const response = await fetch("/api/admin/agenda", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clienteId: nuovo ? null : formData.get("clienteId"),
        nuovoCliente: nuovo ? {
          nome: formData.get("nome"),
          cognome: formData.get("cognome"),
          email: formData.get("email"),
          telefono: formData.get("telefono"),
        } : null,
        servizioId: formData.get("servizioId"),
        inizio: new Date(String(formData.get("inizio"))).toISOString(),
        durataMinuti: Number(formData.get("durata")),
        prezzoCentesimi: formData.get("prezzo") ? Math.round(Number(formData.get("prezzo")) * 100) : null,
        note: formData.get("note"),
      }),
    });
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else toast.success("Appuntamento inserito.");
  }

  return (
    <section>
      <TitleHero title="Nuovo appuntamento" back="/admin" subtitle="Per telefonate, messaggi o richieste in salone. La cliente non deve registrarsi." />
      <form action={submit} className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="card grid gap-3">
          <div className="card-title"><span className="tile-icon"><UserRound size={20} /></span><h2>Cliente</h2></div>
          <label className="field">Scheda cliente
            <select name="clienteId" defaultValue="" onChange={(event) => setNuova(event.target.value === "nuovo")}>
              <option value="" disabled>Seleziona una cliente</option>
              <option value="nuovo">Nuova cliente senza account</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name}</option>)}
            </select>
          </label>
          <div className={`grid gap-3 ${nuova ? "" : "opacity-60"}`}>
            <div className="field-grid cols-2">
              <label className="field">Nome<input name="nome" /></label>
              <label className="field">Cognome<input name="cognome" /></label>
            </div>
            <div className="field-grid cols-2">
              <label className="field">E-mail<input name="email" placeholder="Facoltativa" /></label>
              <label className="field">Telefono<input name="telefono" placeholder="Facoltativo" /></label>
            </div>
          </div>
        </div>
        <div className="card grid gap-3">
          <div className="card-title"><span className="tile-icon"><CalendarPlus size={20} /></span><h2>Appuntamento</h2></div>
          <label className="field">Trattamento
            <select name="servizioId" required>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
            </select>
          </label>
          <label className="field">Data e ora<input name="inizio" type="datetime-local" required defaultValue={initialStart} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">Durata (min)<input name="durata" type="number" min={15} step={15} defaultValue={30} required /></label>
            <label className="field">Prezzo (€)<input name="prezzo" type="number" min={0} step="0.01" placeholder="Da concordare" /></label>
          </div>
          <label className="field">Note interne<textarea name="note" /></label>
          <button className="btn btn-primary btn-block" type="submit">Conferma appuntamento</button>
        </div>
      </form>
    </section>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
