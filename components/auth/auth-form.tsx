"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { safeNext } from "@/lib/security/http";
import { loginSchema, recoverySchema, registrationSchema } from "@/lib/validators";

export function AuthForm({ mode }: { mode: "accesso" | "registrazione" | "recupero" | "nuova-password" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("prossimo"), mode === "registrazione" ? "/" : "/");
  const [pending, setPending] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [message, setMessage] = useState("");

  async function onSubmit(formData: FormData) {
    setPending(true);
    if (mode === "accesso") {
      const parsed = loginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
        setPending(false);
        return;
      }
      const response = await fetch("/api/accesso", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.errore || "E-mail o parola d'ordine non corrette.");
        setPending(false);
        return;
      }
      const supabase = await getBrowserSupabase();
      if (!supabase) {
        setPending(false);
        router.push(body.ruolo === "admin" ? "/admin" : next);
        router.refresh();
        return;
      }
      const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level.data?.nextLevel === "aal2" && level.data.currentLevel !== "aal2") {
        const factors = await supabase.auth.mfa.listFactors();
        const factor = factors.data?.totp?.[0];
        if (factor) {
          const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
          if (challenge.data) setMfa({ factorId: factor.id, challengeId: challenge.data.id });
        }
        setPending(false);
        return;
      }
      router.push(body.ruolo === "admin" ? "/admin" : next);
      router.refresh();
      setPending(false);
      return;
    }
    const supabase = await getBrowserSupabase();
    if (!supabase) {
      toast.error("L'accesso non è ancora configurato.");
      setPending(false);
      return;
    }
    if (mode === "registrazione") {
      const parsed = registrationSchema.safeParse({
        nome: formData.get("nome"),
        cognome: formData.get("cognome"),
        email: formData.get("email"),
        telefono: formData.get("telefono"),
        password: formData.get("password"),
        privacy: formData.get("privacy") === "on",
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: {
            first_name: parsed.data.nome,
            last_name: parsed.data.cognome,
            phone: parsed.data.telefono,
            privacy_accepted: "true",
          },
        },
      });
      if (error) toast.error("Non è stato possibile completare la registrazione.");
      else setMessage("Controlla la tua casella di posta per confermare l'indirizzo, poi accedi.");
    }
    if (mode === "recupero") {
      const parsed = recoverySchema.safeParse({ email: formData.get("email") });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Inserisci un indirizzo e-mail valido.");
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/aggiorna-password`,
      });
      if (error) toast.error("Non è stato possibile inviare il messaggio.");
      else setMessage("Se l'indirizzo è registrato, riceverai un messaggio per scegliere una nuova parola d'ordine.");
    }
    if (mode === "nuova-password") {
      const password = String(formData.get("password") ?? "");
      if (password.length < 8) {
        toast.error("La parola d'ordine deve contenere almeno 8 caratteri.");
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) toast.error("Non è stato possibile aggiornare la parola d'ordine.");
      else {
        toast.success("Parola d'ordine aggiornata.");
        router.push("/profilo");
      }
    }
    setPending(false);
  }

  async function verifyMfa(formData: FormData) {
    const supabase = await getBrowserSupabase();
    if (!supabase || !mfa) return;
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: mfa.challengeId,
      code: String(formData.get("codice") ?? ""),
    });
    if (error) {
      toast.error("Il codice non è valido.");
      return;
    }
    router.push(next);
  }

  return (
    <section className="app-screen mx-auto max-w-md">
      <h1 className="font-display text-5xl text-cocoa">
        {mode === "accesso" && "Accedi"}
        {mode === "registrazione" && "Crea il tuo profilo"}
        {mode === "recupero" && "Recupera l'accesso"}
        {mode === "nuova-password" && "Nuova parola d'ordine"}
      </h1>
      {message ? <p className="mt-4 rounded-2xl bg-blush-soft p-4">{message}</p> : null}
      {mfa ? (
        <form className="mt-6 grid gap-3" action={verifyMfa}>
          <label className="grid gap-1 text-sm">
            Codice di verifica
            <input name="codice" inputMode="numeric" autoComplete="one-time-code" className="rounded-2xl border border-line px-3 py-3" required />
          </label>
          <button className="rounded-full bg-cocoa px-4 py-3 text-cream" type="submit">Verifica</button>
        </form>
      ) : (
        <form className="mt-6 grid gap-3" action={onSubmit}>
          {mode === "registrazione" ? (
            <>
              <Field name="nome" label="Nome" />
              <Field name="cognome" label="Cognome" />
              <Field name="telefono" label="Telefono" />
            </>
          ) : null}
          {mode === "accesso" ? <Field name="email" label="E-mail o nome utente" type="text" autoComplete="username" /> : null}
          {mode === "registrazione" || mode === "recupero" ? <Field name="email" label="E-mail" type="email" /> : null}
          {mode !== "recupero" ? (
            <Field name="password" label="Parola d'ordine" type="password" autoComplete={mode === "accesso" ? "current-password" : "new-password"} />
          ) : null}
          {mode === "registrazione" ? (
            <label className="flex items-start gap-2 text-sm">
              <input name="privacy" type="checkbox" className="mt-1" required />
              <span>
                Ho preso visione dell&apos;<Link className="underline" href="/privacy">informativa sulla privacy</Link>.
              </span>
            </label>
          ) : null}
          <button className="rounded-full bg-cocoa px-4 py-3 text-cream disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Attendere…" : "Continua"}
          </button>
        </form>
      )}
      <div className="mt-6 grid gap-2 text-sm">
        {mode !== "accesso" ? <Link href={`/accesso?prossimo=${encodeURIComponent(next)}`}>Hai già un profilo? Accedi</Link> : null}
        {mode !== "registrazione" ? <Link href={`/registrazione?prossimo=${encodeURIComponent(next)}`}>Crea un profilo</Link> : null}
        {mode === "accesso" ? <Link href="/recupero-password">Hai dimenticato la parola d&apos;ordine?</Link> : null}
      </div>
    </section>
  );
}

function Field({ name, label, type = "text", autoComplete }: { name: string; label: string; type?: string; autoComplete?: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} className="rounded-2xl border border-line px-3 py-3" required />
    </label>
  );
}
