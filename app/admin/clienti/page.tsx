"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
};

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  async function load(q = query) {
    const response = await fetch(`/api/admin/clienti?q=${encodeURIComponent(q)}`);
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else setRows(body.clienti ?? []);
  }
  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/clienti");
      const body = await response.json();
      if (!response.ok) toast.error(body.errore);
      else setRows(body.clienti ?? []);
    })();
  }, []);
  const phones = new Map<string, number>();
  for (const row of rows) {
    const key = (row.phone ?? "").replace(/\D/g, "");
    if (key) phones.set(key, (phones.get(key) ?? 0) + 1);
  }
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-5xl text-cocoa">Clienti</h1>
        <a className="rounded-full border border-cocoa px-4 py-2" href="/api/admin/clienti/esporta">Esporta elenco</a>
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nome, e-mail o telefono" className="flex-1 rounded-2xl border border-line px-3 py-3" />
        <button className="rounded-full bg-cocoa px-4 text-cream" type="submit">Cerca</button>
      </form>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const digits = (row.phone ?? "").replace(/\D/g, "");
          const wa = digits ? `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}` : "";
          return (
            <article key={row.id} className="rounded-3xl bg-white p-4">
              <p className="font-display text-2xl">{row.first_name} {row.last_name}</p>
              <p className="text-sm">{row.email} · {row.phone}</p>
              {digits && phones.get(digits)! > 1 ? <p className="text-sm text-rose">Possibile duplicato per telefono.</p> : null}
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {row.phone ? <a href={`tel:${row.phone}`}>Chiama</a> : null}
                {wa ? <a href={wa} target="_blank" rel="noreferrer">WhatsApp</a> : null}
                <button type="button" onClick={async () => {
                  await fetch("/api/admin/clienti", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: row.id, archiviata: !row.archived_at, nome: row.first_name, cognome: row.last_name, email: row.email, telefono: row.phone, note: row.notes }) });
                  await load();
                }}>{row.archived_at ? "Ripristina" : "Archivia"}</button>
                <button type="button" onClick={async () => {
                  await fetch("/api/admin/clienti", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: row.id, azione: "anonimizza" }) });
                  toast.success("Scheda anonimizzata.");
                  await load();
                }}>Anonimizza</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
