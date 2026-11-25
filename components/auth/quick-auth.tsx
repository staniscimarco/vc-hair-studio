"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { fullAddress, loginSchema, registrationSchema } from "@/lib/validators";
import { AddressField } from "@/components/auth/address-field";
import { SocialButtons } from "@/components/auth/social-buttons";

/**
 * Accesso o registrazione senza lasciare la prenotazione.
 * `onDone` viene chiamato quando la sessione è attiva.
 */
export function QuickAuth({ next, onDone }: { next: string; onDone: (name: string) => void }) {
  const [mode, setMode] = useState<"accedi" | "registrati">("accedi");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function login(formData: FormData) {
    const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
      return;
    }
    setPending(true);
    const response = await fetch("/api/accesso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      toast.error(body.errore || "E-mail o password non corrette.");
      return;
    }
    const session = await fetch("/api/sessione").then((res) => res.json()).catch(() => ({ nome: "" }));
    toast.success("Accesso effettuato.");
    onDone(session.nome ?? "");
  }

  async function register(formData: FormData) {
    const parsed = registrationSchema.safeParse({
      nome: formData.get("nome"),
      cognome: formData.get("cognome"),
      email: formData.get("email"),
      telefono: formData.get("telefono"),
      indirizzo: formData.get("indirizzo"),
      password: formData.get("password"),
      privacy: formData.get("privacy") === "on",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
      return;
    }
    const supabase = await getBrowserSupabase();
    if (!supabase) {
      toast.error("L'accesso non è ancora configurato.");
      return;
    }
    setPending(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          first_name: parsed.data.nome,
          last_name: parsed.data.cognome,
          phone: parsed.data.telefono,
          address: fullAddress(parsed.data.indirizzo),
          privacy_accepted: "true",
        },
      },
    });
    setPending(false);
    if (error) {
      toast.error("Non è stato possibile completare la registrazione.");
      return;
    }
    // Il salone riceve la notifica della nuova registrazione da approvare.
    void fetch("/api/registrazione", { method: "POST" }).catch(() => undefined);
    if (data.session) {
      toast.success("Profilo creato.");
      onDone(parsed.data.nome);
      return;
    }
    setMessage("Ti abbiamo inviato un'e-mail: apri il link per confermare l'indirizzo e tornerai qui per completare la prenotazione.");
  }

  return (
    <div className="grid gap-4">
      <div className="segmented" role="tablist" aria-label="Accesso">
        <button type="button" role="tab" aria-selected={mode === "accedi"} className={mode === "accedi" ? "is-on" : ""} onClick={() => setMode("accedi")}>
          Ho già un profilo
        </button>
        <button type="button" role="tab" aria-selected={mode === "registrati"} className={mode === "registrati" ? "is-on" : ""} onClick={() => setMode("registrati")}>
          Sono nuova
        </button>
      </div>

      <SocialButtons next={next} label={mode === "accedi" ? "Accedi" : "Registrati"} />
      <p className="note m-0 text-center">
        Continuando con Google accetti l&apos;<Link className="font-medium text-primary-strong" href="/privacy">informativa sulla privacy</Link>.
      </p>
      <div className="divider">oppure con e-mail</div>

      {message ? <p className="card-soft m-0 text-sm leading-6">{message}</p> : null}

      {mode === "accedi" ? (
        <form onSubmit={(event) => { event.preventDefault(); void login(new FormData(event.currentTarget)); }} className="grid gap-3">
          <label className="field">E-mail<input name="email" type="text" autoComplete="username" required /></label>
          <label className="field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <Link className="justify-self-end text-[13px] font-medium text-primary-strong no-underline" href="/recupero-password">
            Hai dimenticato la password?
          </Link>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>{pending ? "Attendere…" : "Accedi e continua"}</button>
        </form>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void register(new FormData(event.currentTarget)); }} className="grid gap-3">
          <div className="field-grid cols-2">
            <label className="field">Nome<input name="nome" autoComplete="given-name" required /></label>
            <label className="field">Cognome<input name="cognome" autoComplete="family-name" required /></label>
          </div>
          <label className="field">Telefono<input name="telefono" type="tel" autoComplete="tel" required /></label>
          <AddressField />
          <label className="field">E-mail<input name="email" type="email" autoComplete="email" required /></label>
          <label className="field">Password<input name="password" type="password" autoComplete="new-password" required /></label>
          <label className="flex items-start gap-2 text-sm">
            <input name="privacy" type="checkbox" className="mt-0.5" required />
            <span>Ho preso visione dell&apos;<Link className="font-medium text-primary-strong" href="/privacy">informativa sulla privacy</Link>.</span>
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>{pending ? "Attendere…" : "Crea profilo e continua"}</button>
        </form>
      )}
    </div>
  );
}
