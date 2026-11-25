"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Download, EyeOff, Mail, MapPin, MessageCircle, Phone, Trash2, UserCheck, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { notifyLive } from "@/lib/live";
import { SearchBar, SectionHead, TitleHero } from "@/components/ui/app-header";

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
  address?: string | null;
  in_attesa?: boolean;
};

export default function CustomersPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [filter, setFilter] = useState<"attesa" | "attive" | "archiviate">("attive");
  const [ask, setAsk] = useState<Customer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load(q = query) {
    const response = await fetch(`/api/admin/clienti?q=${encodeURIComponent(q)}`);
    const body = await response.json();
    if (!response.ok) toast.error(body.errore);
    else setRows(body.clienti ?? []);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q") ?? "";
    if (params.get("stato") === "attesa") setFilter("attesa");
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
  const pending = (rows ?? []).filter((row) => row.in_attesa && !row.archived_at);
  const active = (rows ?? []).filter((row) => !row.archived_at && !row.in_attesa);
  const archived = (rows ?? []).filter((row) => row.archived_at);
  const shown = filter === "attesa" ? pending : filter === "attive" ? active : archived;

  async function approve(row: Customer) {
    setBusy(row.id);
    const response = await fetch("/api/admin/clienti", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: row.id, azione: "approva" }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return toast.error(body.errore ?? "Approvazione non riuscita.");
    toast.success(
      body.dispositivi > 0
        ? `${row.first_name} è stata approvata: notifica inviata sul suo telefono.`
        : `${row.first_name} è stata approvata. Non ha attivato le notifiche: le abbiamo scritto via e-mail.`,
    );
    notifyLive();
    await load();
  }

  async function remove(row: Customer) {
    const response = await fetch(`/api/admin/clienti?id=${row.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.errore ?? "Eliminazione non riuscita.");
    toast.success("Cliente eliminata: potrà registrarsi di nuovo.");
    notifyLive();
    await load();
  }

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
        <button role="tab" aria-selected={filter === "attesa"} type="button" className={`chip ${filter === "attesa" ? "is-on" : ""}`} onClick={() => setFilter("attesa")}>
          Da approvare <span className="count" style={pending.length ? { background: "var(--heart)", color: "#fff" } : undefined}>{pending.length}</span>
        </button>
        <button role="tab" aria-selected={filter === "attive"} type="button" className={`chip ${filter === "attive" ? "is-on" : ""}`} onClick={() => setFilter("attive")}>
          Tutte le clienti <span className="count">{active.length}</span>
        </button>
        <button role="tab" aria-selected={filter === "archiviate"} type="button" className={`chip ${filter === "archiviate" ? "is-on" : ""}`} onClick={() => setFilter("archiviate")}>
          Archiviate <span className="count">{archived.length}</span>
        </button>
      </div>

      <SectionHead
        title={filter === "attesa" ? "Nuove registrazioni" : filter === "attive" ? "Schede clienti" : "Archivio"}
        subtitle={filter === "attesa" ? "Approva chi conosci, elimina lo spam: chi elimini potrà registrarsi di nuovo." : undefined}
        href={filter === "attesa" ? undefined : "/admin/appuntamenti"}
        linkLabel="Nuovo appuntamento"
      />

      {!rows ? <div className="grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton" style={{ height: 120 }} />)}</div> : null}
      {rows && shown.length === 0 ? (
        <div className="empty-state"><span className="tile-icon"><Users size={20} /></span>{filter === "attesa" ? "Nessuna registrazione da approvare." : "Nessuna cliente trovata."}</div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((row) => {
          const digits = (row.phone ?? "").replace(/\D/g, "");
          const wa = digits ? `https://wa.me/${digits.startsWith("39") ? digits : `39${digits}`}` : "";
          const initials = `${row.first_name.charAt(0)}${row.last_name.charAt(0)}`.toUpperCase();
          return (
            <article key={row.id} className="salon-card" style={{ cursor: "default", padding: 14 }}>
              <div className="flex items-start gap-3">
                <span className="tile-icon is-primary" style={{ width: 52, height: 52, fontWeight: 600 }}>{initials || "?"}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 truncate text-base">{row.first_name} {row.last_name} {row.in_attesa ? <span className="status-pill is-pending ml-1 align-middle">Da approvare</span> : null}</h3>
                  {row.email ? <p className="m-0 flex items-center gap-1.5 truncate text-[13px] text-[#3d3b47]"><Mail size={13} className="flex-none" /> {row.email}</p> : null}
                  <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[13px] text-[#3d3b47]"><Phone size={13} className="flex-none" /> {row.phone || <span className="text-muted">Telefono non indicato</span>}</p>
                  <p className="m-0 mt-0.5 flex items-center gap-1.5 text-[13px] text-[#3d3b47]"><MapPin size={13} className="flex-none" /> {row.address || <span className="text-muted">Indirizzo non indicato</span>}</p>
                  {digits && phones.get(digits)! > 1 ? <span className="status-pill is-cancelled mt-1">Possibile duplicato per telefono</span> : null}
                </div>
              </div>
              {row.in_attesa ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="btn btn-primary btn-sm" type="button" disabled={busy === row.id} onClick={() => void approve(row)}>
                    <UserCheck size={15} /> {busy === row.id ? "…" : "Approva"}
                  </button>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => setAsk(row)}>
                    <Trash2 size={15} /> Elimina
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {row.phone ? <a className="btn btn-primary btn-xs" href={`tel:${row.phone}`}><Phone size={13} /> Chiama</a> : null}
                {wa ? <a className="btn btn-accent btn-xs" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a> : null}
                {row.address ? <a className="btn btn-white btn-xs" href={`https://maps.apple.com/?daddr=${encodeURIComponent(row.address)}`} target="_blank" rel="noreferrer"><MapPin size={13} /> Itinerario</a> : null}
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
                {!row.in_attesa ? (
                  <button className="btn btn-white btn-xs" type="button" style={{ color: "var(--danger)" }} onClick={() => setAsk(row)}><Trash2 size={13} /> Elimina</button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(ask)}
        tone="danger"
        icon={<Trash2 size={28} />}
        title="Eliminare la cliente?"
        message={ask ? `${ask.first_name} ${ask.last_name}: l'account (anche quello Google) e la scheda verranno cancellati. Potrà registrarsi di nuovo da zero.` : ""}
        confirmLabel="Elimina"
        cancelLabel="Indietro"
        onCancel={() => setAsk(null)}
        onConfirm={async () => {
          if (ask) await remove(ask);
          setAsk(null);
        }}
      />
    </section>
  );
}
