"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Download, FileText, KeyRound, LogOut, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { profileSchema } from "@/lib/validators";
import { TitleHero } from "@/components/ui/app-header";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState({ nome: "", cognome: "", telefono: "", email: "" });

  useEffect(() => {
    void getBrowserSupabase().then(async (supabase) => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/accesso?prossimo=/profilo");
        return;
      }
      const row = await supabase.from("profiles").select("first_name, last_name, phone, email").eq("id", data.user.id).single();
      setProfile({
        nome: row.data?.first_name ?? "",
        cognome: row.data?.last_name ?? "",
        telefono: row.data?.phone ?? "",
        email: row.data?.email ?? data.user.email ?? "",
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
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Controlla i dati.");
      return;
    }
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: parsed.data.nome, last_name: parsed.data.cognome, phone: parsed.data.telefono })
      .eq("id", data.user.id);
    if (error) toast.error("Non è stato possibile aggiornare il profilo.");
    else toast.success("Profilo aggiornato.");
  }

  async function changePassword(formData: FormData) {
    const supabase = await getBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: String(formData.get("password") ?? "") });
    if (error) toast.error("Non è stato possibile aggiornare la parola d'ordine.");
    else toast.success("Parola d'ordine aggiornata.");
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

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <form action={save} className="card grid gap-3">
          <div className="card-title">
            <span className="tile-icon"><UserRound size={20} /></span>
            <h2>Dati personali</h2>
          </div>
          <label className="field">Nome<input name="nome" defaultValue={profile.nome} key={`n-${profile.nome}`} /></label>
          <label className="field">Cognome<input name="cognome" defaultValue={profile.cognome} key={`c-${profile.cognome}`} /></label>
          <label className="field">Telefono<input name="telefono" defaultValue={profile.telefono} key={`t-${profile.telefono}`} /></label>
          <p className="note m-0">E-mail: {profile.email}</p>
          <button className="btn btn-primary btn-block" type="submit">Salva profilo</button>
        </form>

        <div className="grid gap-5">
          <form action={changePassword} className="card grid gap-3">
            <div className="card-title">
              <span className="tile-icon"><KeyRound size={20} /></span>
              <h2>Sicurezza</h2>
            </div>
            <label className="field">Nuova parola d&apos;ordine<input name="password" type="password" minLength={8} required /></label>
            <button className="btn btn-soft btn-block" type="submit">Aggiorna parola d&apos;ordine</button>
          </form>

          <nav className="card" aria-label="Altre opzioni" style={{ paddingBlock: 6 }}>
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
