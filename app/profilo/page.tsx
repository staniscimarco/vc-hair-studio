"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, ChevronRight, Download, Smartphone, FileText, KeyRound, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { fullAddress, profileSchema, streetOf } from "@/lib/validators";
import { AddressField } from "@/components/auth/address-field";
import { TitleHero } from "@/components/ui/app-header";
import { openInstallHint } from "@/components/pwa/install-hint";
import { enablePush } from "@/lib/push-client";

export default function ProfilePage() {
  const router = useRouter();
  const [complete, setComplete] = useState<{ next: string } | null>(null);
  const [profile, setProfile] = useState({ nome: "", cognome: "", telefono: "", email: "", indirizzo: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("completa")) {
      const target = params.get("prossimo") ?? "/";
      setComplete({ next: target.startsWith("/") && !target.startsWith("//") ? target : "/" });
    }
    void getBrowserSupabase().then(async (supabase) => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/accesso?prossimo=/profilo");
        return;
      }
      const row = await supabase.from("profiles").select("first_name, last_name, phone, email, address").eq("id", data.user.id).single();
      setProfile({
        nome: row.data?.first_name ?? "",
        cognome: row.data?.last_name ?? "",
        telefono: row.data?.phone ?? "",
        email: row.data?.email ?? data.user.email ?? "",
        indirizzo: streetOf((row.data as { address?: string } | null)?.address),
      });
    });
  }, [router]);

  async function save(formData: FormData) {
    const supabase = await getBrowserSupabase();
    if (!supabase) return;
    const parsed = profileSchema.safeParse({
      nome: formData.get("nome"),
      cognome: formData.get("cognome"),
      telefono: formData.get("telefono"),
      indirizzo: formData.get("indirizzo"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati.");
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: parsed.data.nome, last_name: parsed.data.cognome, phone: parsed.data.telefono, address: fullAddress(parsed.data.indirizzo) })
      .eq("id", data.user.id);
    if (error) toast.error("Non è stato possibile aggiornare il profilo.");
    else {
      toast.success(complete ? "Perfetto, il tuo profilo è completo! ✨" : "Profilo aggiornato.");
      if (complete) router.push(complete.next);
    }
  }

  async function changePassword(formData: FormData) {
    const supabase = await getBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") });
    if (error) toast.error("Non è stato possibile aggiornare la password.");
    else toast.success("password aggiornata.");
  }

  async function requestDeletion() {
    const supabase = await getBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from("profiles").update({ deletion_requested_at: new Date().toISOString() }).eq("id", data.user.id);
    if (error) toast.error("Non è stato possibile registrare la richiesta.");
    else toast.success("Richiesta di cancellazione registrata. Il salone la prenderà in carico.");
  }

  const initials = `${profile.nome.charAt(0)}${profile.cognome.charAt(0)}`.toUpperCase();
  const fullName = `${profile.nome} ${profile.cognome}`.trim();

  return (
    <section className="app-screen">
      <TitleHero title="Profilo" back="/">
        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <span className="hero-avatar" style={{ width: 84, height: 84, fontSize: 28 }}>
            {initials || <UserRound size={34} />}
          </span>
          <strong className="text-lg">{fullName || "Il tuo profilo"}</strong>
          {profile.email ? <span className="text-[13px] opacity-85">{profile.email}</span> : null}
        </div>
      </TitleHero>

      {complete ? (
        <div className="warning-box mt-5">
          Benvenuta! Completa telefono e indirizzo: ci servono per confermarti l&apos;appuntamento.
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <form action={save} className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon"><UserRound size={20} /></span>
            <h2>Dati personali</h2>
          </div>
          <label className="field">Nome<input name="nome" defaultValue={profile.nome} key={`n-${profile.nome}`} /></label>
          <label className="field">Cognome<input name="cognome" defaultValue={profile.cognome} key={`c-${profile.cognome}`} /></label>
          <label className="field">Telefono<input name="telefono" type="tel" defaultValue={profile.telefono} key={`t-${profile.telefono}`} /></label>
          <AddressField defaultValue={profile.indirizzo} key={`a-${profile.indirizzo}`} />
          <p className="note m-0">E-mail: {profile.email}</p>
          <button className="btn btn-primary btn-block" type="submit">Salva profilo</button>
        </form>

        <div className="grid gap-5">
          <form action={changePassword} className="card grid gap-3">
            <div className="card-title">
              <span className="tile-icon"><KeyRound size={20} /></span>
              <h2>Sicurezza</h2>
            </div>
            <label className="field">Nuova password<input name="password" type="password" minLength={8} required /></label>
            <button className="btn btn-soft btn-block" type="submit">Aggiorna password</button>
          </form>

          <nav className="card" aria-label="Altre opzioni" style={{ paddingBlock: 6 }}>
            <button className="list-row" type="button" onClick={async () => {
              const result = await enablePush("customer");
              if (result.ok) toast.success("Notifiche attivate: ti avviseremo di conferme, posti liberi e offerte.");
              else toast.error(result.motivo ?? "Notifiche non attivate.");
            }}>
              <span className="tile-icon"><BellRing size={18} /></span>
              <span className="grow">Attiva le notifiche<small className="block text-xs font-normal text-muted">Conferme, posti liberi e offerte riservate</small></span>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <button className="list-row" type="button" onClick={openInstallHint}>
              <span className="tile-icon"><Smartphone size={18} /></span>
              <span className="grow">Installa l&apos;app sul telefono</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <Link className="list-row" href="/privacy">
              <span className="tile-icon"><ShieldCheck size={18} /></span>
              <span className="grow">Informativa sulla privacy</span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
            <Link className="list-row" href="/condizioni">
              <span className="tile-icon"><FileText size={18} /></span>
              <span className="grow">Condizioni di prenotazione</span>
              <ChevronRight size={18} className="text-muted" />
            </Link>
            <a className="list-row" href="/api/profilo/esporta">
              <span className="tile-icon"><Download size={18} /></span>
              <span className="grow">Esporta i miei dati</span>
              <ChevronRight size={18} className="text-muted" />
            </a>
            <button className="list-row" type="button" onClick={() => void requestDeletion()}>
              <span className="tile-icon"><Trash2 size={18} /></span>
              <span className="grow">Richiedi la cancellazione dell&apos;account</span>
              <ChevronRight size={18} className="text-muted" />
            </button>
            <button
              className="list-row is-danger"
              type="button"
              onClick={async () => {
                await (await getBrowserSupabase())?.auth.signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <span className="tile-icon"><LogOut size={18} /></span>
              <span className="grow">Esci</span>
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
