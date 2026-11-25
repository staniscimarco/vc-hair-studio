"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { SectionHead, TitleHero } from "@/components/ui/app-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Admin = { id: string; nome: string; email: string; io: boolean };

export default function AdminsPage() {
  const [rows, setRows] = useState<Admin[] | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revoke, setRevoke] = useState<Admin | null>(null);

  async function load() {
    const response = await fetch("/api/admin/amministratori");
    const body = await response.json();
    setRows(body.amministratori ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const response = await fetch("/api/admin/amministratori", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.errore ?? "Non è stato possibile creare l'accesso.");
      return;
    }
    toast.success(`Accesso creato: ${form.email} ora è amministratore.`);
    setForm({ nome: "", email: "", password: "" });
    await load();
  }

  return (
    <section>
      <TitleHero title="Amministratori" back="/admin" subtitle="Chi può gestire agenda, clienti e notifiche. Non compaiono tra i clienti." />

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <form className="card grid gap-3" onSubmit={(event) => void create(event)} noValidate>
          <div className="card-title">
            <span className="tile-icon is-accent"><UserPlus size={20} /></span>
            <div>
              <h2>Nuovo amministratore</h2>
              <p className="note m-0">Crea un accesso con e-mail e password: potrà entrare subito nell&apos;area salone.</p>
            </div>
          </div>
          <label className="field">Nome e cognome<input value={form.nome} autoComplete="off" onChange={(event) => setForm({ ...form, nome: event.target.value })} /></label>
          <label className="field">E-mail<input type="email" value={form.email} autoComplete="off" onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="field">
            Password
            <span className="address-input">
              <input type={show ? "text" : "password"} value={form.password} autoComplete="new-password" onChange={(event) => setForm({ ...form, password: event.target.value })} />
              <button type="button" className="icon-btn is-soft" style={{ width: 34, height: 34 }} aria-label={show ? "Nascondi password" : "Mostra password"} onClick={() => setShow(!show)}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
            <small className="text-[11px] font-normal text-muted">Almeno 8 caratteri, con una lettera e un numero.</small>
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            <ShieldCheck size={18} /> {busy ? "Creazione…" : "Crea amministratore"}
          </button>
        </form>

        <div>
          <SectionHead title="Accessi attivi" subtitle={rows ? `${rows.length} amministratori` : ""} />
          <div className="grid gap-3">
            {rows === null ? <div className="skeleton" style={{ height: 70 }} /> : null}
            {(rows ?? []).map((row) => (
              <article key={row.id} className="pick-card" style={{ cursor: "default", padding: 12 }}>
                <span className="tile-icon is-primary" style={{ fontWeight: 700 }}>{row.nome.charAt(0).toUpperCase()}</span>
                <div className="pick-main">
                  <h3>{row.nome}{row.io ? " (tu)" : ""}</h3>
                  <p>{row.email}</p>
                </div>
                {!row.io ? (
                  <button className="icon-btn is-white" style={{ width: 38, height: 38, color: "var(--danger)" }} type="button" aria-label="Togli ruolo" title="Togli il ruolo di amministratore" onClick={() => setRevoke(row)}>
                    <UserMinus size={16} />
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(revoke)}
        tone="danger"
        icon={<UserMinus size={30} />}
        title="Togliere il ruolo?"
        message={revoke ? `${revoke.nome} non potrà più entrare nell'area salone. Il suo accesso resta come cliente.` : ""}
        confirmLabel="Togli ruolo"
        onCancel={() => setRevoke(null)}
        onConfirm={async () => {
          if (!revoke) return;
          const response = await fetch(`/api/admin/amministratori?id=${revoke.id}`, { method: "DELETE" });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) toast.error(body.errore ?? "Operazione non riuscita.");
          else toast.success("Ruolo tolto.");
          setRevoke(null);
          await load();
        }}
      />
    </section>
  );
}
