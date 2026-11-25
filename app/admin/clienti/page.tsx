"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Download, EyeOff, MessageCircle, Phone, Users } from "lucide-react";
import { SearchBar, SectionHead, TitleHero } from "@/components/ui/app-header";

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
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [filter, setFilter] = useState<"attive" | "archiviate">("attive");

  async function load(q = query) {
    const response = await fetch(`/api/admin/clienti?q=${encodeURIComponent(q)}`);
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else setRows(body.clienti ?? []);
  }

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    setQuery(initial);
    void (async () => {
      const response = await fetch(`/api/admin/clienti?q=${encodeURIComponent(initial)}`);
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.errore);
        setRows([]);
      } else setRows(body.clienti ?? []);
    })();
  }, []);

  const phones = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = (row.phone ?? "").replace(/\D/g, "");
    if (key) phones.set(key, (phones.get(key) ?? 0) + 1);
  }
  const active = (rows ?? []).filter((row) => !row.archived_at);
  const archived = (rows ?? []).filter((row) => row.archived_at);
  const shown = filter === "attive" ? active : archived;

  return (
    <section>
      <TitleHero
        title="Clienti"
        back="/admin"
        action={
          <a className="icon-btn is-white" href="/api/admin/clienti/esporta" aria-label="Esporta elenco" title="Esporta elenco">
            <Download size={20} strokeWidth={2} />
          </a>
        }
      >
        <SearchBar placeholder="Cerca nome, e-mail o telefono" value={query} onChange={setQuery} onSubmit={() => void load()} filterLabel="Cerca" />
      </TitleHero>

      <div className="chips mt-5" role="tablist" aria-label="Filtra clienti">
        <button role="tab" aria-selected={filter === "attive"} type="button" className={`chip ${filter === "attive" ? "is-on" : ""}`} onClick={() => setFilter("attive")}>
          Tutte le clienti <span className="count">{active.length}</span>
        </button>
        <button role="tab" aria-selected={filter === "archiviate"} type="button" className={`chip ${filter === "archiviate" ? "is-on" : ""}`} onClick={() => setFilter("archiviate")}>
          Archiviate <span className="count">{archived.length}</span>
        </button>
      </div>

      <SectionHead title={filter === "attive" ? "Schede clienti" : "Archivio"} href="/admin/appuntamenti" linkLabel="Nuovo appuntamento" />

      {!rows ? <div className="grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 120 }} />)}</div> : null}
      {rows && shown.length === 0 ? (
        <div className="empty-state"><span className="tile-icon"><Users size={20} /></span>Nessuna cliente trovata.</div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((row) => {
          const digits = (row.phone ?? "").replace(/\D/g, "");
          const wa = digits ? `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}` : "";
          const initials = `${row.first_name.charAt(0)}${row.last_name.charAt(0)}`.toUpperCase();
          return (
            <article key={row.id} className="salon-card" style={{ cursor: "default", padding: 14 }}>
              <div className="flex items-center gap-3">
                <span className="tile-icon is-primary" style={{ width: 52, height: 52, fontWeight: 600 }}>{initials || "?"}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 truncate text-base">{row.first_name} {row.last_name}</h3>
                  <p className="m-0 truncate text-[13px] text-[#3d3b47]">{[row.email, row.phone].filter(Boolean).join(" · ") || "Nessun contatto"}</p>
                  {digits && phones.get(digits)! > 1 ? <span className="status-pill is-cancelled mt-1">Possibile duplicato per telefono</span> : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.phone ? <a className="btn btn-primary btn-xs" href={`tel:${row.phone}`}><Phone size={13} /> Chiama</a> : null}
                {wa ? <a className="btn btn-accent btn-xs" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a> : null}
                <button className="btn btn-white btn-xs" type="button" onClick={async () => {
                  await fetch("/api/admin/clienti", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: row.id, archiviata: !row.archived_at, nome: row.first_name, cognome: row.last_name, email: row.email, telefono: row.phone, note: row.notes }) });
                  await load();
                }}>
                  {row.archived_at ? <><ArchiveRestore size={13} /> Ripristina</> : <><Archive size={13} /> Archivia</>}
                </button>
                <button className="btn btn-white btn-xs" type="button" onClick={async () => {
                  await fetch("/api/admin/clienti", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: row.id, azione: "anonimizza" }) });
                  toast.success("Scheda anonimizzata.");
                  await load();
                }}><EyeOff size={13} /> Anonimizza</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
