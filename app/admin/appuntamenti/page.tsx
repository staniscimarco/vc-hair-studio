"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Service = { id: string; name: string; duration_minutes: number };
type Customer = { id: string; first_name: string; last_name: string };

export default function ManualAppointmentsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  useEffect(() => {
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
    <section className="max-w-xl">
      <h1 className="font-display text-5xl text-cocoa">Appuntamenti</h1>
      <p className="mt-2 text-sm">Per telefonate, messaggi o richieste in salone. La cliente non deve registrarsi.</p>
      <form action={submit} className="mt-6 grid gap-3">
        <select name="clienteId" className="rounded-2xl border border-line px-3 py-3" defaultValue="">
          <option value="" disabled>Seleziona una cliente</option>
          <option value="nuovo">Nuova cliente senza account</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.first_name} {customer.last_name}</option>)}
        </select>
        <input name="nome" placeholder="Nome" className="rounded-2xl border border-line px-3 py-3" />
        <input name="cognome" placeholder="Cognome" className="rounded-2xl border border-line px-3 py-3" />
        <input name="email" placeholder="E-mail facoltativa" className="rounded-2xl border border-line px-3 py-3" />
        <input name="telefono" placeholder="Telefono facoltativo" className="rounded-2xl border border-line px-3 py-3" />
        <select name="servizioId" className="rounded-2xl border border-line px-3 py-3" required>
          {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min</option>)}
        </select>
        <input name="inizio" type="datetime-local" required className="rounded-2xl border border-line px-3 py-3" />
        <input name="durata" type="number" min={15} step={15} defaultValue={30} required className="rounded-2xl border border-line px-3 py-3" />
        <input name="prezzo" type="number" min={0} step="0.01" placeholder="Prezzo in euro, vuoto se da concordare" className="rounded-2xl border border-line px-3 py-3" />
        <textarea name="note" placeholder="Note interne" className="rounded-2xl border border-line px-3 py-3" />
        <button className="rounded-full bg-cocoa px-4 py-3 text-cream" type="submit">Conferma appuntamento</button>
      </form>
    </section>
  );
}
