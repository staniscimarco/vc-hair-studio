"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Scissors, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { SocialButtons } from "@/components/auth/social-buttons";
import { safeNext } from "@/lib/security/http";
import { fullAddress, loginSchema, recoverySchema, registrationSchema } from "@/lib/validators";
import { AddressField } from "@/components/auth/address-field";

export function AuthForm({ mode }: { mode: "accesso" | "registrazione" | "recupero" | "nuova-password" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("prossimo"), mode === "registrazione" ? "/" : "/");
  const [pending, setPending] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [message, setMessage] = useState(params.get("errore") ?? "");

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
        toast.error(body.errore || "E-mail o password non corrette.");
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
        indirizzo: formData.get("indirizzo"),
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
            address: fullAddress(parsed.data.indirizzo),
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
      else setMessage("Se l'indirizzo è registrato, riceverai un messaggio per scegliere una nuova password.");
    }
    if (mode === "nuova-password") {
      const password = String(formData.get("password") ?? "");
      if (password.length < 8) {
        toast.error("La password deve contenere almeno 8 caratteri.");
        setPending(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) toast.error("Non è stato possibile aggiornare la password.");
      else {
        toast.success("password aggiornata.");
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

  const copy = {
    accesso: { title: "Accedi", lead: "Bentornata! Accedi con Google o con la tua e-mail per prenotare e gestire i tuoi appuntamenti." },
    registrazione: { title: "Crea il tuo profilo", lead: "Pochi dati e potrai prenotare il tuo prossimo appuntamento in un minuto." },
    recupero: { title: "Recupera l'accesso", lead: "Inserisci la tua e-mail: ti invieremo un messaggio per scegliere una nuova password." },
    "nuova-password": { title: "Nuova password", lead: "Scegli una password di almeno 8 caratteri." },
  }[mode];
  const step = { accesso: 0, registrazione: 1, recupero: 2, "nuova-password": 2 }[mode];

  return (
    <section className="app-screen">
      <div className="auth-wrap">
        <div className="auth-visual" aria-hidden>
          <span className="auth-ring" style={{ width: 420, height: 420, left: -160, top: -180 }} />
          <span className="auth-ring" style={{ width: 300, height: 300, right: -120, bottom: -140 }} />
          <span className="auth-logo">
            <Image src="/brand/vale.png" alt="" width={280} height={280} priority unoptimized />
          </span>
          <span className="auth-floating" style={{ left: "12%", bottom: "18%", transform: "rotate(-8deg)" }}><Scissors size={26} /></span>
          <span className="auth-floating" style={{ right: "12%", top: "18%", transform: "rotate(8deg)" }}><Sparkles size={26} /></span>
          <span className="auth-floating" style={{ right: "16%", bottom: "14%", width: 52, height: 52 }}><Heart size={22} fill="currentColor" /></span>
        </div>

        <div className="auth-panel">
          <h1>{copy.title}</h1>
          <p className="lead">{copy.lead}</p>
          <div className="auth-dots" aria-hidden>
            {[0, 1, 2].map((index) => <span key={index} className={index === step ? "is-on" : ""} />)}
          </div>
          {message ? <p className="card-soft mt-4 text-sm leading-6">{message}</p> : null}
          {!mfa && (mode === "accesso" || mode === "registrazione") ? (
            <div className="mt-6 grid gap-3">
              <SocialButtons next={next} label={mode === "accesso" ? "Accedi" : "Registrati"} />
              <p className="note m-0 text-center lg:text-left">
                Continuando con Google accetti l&apos;<Link className="font-medium text-primary-strong" href="/privacy">informativa sulla privacy</Link>.
              </p>
              <div className="divider">oppure con e-mail</div>
            </div>
          ) : null}
          {mfa ? (
            <form className="mt-6 grid gap-3" onSubmit={(event) => { event.preventDefault(); void verifyMfa(new FormData(event.currentTarget)); }}>
              <label className="field">
                Codice di verifica
                <input name="codice" inputMode="numeric" autoComplete="one-time-code" required />
              </label>
              <button className="btn btn-primary btn-block" type="submit">Verifica</button>
            </form>
          ) : (
            <form className={`${mode === "accesso" || mode === "registrazione" ? "mt-2" : "mt-6"} grid gap-3`} onSubmit={(event) => { event.preventDefault(); void onSubmit(new FormData(event.currentTarget)); }}>
              {mode === "registrazione" ? (
                <div className="field-grid cols-2">
                  <Field name="nome" label="Nome" />
                  <Field name="cognome" label="Cognome" />
                </div>
              ) : null}
              {mode === "registrazione" ? <Field name="telefono" label="Telefono" type="tel" autoComplete="tel" /> : null}
              {mode === "registrazione" ? <AddressField /> : null}
              {mode === "accesso" ? <Field name="email" label="E-mail o nome utente" type="text" autoComplete="username" /> : null}
              {mode === "registrazione" || mode === "recupero" ? <Field name="email" label="E-mail" type="email" /> : null}
              {mode !== "recupero" ? (
                <Field name="password" label="password" type="password" autoComplete={mode === "accesso" ? "current-password" : "new-password"} />
              ) : null}
              {mode === "accesso" ? (
                <Link className="justify-self-end text-[13px] font-medium text-primary-strong no-underline" href="/recupero-password">Hai dimenticato la password?</Link>
              ) : null}
              {mode === "registrazione" ? (
                <label className="flex items-start gap-2 text-sm">
                  <input name="privacy" type="checkbox" className="mt-0.5" required />
                  <span>
                    Ho preso visione dell&apos;<Link className="font-medium text-primary-strong" href="/privacy">informativa sulla privacy</Link>.
                  </span>
                </label>
              ) : null}
              <button className="btn btn-primary btn-block mt-2" disabled={pending} type="submit">
                {pending ? "Attendere…" : "Continua"}
              </button>
            </form>
          )}
          <div className="mt-6 grid gap-2 text-center text-sm lg:text-left">
            {mode !== "accesso" ? (
              <p className="m-0 text-muted">Hai già un profilo? <Link className="font-semibold text-primary-strong no-underline" href={`/accesso?prossimo=${encodeURIComponent(next)}`}>Accedi</Link></p>
            ) : null}
            {mode !== "registrazione" ? (
              <p className="m-0 text-muted">Non hai un profilo? <Link className="font-semibold text-primary-strong no-underline" href={`/registrazione?prossimo=${encodeURIComponent(next)}`}>Crea un profilo</Link></p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ name, label, type = "text", autoComplete }: { name: string; label: string; type?: string; autoComplete?: string }) {
  return (
    <label className="field">
      {label}
      <input name={name} type={type} autoComplete={autoComplete} required />
    </label>
  );
}
